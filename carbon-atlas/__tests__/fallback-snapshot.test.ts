import { describe, it, expect, beforeAll } from "vitest"
import { gunzipSync } from "node:zlib"
import { resolveFallback, getSnapshotGeneratedAt } from "@/lib/fallback/serve"
import base64 from "@/lib/fallback/snapshot-data.js"
import { POLICIES } from "@/lib/policies/registry"
import type { PolicyVcListResponse, VCDetail } from "@/lib/types/indexer"

const MECD_POLICY_ID = "1774178235.879591074"
const VM0033_POLICY_ID = "1768954927.914654000"

const params = (o: Record<string, string>) => new URLSearchParams(o)

interface SnapshotShape {
  policies: Record<
    string,
    {
      slug: string
      network: string
      items: {
        consensusTimestamp: string
        status?: string
        options: { entityType: string | null }
      }[]
      documents: Record<string, VCDetail>
      expectedDocuments?: number
      hydrated: number
    }
  >
}

let data: SnapshotShape

beforeAll(() => {
  data = JSON.parse(gunzipSync(Buffer.from(base64, "base64")).toString("utf8"))
})

describe("snapshot contents", () => {
  it("exposes a generation timestamp without inflating the payload", async () => {
    expect(Date.parse(await getSnapshotGeneratedAt())).not.toBeNaN()
  })

  it("covers every mainnet policy the registry declares", () => {
    for (const policy of POLICIES) {
      for (const [network, deployment] of Object.entries(policy.networks)) {
        // Only mainnet deployments are snapshotted; testnet is dev-only.
        if (network !== "mainnet") continue
        const entry = data.policies[deployment.policyHederaId]
        expect(entry, `${policy.slug}/${network} missing from snapshot`).toBeDefined()
        expect(entry.slug).toBe(policy.slug)
      }
    }
  })

  it("hydrates every row that should have a body", () => {
    for (const policy of Object.values(data.policies)) {
      // Revocation records are consensus messages with no document body.
      const revocations = policy.items.filter(i => i.status === "REVOKE").length
      expect(
        Object.keys(policy.documents).length,
        `${policy.slug} is missing document bodies`
      ).toBe(policy.items.length - revocations)
    }
  })

  it("labels the MECD mint token so the trust chain can show Credits Issued", () => {
    const types = data.policies[MECD_POLICY_ID].items.map(i => i.options.entityType)
    expect(types).toContain("mint_token")
    expect(types).toContain("approved_report")
    expect(types).toContain("daily_mrv_report")
  })

  it("keeps the MECD device records the dashboard counts", () => {
    const mecd = data.policies[MECD_POLICY_ID]
    const daily = Object.values(mecd.documents).find(
      d => d.item.options.entityType === "daily_mrv_report"
    )
    expect(daily).toBeDefined()
    const vc = JSON.parse(daily!.item.documents[0])
    expect(vc.credentialSubject[0].field0.length).toBeGreaterThan(3000)
  })

  it("keeps the VM0033 VCU estimate, whose IPFS pins have expired", () => {
    const vm = data.policies[VM0033_POLICY_ID]
    const form = Object.values(vm.documents).find(
      d => d.item.options.entityType === "project_form"
    )
    expect(form).toBeDefined()
    const cs = JSON.parse(form!.item.documents[0]).credentialSubject[0]
    const vcu = cs.project_data_per_instance?.[0]?.project_instance?.net_ERR
      ?.total_VCU_per_instance
    expect(vcu).toBeGreaterThan(0)
  })

  it("keeps VM0033 revocation rows, which drive the active-project count", () => {
    const vm = data.policies[VM0033_POLICY_ID]
    expect(vm.items.filter(i => i.status === "REVOKE").length).toBeGreaterThan(0)
    expect(vm.items.filter(i => i.options.entityType === "project_form").length).toBeGreaterThan(0)
  })

  it("stores document bodies as JSON strings, matching the indexer", () => {
    for (const detail of Object.values(data.policies[MECD_POLICY_ID].documents)) {
      expect(Array.isArray(detail.item.documents)).toBe(true)
      expect(() => JSON.parse(detail.item.documents[0])).not.toThrow()
    }
  })
})

