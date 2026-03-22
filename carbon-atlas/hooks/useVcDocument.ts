"use client"

import { useQuery } from "@tanstack/react-query"
import { getVcDocument } from "@/lib/api/vc-documents"
import type { VCDetail } from "@/lib/types/indexer"
import { usePolicyMaybe } from "@/lib/policies/context"

export function useVcDocument(id: string | undefined) {
  const policy = usePolicyMaybe()
  const network = policy?.network ?? "testnet"

  return useQuery<VCDetail, Error>({
    queryKey: ["vc-document", id, network],
    queryFn: () => getVcDocument(id!, network),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
