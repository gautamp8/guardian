import type { PolicyConfig } from "./types"
import { mecd } from "./mecd"
import { vm0033 } from "./vm0033"

export const POLICIES: PolicyConfig[] = [mecd, vm0033]

export const POLICY_MAP = new Map(POLICIES.map((p) => [p.slug, p]))

export function getPolicyBySlug(slug: string): PolicyConfig | undefined {
  return POLICY_MAP.get(slug)
}

export function getPoliciesByNetwork(network: "testnet" | "mainnet"): PolicyConfig[] {
  return POLICIES.filter((p) => p.network === network)
}

export function getDefaultPolicyForNetwork(network: "testnet" | "mainnet"): PolicyConfig {
  return getPoliciesByNetwork(network)[0] ?? mecd
}
