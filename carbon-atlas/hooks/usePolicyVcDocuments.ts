"use client"

import { useQuery } from "@tanstack/react-query"
import { getAllPolicyVcs } from "@/lib/api/vc-documents"
import type { EntityType, PolicyVcListResponse, VCListItem } from "@/lib/types/indexer"
import { usePolicyMaybe } from "@/lib/policies/context"

/**
 * Fetch all policy VCs of a given entity type (client-side filtered) and cache
 * them. Uses the active policy from context for policyHederaId and network.
 */
export function useAllPolicyVcs(entityType?: EntityType) {
  const policy = usePolicyMaybe()

  const policyHederaId =
    policy?.policyHederaId ?? process.env.NEXT_PUBLIC_POLICY_HEDERA_ID!
  const network = policy?.network ?? "testnet"
  const slug = policy?.slug ?? "default"

  return useQuery<VCListItem[], Error>({
    queryKey: ["vc-documents-all", slug, entityType],
    queryFn: () =>
      getAllPolicyVcs(entityType, { policyHederaId, network }),
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

/**
 * Paginated slice over useAllPolicyVcs.
 * The indexer API ignores options.entityType filters, so we fetch all and
 * slice in-memory. The cache is shared with useAllPolicyVcs — no extra fetches.
 */
export function usePolicyVcDocuments(
  entityType?: EntityType,
  pageIndex = 0,
  pageSize = 25
) {
  const { data: allVcs, isLoading, error } = useAllPolicyVcs(entityType)

  const start = pageIndex * pageSize
  const items = allVcs?.slice(start, start + pageSize) ?? []
  const total = allVcs?.length ?? 0

  const data: PolicyVcListResponse | undefined = allVcs
    ? { items, total, pageIndex, pageSize }
    : undefined

  return { data, isLoading, error }
}
