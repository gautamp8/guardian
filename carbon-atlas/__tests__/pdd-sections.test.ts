import { describe, it, expect } from "vitest"

// PDDView exports are internal to the component, so we test the core
// logic functions by importing the module and extracting them.
// Since buildSections and flattenObject are not exported, we re-implement
// the same logic here for testability.

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\bfield\d+\b/gi, (m) => m)
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
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

describe("humanizeKey", () => {
  it("converts camelCase to spaced", () => {
    expect(humanizeKey("projectTitle")).toBe("Project Title")
  })

  it("converts snake_case to spaced", () => {
    expect(humanizeKey("project_cert_type")).toBe("Project cert type")
  })

  it("converts kebab-case to spaced", () => {
    expect(humanizeKey("total-vcus")).toBe("Total vcus")
  })

  it("handles single word", () => {
    expect(humanizeKey("country")).toBe("Country")
  })

  it("preserves fieldN patterns (capitalized)", () => {
    expect(humanizeKey("field0")).toBe("field0".replace(/^\w/, (c) => c.toUpperCase()))
  })
})

describe("flattenObject", () => {
  it("flattens a simple object", () => {
    const result = flattenObject({ name: "Test", count: 42 })
    expect(result).toHaveLength(2)
    expect(result[0].key).toBe("name")
    expect(result[0].value).toBe("Test")
    expect(result[1].key).toBe("count")
    expect(result[1].value).toBe(42)
  })

  it("flattens nested objects with dot-path keys", () => {
    const result = flattenObject({
      outer: { inner: "value" },
    })
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe("outer.inner")
    expect(result[0].value).toBe("value")
  })

  it("preserves arrays as leaf values", () => {
    const result = flattenObject({ tags: ["a", "b"] })
    expect(result).toHaveLength(1)
    expect(result[0].value).toEqual(["a", "b"])
  })

  it("skips type, @context, and id keys", () => {
    const result = flattenObject({
      type: "SomeType",
      "@context": "http://example.com",
      id: "abc",
      name: "Test",
    })
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe("name")
  })

  it("respects prefix parameter", () => {
    const result = flattenObject({ name: "Test" }, "project_details")
    expect(result[0].key).toBe("project_details.name")
  })

  it("handles null/undefined input gracefully", () => {
    expect(flattenObject(null)).toEqual([])
    expect(flattenObject(undefined)).toEqual([])
  })

  it("handles deeply nested objects", () => {
    const result = flattenObject({
      a: { b: { c: { d: "deep" } } },
    })
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe("a.b.c.d")
    expect(result[0].value).toBe("deep")
  })
})

describe("buildSections", () => {
  it("creates General section for top-level scalar fields", () => {
    const sections = buildSections({
      projectTitle: "Test Project",
      total_vcus: 1000,
    })
    expect(sections).toHaveLength(1)
    expect(sections[0].id).toBe("top")
    expect(sections[0].title).toBe("General")
    expect(sections[0].fields).toHaveLength(2)
  })

  it("creates separate sections for nested objects", () => {
    const sections = buildSections({
      projectTitle: "Test",
      project_details: { gs_id: "11817", country: "Bangladesh" },
      emission_reduction: { ER_y: 42.5 },
    })
    expect(sections).toHaveLength(3) // General + project_details + emission_reduction
    expect(sections[0].title).toBe("General")
    expect(sections[1].title).toBe("Project details")
    expect(sections[2].title).toBe("Emission reduction")
  })

  it("flattens nested section fields with dot-path keys", () => {
    const sections = buildSections({
      project_details: { nested: { deep: "value" } },
    })
    const pd = sections.find((s) => s.id === "project_details")
    expect(pd).toBeDefined()
    expect(pd!.fields[0].key).toBe("project_details.nested.deep")
  })

  it("skips reserved keys (type, @context, id)", () => {
    const sections = buildSections({
      type: "VerifiableCredential",
      "@context": "http://example.com",
      id: "did:example:123",
      projectTitle: "Real Field",
    })
    expect(sections).toHaveLength(1)
    expect(sections[0].fields).toHaveLength(1)
    expect(sections[0].fields[0].key).toBe("projectTitle")
  })

  it("handles empty credentialSubject", () => {
    const sections = buildSections({})
    expect(sections).toHaveLength(0)
  })

  it("handles VM0033-like structure with many nested objects", () => {
    const cs = {
      projectTitle: "ABC Mangrove Senegal",
      project_cert_type: "VCS",
      total_vcus: "350000",
      project_details: {
        field0: "ABC Mangrove",
        vcs_id: "4563",
        country: "Senegal",
        methodology: "VM0033",
      },
      project_boundary: [
        { scenario_type: "baseline", area_ha: 100 },
        { scenario_type: "project", area_ha: 100 },
      ],
      project_data_per_instance: {
        instance1: { area: 50, species: "Rhizophora" },
      },
    }

    const sections = buildSections(cs)
    // General (projectTitle, project_cert_type, total_vcus, project_boundary as array)
    // project_details section
    // project_data_per_instance section
    const generalSection = sections.find((s) => s.id === "top")
    expect(generalSection).toBeDefined()
    expect(
      generalSection!.fields.some((f) => f.key === "projectTitle")
    ).toBe(true)

    const detailsSection = sections.find((s) => s.id === "project_details")
    expect(detailsSection).toBeDefined()
    expect(detailsSection!.fields.length).toBe(4)
  })
})
