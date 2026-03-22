import { fetchProxy } from "./client"
import type {
  PolicyVcListResponse,
  VCDetail,
  VCListItem,
  EntityType,
} from "@/lib/types/indexer"

export interface VcDocumentFilters {
  entityType?: EntityType
  documentStatus?: string
  pageIndex?: number
  pageSize?: number
  orderField?: string
  orderDir?: "ASC" | "DESC"
}

export interface PolicyParams {
  policyHederaId: string
  network: "testnet" | "mainnet"
}

export async function getVcDocuments(
  filters: VcDocumentFilters = {},
  policy?: PolicyParams
): Promise<PolicyVcListResponse> {
  const policyId =
    policy?.policyHederaId ?? process.env.NEXT_PUBLIC_POLICY_HEDERA_ID!
  const network = policy?.network ?? "testnet"

  const params: Record<string, string | number | undefined> = {
    "analytics.policyId": policyId,
    pageIndex: filters.pageIndex ?? 0,
    pageSize: filters.pageSize ?? 25,
    orderField: filters.orderField ?? "consensusTimestamp",
    orderDir: filters.orderDir ?? "DESC",
  }

  return fetchProxy<PolicyVcListResponse>(
    "entities/vc-documents",
    params,
    network
  )
}

export async function getVcDocument(
  consensusTimestamp: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<VCDetail> {
  return fetchProxy<VCDetail>(
    `entities/vc-documents/${consensusTimestamp}`,
    undefined,
    network
  )
}

export async function getAllPolicyVcs(
  entityType?: EntityType,
  policy?: PolicyParams
): Promise<VCListItem[]> {
  const PAGE_SIZE = 100
  const first = await getVcDocuments(
    { pageSize: PAGE_SIZE, pageIndex: 0 },
    policy
  )
  const total = first.total
  const allItems = [...first.items]

  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        getVcDocuments({ pageSize: PAGE_SIZE, pageIndex: i + 1 }, policy)
      )
    )
    for (const r of rest) allItems.push(...r.items)
  }

  if (entityType) {
    return allItems.filter((vc) => vc.options?.entityType === entityType)
  }
  return allItems
}

export function parseCredentialSubject<T = Record<string, unknown>>(
  vcDetail: VCDetail
): T | null {
  try {
    const docs = vcDetail.item.documents
    if (!docs?.length) return null
    const vcJson = JSON.parse(docs[0])
    return vcJson?.credentialSubject?.[0] ?? null
  } catch {
    return null
  }
}
