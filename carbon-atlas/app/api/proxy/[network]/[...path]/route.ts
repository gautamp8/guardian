import { NextRequest, NextResponse } from "next/server"
import { getIndexerToken, invalidateTokens } from "@/lib/api/auth"
import {
  resolveFallback,
  getSnapshotGeneratedAt,
  FALLBACK_HEADER,
  FALLBACK_DATE_HEADER,
} from "@/lib/fallback/serve"

const BASE_URL =
  process.env.INDEXER_API_BASE_URL ?? process.env.INDEXER_API_URL!

/** Set to "1" to serve the offline snapshot and skip the indexer entirely. */
const FORCE_FALLBACK = process.env.INDEXER_FORCE_FALLBACK === "1"

/** Total upstream attempts before giving up and serving the snapshot. */
const MAX_ATTEMPTS = 3
/** Delay before attempt N (index 0 is the first retry). */
const BACKOFF_MS = [300, 900]
/** Give up on a single upstream call rather than hanging the request. */
const UPSTREAM_TIMEOUT_MS = 20_000

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchUpstream(upstreamUrl: string, token: string) {
  return fetch(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
}

/** 5xx and 429 are worth another go; other 4xx will fail the same way again. */
function isRetryableStatus(status: number) {
  return status >= 500 || status === 429
}

async function fallbackResponse(
  network: string,
  pathStr: string,
  searchParams: URLSearchParams,
  reason: string
) {
  const data = await resolveFallback(network, pathStr, searchParams)
  if (!data) return null

  console.warn(`[proxy] serving offline snapshot for ${network}/${pathStr} (${reason})`)

  return NextResponse.json(data, {
    status: 200,
    headers: {
      [FALLBACK_HEADER]: "offline-snapshot",
      [FALLBACK_DATE_HEADER]: await getSnapshotGeneratedAt(),
      // Short TTL so the live indexer is picked up again as soon as it returns.
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ network: string; path: string[] }> }
) {
  const { network, path } = await params
  const pathStr = path.join("/")

  const searchParams = new URLSearchParams(request.nextUrl.searchParams)

  // ?__fallback=1 serves the snapshot for this one request. The fallback is
  // otherwise only exercised during an outage — the worst moment to discover it
  // does not work — so this makes it verifiable at any time, in any
  // environment. It exposes nothing the endpoint does not already serve.
  const probeFallback = searchParams.get("__fallback") === "1"
  searchParams.delete("__fallback")
  const qs = searchParams.toString()

  if (FORCE_FALLBACK || probeFallback) {
    const reason = probeFallback ? "__fallback probe" : "INDEXER_FORCE_FALLBACK"
    const forced = await fallbackResponse(network, pathStr, searchParams, reason)
    if (forced) return forced
    if (probeFallback) {
      return NextResponse.json(
        { error: "No snapshot entry for this request" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }
  }

  const upstreamUrl = `${BASE_URL}/${network}/${pathStr}${qs ? `?${qs}` : ""}`

  let res: Response | null = null
  let lastReason = "unknown"

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)])
    }

    try {
      const token = await getIndexerToken()
      const candidate = await fetchUpstream(upstreamUrl, token)

      if (candidate.ok) {
        res = candidate
        break
      }

      // A stale token looks like a 401 — drop it so the next attempt re-auths.
      if (candidate.status === 401) {
        invalidateTokens()
        lastReason = "upstream 401"
        continue
      }

      if (isRetryableStatus(candidate.status)) {
        lastReason = `upstream ${candidate.status}`
        continue
      }

      // Non-retryable client error — pass it through untouched.
      res = candidate
      break
    } catch (err) {
      // The auth chain or the request itself failed: expired subscription, MGS
      // outage, timeout, DNS. Drop any cached token in case it is the cause.
      invalidateTokens()
      lastReason = err instanceof Error ? err.message : "request failed"
    }
  }

  if (!res) {
    const fallback = await fallbackResponse(network, pathStr, searchParams, lastReason)
    if (fallback) return fallback

    console.error(
      `[proxy] ${network}/${pathStr} failed after ${MAX_ATTEMPTS} attempts ` +
      `with no snapshot available: ${lastReason}`
    )
    return NextResponse.json(
      { error: "Indexer unavailable", detail: lastReason },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }

  if (!res.ok) {
    const fallback = await fallbackResponse(network, pathStr, searchParams, `upstream ${res.status}`)
    if (fallback) return fallback
  }

  // An upstream error body is not guaranteed to be JSON.
  const body = await res.text()
  let data: unknown
  try {
    data = body ? JSON.parse(body) : null
  } catch {
    data = { error: "Malformed upstream response", detail: body.slice(0, 500) }
  }

  return NextResponse.json(data, {
    status: res.status,
    headers: {
      "Cache-Control": res.ok
        ? "s-maxage=600, stale-while-revalidate=3600"
        : "no-store",
    },
  })
}
