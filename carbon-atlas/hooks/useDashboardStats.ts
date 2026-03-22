"use client"

import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import { useAllPolicyVcs } from "./usePolicyVcDocuments"
import { getVcDocument, parseCredentialSubject } from "@/lib/api/vc-documents"
import { usePolicyMaybe } from "@/lib/policies/context"

/** Safely traverse nested path like "emission_reduction.ER_y" */
function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj)
}

/** Parse a date string that may be ISO, DD/MM/YYYY, or MM/DD/YYYY into YYYY-MM-DD. */
function normalizeDate(value: string | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d.toISOString().split("T")[0]
  const parts = value.split("/")
  if (parts.length === 3) {
    const [a, b, c] = parts
    const year = c.length === 4 ? c : a.length === 4 ? a : null
    if (year) {
      const month = c.length === 4 ? b : (a.length === 4 ? b : a)
      const day = c.length === 4 ? a : c
      const d2 = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
      if (!isNaN(d2.getTime())) return d2.toISOString().split("T")[0]
    }
  }
  return null
}

export interface IssuanceDataPoint {
  date: string
  label: string
  ery: number
  devices: number
  cumulativeEry: number
  cumulativeDevices: number
}

export function useDashboardStats() {
  const policy = usePolicyMaybe()
  const network = policy?.network ?? "testnet"
  const extractors = policy?.statsExtractors ?? {
    eryPath: "emission_reduction.ER_y",
    deviceCountPath: "project_emission_electricity.total_usage.number_of_devices",
    periodPath: "monitoring_period.to",
  }

  const { data: approvedReports, isLoading: loadingAR } = useAllPolicyVcs("approved_report")
  const { data: projects, isLoading: loadingProj } = useAllPolicyVcs("approved_project")
  const { data: projectForms, isLoading: loadingPF } = useAllPolicyVcs("project_form")
  const { data: mrvReports, isLoading: loadingMRV } = useAllPolicyVcs("daily_mrv_report")

  // Fetch detail for each approved_report to get ER_y and device count
  const detailQueries = useQueries({
    queries: (approvedReports ?? []).map((vc) => ({
      queryKey: ["vc-document", vc.consensusTimestamp, network],
      queryFn: () => getVcDocument(vc.consensusTimestamp, network),
      staleTime: 15 * 60 * 1000,
      enabled: !!approvedReports,
    })),
  })

  // Fetch detail for MRV reports as fallback for device count
  const mrvDetailQueries = useQueries({
    queries: (mrvReports ?? []).map((vc) => ({
      queryKey: ["vc-document", vc.consensusTimestamp, network],
      queryFn: () => getVcDocument(vc.consensusTimestamp, network),
      staleTime: 15 * 60 * 1000,
      enabled: !!mrvReports,
    })),
  })

  const loadingDetails = detailQueries.some((q) => q.isLoading)
  const loadingMrvDetails = mrvDetailQueries.some((q) => q.isLoading)

  const reportData = useMemo(() => {
    if (!extractors.eryPath) return null
    if (loadingDetails || detailQueries.length === 0) return null

    let totalERy = 0
    let totalDevices = 0
    const points: { date: string; label: string; ery: number; devices: number }[] = []

    for (let i = 0; i < detailQueries.length; i++) {
      const q = detailQueries[i]
      if (!q.data) continue
      const cs = parseCredentialSubject(q.data)
      if (!cs) continue

      const ery = extractors.eryPath ? get(cs, extractors.eryPath) : undefined
      const numDevices = extractors.deviceCountPath ? get(cs, extractors.deviceCountPath) : undefined
      const field0 = get(cs, "project_emission_electricity.total_usage.field0")
      const periodTo = extractors.periodPath ? get(cs, extractors.periodPath) as string | undefined : undefined

      const eryVal = typeof ery === "number" ? ery : 0
      const devVal = typeof numDevices === "number"
        ? numDevices
        : Array.isArray(field0) ? field0.length : 0

      totalERy += eryVal
      totalDevices += devVal

      const ts = approvedReports?.[i]?.consensusTimestamp ?? ""
      const tsSeconds = parseInt(ts.split(".")[0], 10)
      const tsFallback = isNaN(tsSeconds) ? "" : new Date(tsSeconds * 1000).toISOString().split("T")[0]
      const date = normalizeDate(periodTo as string) ?? tsFallback
      const dateObj = date ? new Date(date) : null
      const label = dateObj && !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "—"

      points.push({ date, label, ery: eryVal, devices: devVal })
    }

    return { totalERy, totalDevices, points }
  }, [loadingDetails, detailQueries, approvedReports, extractors])

  const mrvDeviceCount = useMemo(() => {
    if (loadingMrvDetails || mrvDetailQueries.length === 0) return 0
    let count = 0
    for (const q of mrvDetailQueries) {
      if (!q.data) continue
      const cs = parseCredentialSubject(q.data)
      if (!cs) continue
      const field0 = Array.isArray((cs as Record<string, unknown>).field0)
        ? (cs as Record<string, unknown>).field0
        : get(cs, "project_emission_electricity.total_usage.field0")
      if (Array.isArray(field0)) count += (field0 as unknown[]).length
    }
    return count
  }, [loadingMrvDetails, mrvDetailQueries])

  const totalDevices = reportData?.totalDevices || mrvDeviceCount || null

  const chartData = useMemo((): IssuanceDataPoint[] => {
    if (!reportData?.points.length) return []
    const sorted = [...reportData.points].sort((a, b) => a.date.localeCompare(b.date))
    let cumEry = 0
    let cumDev = 0
    return sorted.map((p) => {
      cumEry += p.ery
      cumDev += p.devices
      return { ...p, cumulativeEry: cumEry, cumulativeDevices: cumDev }
    })
  }, [reportData])

  // Compute validation stage for policies without issuances
  const validationStage = useMemo(() => {
    if ((approvedReports?.length ?? 0) > 0) return "Issued"
    if ((projects?.length ?? 0) > 0) return "Validated"
    if ((projectForms?.length ?? 0) > 0) return "Submitted"
    return "No Projects"
  }, [approvedReports, projects, projectForms])

  return {
    issuanceCount: approvedReports?.length ?? 0,
    projectCount: (projects?.length ?? 0) + (projectForms?.length ?? 0),
    mrvBatchCount: mrvReports?.length ?? 0,
    totalERy: reportData?.totalERy ?? null,
    totalDevices,
    chartData,
    validationStage,
    isLoading: loadingAR || loadingProj || loadingPF || loadingMRV || loadingDetails || loadingMrvDetails,
  }
}
