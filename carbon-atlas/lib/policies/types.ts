import type { ComponentType } from "react"
import type { EntityType } from "@/lib/types/indexer"

export interface RendererProps {
  cs: Record<string, unknown>
  rawDocuments?: string[]
  entityType: string
  schema?: Record<string, unknown>
}

export interface StatCardConfig {
  key: string
  label: string
  description: string
  icon: string
  iconColor?: string
  source: "count" | "computed"
  entityType?: EntityType
  valuePath?: string
  format?: "number" | "tco2e" | "text"
}

export type ChartSlot = "emission-timeline" | "device-map" | "project-overview" | "none"

export interface PolicyConfig {
  slug: string
  name: string
  fullName: string
  standard: string
  description: string
  network: "testnet" | "mainnet"
  policyHederaId: string

  links: {
    methodology: string
    hederaPolicy: string
  }

  projectDeveloper?: {
    name: string
    url: string
    logoDark: string
    logoLight: string
  }

  dashboard: {
    statCards: StatCardConfig[]
    charts: ChartSlot[]
  }

  statsExtractors: {
    eryPath?: string
    deviceCountPath?: string
    periodPath?: string
  }

  renderers?: Partial<Record<string, ComponentType<RendererProps>>>
}
