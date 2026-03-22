import { NextRequest, NextResponse } from "next/server"
import { getIndexerToken, invalidateTokens } from "@/lib/api/auth"

const BASE_URL = process.env.INDEXER_API_BASE_URL ?? process.env.INDEXER_API_URL!
const ALLOWED_NETWORKS = new Set(["testnet", "mainnet"])

function resolveUpstreamBase(network: string): string {
  // If INDEXER_API_BASE_URL is set (no network suffix), append network
  if (process.env.INDEXER_API_BASE_URL) {
    return `${process.env.INDEXER_API_BASE_URL}/${network}`
  }
  // Legacy: INDEXER_API_URL already includes /testnet — replace the last segment
  const url = BASE_URL
  const lastSlash = url.lastIndexOf("/")
  const base = url.slice(0, lastSlash)
  return `${base}/${network}`
}

async function fetchUpstream(upstreamUrl: string, token: string) {
  return fetch(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 600 },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ network: string; path: string[] }> }
) {
  const { network, path } = await params

  if (!ALLOWED_NETWORKS.has(network)) {
    return NextResponse.json(
      { error: `Invalid network: ${network}` },
      { status: 400 }
    )
  }

  const pathStr = path.join("/")
  const searchParams = request.nextUrl.searchParams.toString()
  const base = resolveUpstreamBase(network)
  const upstreamUrl = `${base}/${pathStr}${searchParams ? `?${searchParams}` : ""}`

  const token = await getIndexerToken()
  let res = await fetchUpstream(upstreamUrl, token)

  if (res.status === 401) {
    invalidateTokens()
    const freshToken = await getIndexerToken()
    res = await fetchUpstream(upstreamUrl, freshToken)
  }

  const data = await res.json()

  return NextResponse.json(data, {
    status: res.status,
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  })
}
