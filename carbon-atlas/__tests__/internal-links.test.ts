import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

// Every page lives under /policy/{slug}/..., so an internal link that forgets the
// prefix still type-checks, still builds, and only 404s when someone clicks it.
// This walks the source for static link targets and checks each one against the
// routes that actually exist in app/.

const ROOT = resolve(__dirname, "..")
const SOURCE_DIRS = ["app", "components", "hooks", "lib", "providers"]

function walk(dir: string, match: (path: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path, match))
    else if (match(path)) out.push(path)
  }
  return out
}

/** `app/policy/[slug]/devices/[messageId]/page.tsx` -> `/policy/[^/]+/devices/[^/]+` */
function collectRoutes(): RegExp[] {
  const appDir = join(ROOT, "app")
  return walk(appDir, (p) => /[\\/]page\.tsx$/.test(p)).map((file) => {
    const segments = relative(appDir, file)
      .split(/[\\/]/)
      .slice(0, -1)
      // route groups — (marketing) — do not appear in the URL
      .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
      .map((s) => (s.startsWith("[") ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    return new RegExp(`^/${segments.join("/")}$`)
  })
}

/** Static link targets: href="/x", href={`/x`}, router.push("/x"), router.push(`/x`) */
function collectLinkTargets(file: string): string[] {
  const source = readFileSync(file, "utf8")
  const targets: string[] = []
  const patterns = [
    /href=\{?["'`](\/[^"'`]*)["'`]\}?/g,
    /router\.(?:push|replace)\(\s*["'`](\/[^"'`]*)["'`]/g,
  ]
  for (const pattern of patterns) {
    for (const [, raw] of source.matchAll(pattern)) targets.push(raw)
  }
  return targets
}

const ASSET = /\.(png|jpe?g|svg|webp|ico|json|txt|xml|pdf|css|js)$/i

describe("internal links point at routes that exist", () => {
  const routes = collectRoutes()
  const files = SOURCE_DIRS.flatMap((dir) =>
    walk(join(ROOT, dir), (p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p))
  )

  it("finds the app's routes and source files", () => {
    expect(routes.length).toBeGreaterThan(5)
    expect(files.length).toBeGreaterThan(20)
  })

  it("has no link to a non-existent route", () => {
    const broken: string[] = []

    for (const file of files) {
      for (const target of collectLinkTargets(file)) {
        // strip query and hash, then substitute interpolations with a segment
        const path = target.split(/[?#]/)[0].replace(/\$\{[^{}]*\}/g, "x")
        // an expression too nested to resolve statically — skip rather than guess
        if (path.includes("${") || path.startsWith("/api/") || ASSET.test(path)) continue

        const normalised = path.length > 1 ? path.replace(/\/$/, "") : path
        if (!routes.some((route) => route.test(normalised))) {
          broken.push(`${relative(ROOT, file)}: ${target}`)
        }
      }
    }

    expect(broken).toEqual([])
  })
})