describe("resolveFallback — list endpoint", () => {
  it("returns rows for a known policy", async () => {
    const res = (await resolveFallback(
      "mainnet",
      "entities/vc-documents",
      params({ "analytics.policyId": MECD_POLICY_ID, pageSize: "100" })
    )) as PolicyVcListResponse

    expect(res).not.toBeNull()
    expect(res.total).toBe(data.policies[MECD_POLICY_ID].items.length)
    expect(res.items.length).toBe(res.total)
  })

  it("paginates", async () => {
    const page = async (pageIndex: number) =>
      (await resolveFallback(
        "mainnet",
        "entities/vc-documents",
        params({
          "analytics.policyId": MECD_POLICY_ID,
          pageSize: "5",
          pageIndex: String(pageIndex),
        })
      )) as PolicyVcListResponse

    const first = await page(0)
    const second = await page(1)
    expect(first.items).toHaveLength(5)
    expect(second.items).toHaveLength(5)
    expect(first.items[0].consensusTimestamp).not.toBe(second.items[0].consensusTimestamp)
  })

  it("defaults to newest first and honours orderDir=ASC", async () => {
    const desc = (await resolveFallback(
      "mainnet",
      "entities/vc-documents",
      params({ "analytics.policyId": MECD_POLICY_ID, pageSize: "100" })
    )) as PolicyVcListResponse
    const asc = (await resolveFallback(
      "mainnet",
      "entities/vc-documents",
      params({ "analytics.policyId": MECD_POLICY_ID, pageSize: "100", orderDir: "ASC" })
    )) as PolicyVcListResponse

    expect(Number(desc.items[0].consensusTimestamp)).toBeGreaterThan(
      Number(desc.items[desc.items.length - 1].consensusTimestamp)
    )
    expect(asc.items[0].consensusTimestamp).toBe(
      desc.items[desc.items.length - 1].consensusTimestamp
    )
  })

  it("returns null for an unknown policy, a wrong network, or a missing policyId", async () => {
    expect(
      await resolveFallback(
        "mainnet",
        "entities/vc-documents",
        params({ "analytics.policyId": "0.0" })
      )
    ).toBeNull()
    expect(
      await resolveFallback(
        "testnet",
        "entities/vc-documents",
        params({ "analytics.policyId": MECD_POLICY_ID })
      )
    ).toBeNull()
    expect(await resolveFallback("mainnet", "entities/vc-documents", params({}))).toBeNull()
  })
})

describe("resolveFallback — detail endpoint", () => {
  it("returns a hydrated document with its body", async () => {
    const ts = Object.keys(data.policies[MECD_POLICY_ID].documents)[0]
    const res = (await resolveFallback(
      "mainnet",
      `entities/vc-documents/${ts}`,
      params({})
    )) as VCDetail

    expect(res).not.toBeNull()
    expect(res.item.consensusTimestamp).toBe(ts)
    expect(res.item.documents.length).toBeGreaterThan(0)
  })

  it("finds VM0033 documents too, not just the first policy", async () => {
    const ts = Object.keys(data.policies[VM0033_POLICY_ID].documents)[0]
    const res = (await resolveFallback(
      "mainnet",
      `entities/vc-documents/${ts}`,
      params({})
    )) as VCDetail
    expect(res?.item.consensusTimestamp).toBe(ts)
  })

  it("returns null for an unknown timestamp", async () => {
    expect(
      await resolveFallback("mainnet", "entities/vc-documents/1234567890.000000000", params({}))
    ).toBeNull()
  })
})

describe("resolveFallback — unsupported paths", () => {
  it("declines endpoints the snapshot does not mirror", async () => {
    for (const path of ["entities/vp-documents", "settings/network", "entities/tokens"]) {
      expect(await resolveFallback("mainnet", path, params({}))).toBeNull()
    }
  })
})
