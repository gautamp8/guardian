import { describe, it, expect } from "vitest"
import { POLICIES, POLICY_MAP, getPolicyBySlug, getPoliciesByNetwork, getDefaultPolicyForNetwork } from "@/lib/policies/registry"
import { mecd } from "@/lib/policies/mecd"
import { vm0033 } from "@/lib/policies/vm0033"

describe("Policy Registry", () => {
  it("exports all registered policies", () => {
    expect(POLICIES).toHaveLength(2)
    expect(POLICIES.map((p) => p.slug)).toEqual(["mecd", "vm0033"])
  })

  it("POLICY_MAP keys match slugs", () => {
    expect(POLICY_MAP.size).toBe(2)
    expect(POLICY_MAP.has("mecd")).toBe(true)
    expect(POLICY_MAP.has("vm0033")).toBe(true)
  })

  it("getPolicyBySlug returns correct policy", () => {
    expect(getPolicyBySlug("mecd")).toBe(mecd)
    expect(getPolicyBySlug("vm0033")).toBe(vm0033)
  })

  it("getPolicyBySlug returns undefined for unknown slug", () => {
    expect(getPolicyBySlug("unknown")).toBeUndefined()
    expect(getPolicyBySlug("")).toBeUndefined()
  })

  it("getPoliciesByNetwork filters correctly", () => {
    const testnetPolicies = getPoliciesByNetwork("testnet")
    const mainnetPolicies = getPoliciesByNetwork("mainnet")
    expect(testnetPolicies.every((p) => p.network === "testnet")).toBe(true)
    expect(mainnetPolicies.every((p) => p.network === "mainnet")).toBe(true)
    expect(testnetPolicies.length + mainnetPolicies.length).toBe(POLICIES.length)
  })

  it("getDefaultPolicyForNetwork returns first policy for each network", () => {
    expect(getDefaultPolicyForNetwork("testnet").slug).toBe("mecd")
    expect(getDefaultPolicyForNetwork("mainnet").slug).toBe("vm0033")
  })
})

describe("MECD Policy Config", () => {
  it("has required fields", () => {
    expect(mecd.slug).toBe("mecd")
    expect(mecd.name).toBe("MECD v1.2")
    expect(mecd.standard).toBe("Gold Standard")
    expect(mecd.network).toBe("testnet")
    expect(mecd.policyHederaId).toBe("1767599197.624837133")
  })

  it("has dashboard stat cards configured", () => {
    expect(mecd.dashboard.statCards).toHaveLength(4)
    const keys = mecd.dashboard.statCards.map((c) => c.key)
    expect(keys).toContain("issuances")
    expect(keys).toContain("ery")
    expect(keys).toContain("projects")
    expect(keys).toContain("devices")
  })

  it("has chart slots configured", () => {
    expect(mecd.dashboard.charts).toEqual(["emission-timeline", "device-map"])
  })

  it("has stats extractors for ER, devices, period", () => {
    expect(mecd.statsExtractors.eryPath).toBe("emission_reduction.ER_y")
    expect(mecd.statsExtractors.deviceCountPath).toBeTruthy()
    expect(mecd.statsExtractors.periodPath).toBeTruthy()
  })

  it("has external links", () => {
    expect(mecd.links.methodology).toContain("goldstandard.org")
    expect(mecd.links.hederaPolicy).toContain("guardian.hedera.com")
  })

  it("has project developer info", () => {
    expect(mecd.projectDeveloper?.name).toBe("ATEC Global")
    expect(mecd.projectDeveloper?.logoDark).toBeTruthy()
    expect(mecd.projectDeveloper?.logoLight).toBeTruthy()
  })
})

describe("VM0033 Policy Config", () => {
  it("has required fields", () => {
    expect(vm0033.slug).toBe("vm0033")
    expect(vm0033.name).toBe("VM0033")
    expect(vm0033.standard).toBe("Verra")
    expect(vm0033.network).toBe("mainnet")
    expect(vm0033.policyHederaId).toBe("1768954927.914654000")
  })

  it("has dashboard stat cards configured", () => {
    expect(vm0033.dashboard.statCards.length).toBeGreaterThan(0)
    const keys = vm0033.dashboard.statCards.map((c) => c.key)
    expect(keys).toContain("projects")
    expect(keys).toContain("issuances")
  })

  it("has project-overview chart slot", () => {
    expect(vm0033.dashboard.charts).toContain("project-overview")
  })

  it("has empty statsExtractors (no ER data yet)", () => {
    expect(vm0033.statsExtractors.eryPath).toBeUndefined()
    expect(vm0033.statsExtractors.deviceCountPath).toBeUndefined()
  })

  it("has external links", () => {
    expect(vm0033.links.methodology).toContain("verra.org")
    expect(vm0033.links.hederaPolicy).toContain("guardian.hedera.com")
  })

  it("has project developer info", () => {
    expect(vm0033.projectDeveloper?.name).toBe("Allcot")
  })
})
