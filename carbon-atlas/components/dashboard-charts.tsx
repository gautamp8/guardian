"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { IconLoader } from "@tabler/icons-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { DeviceMap } from "@/components/device-map"
import { useDashboardStats, type IssuanceDataPoint } from "@/hooks/useDashboardStats"
import { usePolicyMaybe } from "@/lib/policies/context"
import { useAllPolicyVcs } from "@/hooks/usePolicyVcDocuments"

const chartConfig = {
  ery: {
    label: "Projected Emission Reductions (tCO₂e)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const START_YEAR = 2021

function buildTimelineData(raw: IssuanceDataPoint[]) {
  const currentYear = new Date().getFullYear()
  const endYear = Math.max(currentYear + 1, START_YEAR + 5)

  const points: { year: number; label: string; ery: number }[] = []

  for (let y = START_YEAR; y <= endYear; y++) {
    const yearIssuances = raw.filter(
      (d) => new Date(d.date).getFullYear() === y
    )
    const yearEry = yearIssuances.reduce((sum, d) => sum + d.ery, 0)
    points.push({
      year: y,
      label: String(y),
      ery: yearEry,
    })
  }

  return points
}

function IssuanceChart({ data }: { data: IssuanceDataPoint[] }) {
  const timelineData = buildTimelineData(data)

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Projected Emission Reductions Over Time</CardTitle>
        <CardDescription>tCO₂e per year from approved monitoring reports (partial issuances)</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[260px] w-full"
        >
          <BarChart data={timelineData} barCategoryGap="25%">
            <defs>
              <linearGradient id="fillEry" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-ery)"
                  stopOpacity={0.9}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-ery)"
                  stopOpacity={0.4}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString()
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const item = payload?.[0]?.payload
                    return item ? `Year ${item.label}` : ""
                  }}
                  formatter={(value) => {
                    const n = Number(value)
                    if (n === 0) {
                      return (
                        <span className="text-muted-foreground text-xs">
                          No issuances
                        </span>
                      )
                    }
                    return (
                      <span className="font-mono font-medium">
                        {n.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO₂e
                      </span>
                    )
                  }}
                  indicator="dot"
                />
              }
            />
            <Bar
              dataKey="ery"
              fill="url(#fillEry)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function ProjectOverviewChart() {
  const { data: projectForms } = useAllPolicyVcs("project_form")
  const { data: projects } = useAllPolicyVcs("project")
  const { data: validationReports } = useAllPolicyVcs("validation_report")
  const { data: approvedProjects } = useAllPolicyVcs("approved_project")

  const stages = [
    { label: "PDD Submitted", count: projectForms?.length ?? 0, color: "bg-amber-500" },
    { label: "Registered", count: projects?.length ?? 0, color: "bg-orange-500" },
    { label: "Validation", count: validationReports?.length ?? 0, color: "bg-sky-500" },
    { label: "Validated", count: approvedProjects?.length ?? 0, color: "bg-green-500" },
  ]

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Project Lifecycle</CardTitle>
        <CardDescription>Current status of projects in the validation pipeline</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage) => (
            <div key={stage.label} className="flex items-center gap-3">
              <div className={`size-3 rounded-full ${stage.color}`} />
              <span className="text-sm flex-1">{stage.label}</span>
              <span className="text-sm font-semibold tabular-nums">{stage.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardCharts() {
  const policy = usePolicyMaybe()
  const { chartData, isLoading } = useDashboardStats()

  const chartSlots = policy?.dashboard.charts ?? ["emission-timeline", "device-map"]

  if (chartSlots.length === 1 && chartSlots[0] === "none") return null

  if (isLoading && chartSlots.includes("emission-timeline")) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center h-[340px]">
              <IconLoader className="size-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 gap-4 px-4 lg:px-6 ${chartSlots.length > 1 ? "@xl/main:grid-cols-2" : ""}`}>
      {chartSlots.map((slot) => {
        switch (slot) {
          case "emission-timeline":
            return <IssuanceChart key={slot} data={chartData} />
          case "device-map":
            return <DeviceMap key={slot} />
          case "project-overview":
            return <ProjectOverviewChart key={slot} />
          default:
            return null
        }
      })}
    </div>
  )
}
