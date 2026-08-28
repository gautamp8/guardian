/**
 * Offline fallback for the Guardian indexer.
 *
 * snapshot.json is rebuilt by scripts/build-fallback-snapshot.mjs from the
 * Hedera mirror node and the IPFS bodies the topic messages reference, so the
 * dashboard keeps rendering real on-chain data when the upstream indexer is
 * unreachable — an outage, or a lapsed MGS subscription.
 *
 * This is a read-only mirror of two endpoints. Anything else returns null and
 * the proxy surfaces the upstream error as before.
 */

import snapshot from "./snapshot.json"
import type { PolicyVcListResponse, VCDetail, VCListItem } from "@/lib/types/indexer"

interface SnapshotPolicy {
  slug: string
  network: string
  policyName: string
  instanceTopicId: string
  items: VCListItem[]
  documents: Record<string, VCDetail>
  hydrated: number
}

interface Snapshot {
  generatedAt: string
  source: string
  note: string
  policies: Record<string, SnapshotPolicy>
}

const data = snapshot as unknown as Snapshot

export const snapshotGeneratedAt = data.generatedAt

/** Marks a response as coming from the snapshot rather than the live indexer. */
export const FALLBACK_HEADER = "x-carbon-atlas-source"
export const FALLBACK_DATE_HEADER = "x-carbon-atlas-snapshot-date"

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
export function resolveFallback(
  network: string,
  path: string,
  searchParams: URLSearchParams
): PolicyVcListResponse | VCDetail | null {
  const listMatch = path === "entities/vc-documents"
  const detailMatch = path.startsWith("entities/vc-documents/")

  if (!listMatch && !detailMatch) return null

  if (listMatch) {
    const policyId = searchParams.get("analytics.policyId")
    if (!policyId) return null
    const policy = data.policies[policyId]
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
