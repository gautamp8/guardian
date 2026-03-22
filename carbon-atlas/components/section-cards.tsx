"use client"

import {
  IconCertificate,
  IconClipboardCheck,
  IconDevices,
  IconLeaf,
  IconLoader,
  IconSitemap,
} from "@tabler/icons-react"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { usePolicyMaybe } from "@/lib/policies/context"
import type { StatCardConfig } from "@/lib/policies/types"
import { useAllPolicyVcs } from "@/hooks/usePolicyVcDocuments"

const ICON_MAP: Record<string, React.ElementType> = {
  IconCertificate,
  IconLeaf,
  IconSitemap,
  IconDevices,
  IconClipboardCheck,
}

function formatValue(
  value: unknown,
  format?: "number" | "tco2e" | "text"
): string {
  if (value === undefined || value === null) return "—"
  if (format === "text") return String(value)
  const n = Number(value)
  if (isNaN(n)) return String(value)
  if (format === "tco2e") {
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
  }
  return n.toLocaleString("en-US")
}

function StatCard({
  config,
  stats,
  isLoading,
}: {
  config: StatCardConfig
  stats: Record<string, unknown>
  isLoading: boolean
}) {
  const Icon = ICON_MAP[config.icon] ?? IconCertificate
  const loadingEl = <IconLoader className="size-4 animate-spin text-muted-foreground" />

  // Get value based on source type
  const { data: entityVcs } = useAllPolicyVcs(
    config.source === "count" ? config.entityType : undefined
  )

  let value: unknown
  if (config.source === "count") {
    value = entityVcs?.length ?? 0
  } else if (config.valuePath) {
    value = stats[config.valuePath]
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon className={`size-4 ${config.iconColor ?? ""}`} />
          {config.label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {isLoading ? loadingEl : formatValue(value, config.format)}
        </CardTitle>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="text-muted-foreground">{config.description}</div>
      </CardFooter>
    </Card>
  )
}

export function SectionCards() {
  const policy = usePolicyMaybe()
  const stats = useDashboardStats()

  const cardConfigs = policy?.dashboard.statCards ?? [
    {
      key: "issuances",
      label: "Verified Issuances",
      description: "Approved monitoring reports on Hedera",
      icon: "IconCertificate",
      source: "count" as const,
      entityType: "approved_report" as const,
      format: "number" as const,
    },
    {
      key: "ery",
      label: "Projected Emission Reductions",
      description: "Total tCO₂e (including partial issuances)",
      icon: "IconLeaf",
      iconColor: "text-green-600",
      source: "computed" as const,
      valuePath: "totalERy",
      format: "tco2e" as const,
    },
    {
      key: "projects",
      label: "Active Projects",
      description: "Validated projects on Hedera",
      icon: "IconSitemap",
      source: "count" as const,
      entityType: "approved_project" as const,
      format: "number" as const,
    },
    {
      key: "devices",
      label: "Monitored Devices",
      description: "Cooking devices with metered energy data",
      icon: "IconDevices",
      source: "computed" as const,
      valuePath: "totalDevices",
      format: "number" as const,
    },
  ]

  const statsObj: Record<string, unknown> = {
    totalERy: stats.totalERy,
    totalDevices: stats.totalDevices,
    validationStage: stats.validationStage,
    issuanceCount: stats.issuanceCount,
    projectCount: stats.projectCount,
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cardConfigs.map((config) => (
        <StatCard
          key={config.key}
          config={config}
          stats={statsObj}
          isLoading={stats.isLoading}
        />
      ))}
    </div>
  )
}
