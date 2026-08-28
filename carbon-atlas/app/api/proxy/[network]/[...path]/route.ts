import { NextRequest, NextResponse } from "next/server"
import { getIndexerToken, invalidateTokens } from "@/lib/api/auth"
import {
  resolveFallback,
  snapshotGeneratedAt,
  FALLBACK_HEADER,
  FALLBACK_DATE_HEADER,
} from "@/lib/fallback/serve"

const BASE_URL =
  process.env.INDEXER_API_BASE_URL ?? process.env.INDEXER_API_URL!

/** Set to "1" to serve the offline snapshot and skip the indexer entirely. */
const FORCE_FALLBACK = process.env.INDEXER_FORCE_FALLBACK === "1"

async function fetchUpstream(upstreamUrl: string, token: string) {
  return fetch(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })
}

function fallbackResponse(
  network: string,
  pathStr: string,
  searchParams: URLSearchParams,
  reason: string
) {
  const data = resolveFallback(network, pathStr, searchParams)
  if (!data) return null

  console.warn(`[proxy] serving offline snapshot for ${network}/${pathStr} (${reason})`)

  return NextResponse.json(data, {
    status: 200,
    headers: {
      [FALLBACK_HEADER]: "offline-snapshot",
      [FALLBACK_DATE_HEADER]: snapshotGeneratedAt,
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
  const qs = searchParams.toString()

  if (FORCE_FALLBACK) {
    const forced = fallbackResponse(network, pathStr, searchParams, "INDEXER_FORCE_FALLBACK")
    if (forced) return forced
  }

  const upstreamUrl = `${BASE_URL}/${network}/${pathStr}${qs ? `?${qs}` : ""}`

  let res: Response
  try {
    let token = await getIndexerToken()
    res = await fetchUpstream(upstreamUrl, token)

    // On 401, invalidate cached token and retry once with a fresh token
    if (res.status === 401) {
      invalidateTokens()
      token = await getIndexerToken()
      res = await fetchUpstream(upstreamUrl, token)
    }

    // On 500, retry once — upstream indexer has transient failures
    if (res.status === 500) {
      res = await fetchUpstream(upstreamUrl, token)
    }
  } catch (err) {
    // The auth chain itself failed (expired subscription, MGS outage, network
    // error). Nothing was fetched, so fall back to the snapshot.
    invalidateTokens()
    const reason = err instanceof Error ? err.message : "auth failed"
    const fallback = fallbackResponse(network, pathStr, searchParams, reason)
    if (fallback) return fallback

    console.error(`[proxy] ${network}/${pathStr} failed with no snapshot available:`, err)
    return NextResponse.json(
      { error: "Indexer unavailable", detail: reason },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }

  if (!res.ok) {
    const fallback = fallbackResponse(network, pathStr, searchParams, `upstream ${res.status}`)
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
