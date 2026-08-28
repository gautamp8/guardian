/**
 * Offline fallback for the Guardian indexer.
 *
 * snapshot-data.js is rebuilt by scripts/build-fallback-snapshot.mjs from the
 * Hedera mirror node, IPFS and the live indexer, so the dashboard keeps
 * rendering real on-chain data when the upstream indexer is unreachable — an
 * outage, or a lapsed MGS subscription.
 *
 * The snapshot is ~17 MB of JSON (VM0033's PDDs carry 40-year projection
 * tables), so it ships gzipped and is imported lazily: a request that the live
 * indexer serves never loads or parses it.
 *
 * This is a read-only mirror of two endpoints. Anything else resolves to null
 * and the proxy surfaces the upstream error as before.
 */

import type { PolicyVcListResponse, VCDetail, VCListItem } from "@/lib/types/indexer"

interface SnapshotPolicy {
  slug: string
  network: string
  policyName: string
  instanceTopicId: string
  items: VCListItem[]
  documents: Record<string, VCDetail>
  hydrated: number
  expectedDocuments?: number
}

interface Snapshot {
  generatedAt: string
  source: string
  note: string
  policies: Record<string, SnapshotPolicy>
}

/** Marks a response as coming from the snapshot rather than the live indexer. */
export const FALLBACK_HEADER = "x-carbon-atlas-source"
export const FALLBACK_DATE_HEADER = "x-carbon-atlas-snapshot-date"

let cached: Snapshot | null = null
let inflight: Promise<Snapshot> | null = null

/** Inflate once per process; concurrent callers share the same work. */
async function loadSnapshot(): Promise<Snapshot> {
  if (cached) return cached
  if (!inflight) {
    inflight = (async () => {
      const [{ default: base64 }, { gunzipSync }] = await Promise.all([
        import("./snapshot-data.js"),
        import("node:zlib"),
      ])
      cached = JSON.parse(gunzipSync(Buffer.from(base64, "base64")).toString("utf8")) as Snapshot
      return cached
    })().finally(() => {
      inflight = null
    })
  }
  return inflight
}

/** When the snapshot was built. Cheap — does not inflate the payload. */
export async function getSnapshotGeneratedAt(): Promise<string> {
  const { generatedAt } = await import("./snapshot-data.js")
  return generatedAt
}

function listResponse(
  policy: SnapshotPolicy,
  searchParams: URLSearchParams
): PolicyVcListResponse {
  const pageIndex = Number(searchParams.get("pageIndex") ?? 0) || 0
  const pageSize = Number(searchParams.get("pageSize") ?? 25) || 25
  const orderDir = (searchParams.get("orderDir") ?? "DESC").toUpperCase()

  // The generator stores newest-first; only reverse when the caller asks.
  const ordered = orderDir === "ASC" ? [...policy.items].reverse() : policy.items

  const start = pageIndex * pageSize
  return {
    items: ordered.slice(start, start + pageSize),
    total: ordered.length,
    pageIndex,
    pageSize,
  }
}

/**
 * Resolve a proxy request against the snapshot.
 *
 * @param network  network segment from the proxy path
 * @param path     upstream path, e.g. "entities/vc-documents"
 * @returns the response body, or null when the snapshot cannot serve it
 */
export async function resolveFallback(
  network: string,
  path: string,
  searchParams: URLSearchParams
): Promise<PolicyVcListResponse | VCDetail | null> {
  const isList = path === "entities/vc-documents"
  const isDetail = path.startsWith("entities/vc-documents/")
  if (!isList && !isDetail) return null

  // Cheap rejections happen before inflating the payload.
  const policyId = isList ? searchParams.get("analytics.policyId") : null
  if (isList && !policyId) return null

  const data = await loadSnapshot()

  if (isList) {
    const policy = data.policies[policyId!]
    if (!policy || policy.network !== network) return null
    return listResponse(policy, searchParams)
  }

  // Detail lookups are keyed by consensus timestamp, which is unique across
  // policies, so scan every snapshotted policy on this network.
  const consensusTimestamp = decodeURIComponent(path.slice("entities/vc-documents/".length))
  for (const policy of Object.values(data.policies)) {
    if (policy.network !== network) continue
    const doc = policy.documents[consensusTimestamp]
    if (doc) return doc
  }
  return null
}
