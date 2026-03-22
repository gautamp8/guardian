"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { IconChevronDown, IconChevronRight, IconSearch } from "@tabler/icons-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FieldGrid } from "@/components/shared/FieldDisplay"
import { formatRawVc } from "@/lib/utils/format"

interface PDDViewProps {
  cs: Record<string, unknown>
  rawDocuments?: string[]
  entityType: string
  schema?: Record<string, unknown>
}

interface FieldEntry {
  key: string
  label: string
  value: unknown
  sectionId: string
}

interface Section {
  id: string
  title: string
  fields: FieldEntry[]
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\bfield\d+\b/gi, (m) => m)
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function flattenObject(
  obj: unknown,
  prefix = "",
  sectionId = "general"
): FieldEntry[] {
  const entries: FieldEntry[] = []
  if (!obj || typeof obj !== "object") return entries

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === "type" || key === "@context" || key === "id") continue
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value && typeof value === "object" && !Array.isArray(value)) {
      entries.push(...flattenObject(value, fullKey, sectionId))
    } else {
      entries.push({
        key: fullKey,
        label: humanizeKey(key),
        value,
        sectionId,
      })
    }
  }
  return entries
}

function renderFieldValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 6 })
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    if (typeof value[0] === "object") {
      return (
        <span className="text-xs text-muted-foreground">
          [{value.length} items]
        </span>
      )
    }
    return value.join(", ")
  }
  const str = String(value)
  if (str.length > 300) {
    return <span className="text-sm">{str.slice(0, 300)}…</span>
  }
  return str
}

function CollapsibleSection({
  section,
  isExpanded,
  onToggle,
  searchQuery,
}: {
  section: Section
  isExpanded: boolean
  onToggle: () => void
  searchQuery: string
}) {
  const filteredFields = useMemo(() => {
    if (!searchQuery) return section.fields
    const q = searchQuery.toLowerCase()
    return section.fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        String(f.value).toLowerCase().includes(q)
    )
  }, [section.fields, searchQuery])

  if (searchQuery && filteredFields.length === 0) return null

  const showExpanded = isExpanded || (!!searchQuery && filteredFields.length > 0)

  return (
    <div className="rounded-lg border">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        {showExpanded ? (
          <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium flex-1">{section.title}</span>
        <Badge variant="outline" className="text-[10px] tabular-nums">
          {filteredFields.length}
          {searchQuery && filteredFields.length !== section.fields.length
            ? ` / ${section.fields.length}`
            : ""}
        </Badge>
      </button>
      {showExpanded && (
        <div className="border-t px-3 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {filteredFields.map((f) => (
              <div key={f.key} className="py-1">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="text-sm break-words">
                  {renderFieldValue(f.value)}
                </dd>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function buildSections(cs: Record<string, unknown>): Section[] {
  const sections: Section[] = []
  const topLevelFields: FieldEntry[] = []

  for (const [key, value] of Object.entries(cs)) {
    if (key === "type" || key === "@context" || key === "id") continue

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sectionTitle = humanizeKey(key)
      const fields = flattenObject(value, key, key)
      if (fields.length > 0) {
        sections.push({ id: key, title: sectionTitle, fields })
      }
    } else {
      topLevelFields.push({
        key,
        label: humanizeKey(key),
        value,
        sectionId: "top",
      })
    }
  }

  if (topLevelFields.length > 0) {
    sections.unshift({ id: "top", title: "General", fields: topLevelFields })
  }

  return sections
}

function KeyInfoTab({ cs }: { cs: Record<string, unknown> }) {
  const projectTitle = cs.projectTitle as string | undefined
  const certType = cs.project_cert_type as string | undefined
  const totalVcus = cs.total_vcus as string | number | undefined
  const registryId =
    (cs.vcs_id as string) ??
    (cs.gs_id as string) ??
    (cs.registry_id as string) ??
    null

  const pd = cs.project_details as Record<string, unknown> | undefined
  const projectName = pd?.field0 as string | undefined

  const fields = [
    { label: "Project Title", value: projectTitle ?? projectName ?? "—" },
    ...(registryId ? [{ label: "Registry ID", value: registryId }] : []),
    { label: "Certification Type", value: certType ?? "—" },
    { label: "Estimated VCUs", value: totalVcus != null ? String(totalVcus) : "—" },
  ]

  return <FieldGrid fields={fields} cols={2} />
}

function BoundaryTab({ cs }: { cs: Record<string, unknown> }) {
  const boundary = cs.project_boundary as unknown

  if (!boundary || !Array.isArray(boundary)) {
    const boundaryObj = cs.project_boundary as Record<string, unknown> | undefined
    if (!boundaryObj) {
      return <p className="text-sm text-muted-foreground">No project boundary data available.</p>
    }
    const fields = flattenObject(boundaryObj, "", "boundary")
    return <FieldGrid fields={fields.map((f) => ({ label: f.label, value: renderFieldValue(f.value) }))} cols={2} />
  }

  return (
    <div className="space-y-6">
      {(boundary as Record<string, unknown>[]).map((item, idx) => {
        const fields = flattenObject(item, "", `boundary-${idx}`)
        return (
          <div key={idx}>
            <h4 className="text-sm font-medium mb-2">
              {(item.scenario_type as string) ?? `Scenario ${idx + 1}`}
            </h4>
            <FieldGrid
              fields={fields.map((f) => ({
                label: f.label,
                value: renderFieldValue(f.value),
              }))}
              cols={2}
            />
          </div>
        )
      })}
    </div>
  )
}

export function PDDView({ cs, rawDocuments }: PDDViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["top"])
  )

  const sections = useMemo(() => buildSections(cs), [cs])

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <Tabs defaultValue="key">
      <TabsList>
        <TabsTrigger value="key">Key Info</TabsTrigger>
        <TabsTrigger value="pdd">Full PDD</TabsTrigger>
        <TabsTrigger value="boundary">Boundary</TabsTrigger>
        {rawDocuments && <TabsTrigger value="raw">Raw VC</TabsTrigger>}
      </TabsList>

      <TabsContent value="key" className="pt-4">
        <KeyInfoTab cs={cs} />
      </TabsContent>

      <TabsContent value="pdd" className="pt-4 space-y-3">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search fields by name or value…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {sections.reduce((sum, s) => sum + s.fields.length, 0)} fields across {sections.length} sections
        </p>
        <div className="space-y-2">
          {sections.map((section) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="boundary" className="pt-4">
        <BoundaryTab cs={cs} />
      </TabsContent>

      {rawDocuments && (
        <TabsContent value="raw" className="pt-4">
          <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-96">
            {formatRawVc(rawDocuments[0])}
          </pre>
        </TabsContent>
      )}
    </Tabs>
  )
}
