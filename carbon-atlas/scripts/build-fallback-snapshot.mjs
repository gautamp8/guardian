#!/usr/bin/env node
/**
 * Rebuilds the offline fallback snapshot served by app/api/proxy when the
 * upstream Guardian indexer is unreachable (outage, or a lapsed MGS
 * subscription).
 *
 * The row skeleton always comes from public sources, so the snapshot can be
 * rebuilt with no Guardian credentials at all:
 *
 *   policyHederaId ─(mirror: transactions)→ registry topic
 *                  ─(mirror: message)→ instanceTopicId
 *                  ─(mirror: BFS over child topics)→ VC-Document messages
 *
 * The topic message already carries entityType, documentStatus, issuer,
 * relationships and ISSUE/REVOKE status — everything the indexer puts in
 * options.* — so the rows match the real API response field for field.
 *
 * Document bodies are hydrated from the first source that has them:
 *
 *   1. the live indexer   — authoritative, and the ONLY source for documents
 *                           whose IPFS pins have expired (VM0033's have)
 *   2. IPFS               — public, needs no subscription
 *   3. the previous snapshot — so a run without a subscription can never
 *                           discard bodies an earlier run already captured
 *
 * That third source is the important one: rebuilding while MGS is down must
 * degrade to "no new documents", never to "lost the ones we had".
 *
 * Usage:
 *   node scripts/build-fallback-snapshot.mjs              # all sources
 *   node scripts/build-fallback-snapshot.mjs --no-indexer # public sources only
 *   node scripts/build-fallback-snapshot.mjs --policy mecd
 *
 * Credentials are read from .env.local / .env (same variables the app uses):
 * GUARDIAN_API_URL, GUARDIAN_EMAIL, GUARDIAN_PASSWORD, GUARDIAN_USER_ID and
 * INDEXER_API_BASE_URL (or INDEXER_API_URL). Missing or broken credentials just
 * drop the script to the public sources.
 *
 * Output: lib/fallback/snapshot.json
 */

import { writeFile, mkdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { gzipSync, gunzipSync } from "node:zlib"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")

/**
 * The snapshot ships gzipped-and-base64'd inside a JS module rather than as a
 * plain .json. VM0033's PDDs carry 40-year projection tables, so the raw JSON is
 * ~17 MB; gzipped it is ~2.3 MB. A module is guaranteed to be bundled into the
 * serverless function (no output-file-tracing config to get wrong), and
 * serve.ts imports it lazily so the live path never pays to parse it.
 */
const OUT_PATH = resolve(ROOT, "lib/fallback/snapshot-data.js")

/**
 * Policies to snapshot. policyHederaId must match lib/policies/*.ts — it is the
 * value the client sends as the analytics.policyId query param, and therefore
 * the key the proxy looks the snapshot up by.
 */
const TARGETS = [
  { slug: "mecd", network: "mainnet", policyHederaId: "1774178235.879591074" },
  { slug: "vm0033", network: "mainnet", policyHederaId: "1768954927.914654000" },
]

const MIRROR = {
  mainnet: "https://mainnet.mirrornode.hedera.com/api/v1",
  testnet: "https://testnet.mirrornode.hedera.com/api/v1",
}

// Ordered by observed reliability — ipfs.io and cloudflare currently time out.
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://dweb.link/ipfs",
  "https://ipfs.io/ipfs",
]

const args = process.argv.slice(2)
const onlyPolicy = args.includes("--policy") ? args[args.indexOf("--policy") + 1] : null
const noIndexer = args.includes("--no-indexer")
const quiet = args.includes("--quiet")
const log = (...a) => !quiet && console.log(...a)

// ── env ──────────────────────────────────────────────────────────────────────

/** Minimal .env reader — the app gets these via Next, standalone scripts don't. */
async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    let text
    try {
      text = await readFile(resolve(ROOT, file), "utf8")
    } catch {
      continue
    }
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      const [, key, rawValue] = m
      if (process.env[key] !== undefined) continue
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "")
    }
  }
}

// ── http ─────────────────────────────────────────────────────────────────────

async function getJson(url, { attempts = 4, timeoutMs = 30_000, headers } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ac.signal, headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      // Back off before retrying; gateways are flaky under load.
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`GET ${url} failed after ${attempts} attempts: ${lastErr?.message}`)
}

// ── indexer ──────────────────────────────────────────────────────────────────

/**
 * The MGS SSO chain, mirroring lib/api/auth.ts:
 *   loginByEmail → access-token → sso/generate
 * Returns null when credentials are absent or the chain fails, so callers can
 * silently drop to the public sources.
 */
async function createIndexerClient() {
  const apiUrl = process.env.GUARDIAN_API_URL
  const email = process.env.GUARDIAN_EMAIL
  const password = process.env.GUARDIAN_PASSWORD
  const userId = process.env.GUARDIAN_USER_ID
  const indexerUrl = process.env.INDEXER_API_BASE_URL ?? process.env.INDEXER_API_URL

  if (!apiUrl || !email || !password || !indexerUrl) {
    log("  indexer: no credentials configured — using public sources only")
    return null
  }

  const postJson = async (path, body, token) => {
    const res = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
    return res.json()
  }

  try {
    const login = await postJson("/accounts/loginByEmail", {
      email,
      password,
      ...(userId ? { userId } : {}),
    })
    const refreshToken = login.login?.refreshToken ?? login.refreshToken
    if (!refreshToken) throw new Error("login response had no refreshToken")

    const { accessToken } = await postJson("/accounts/access-token", { refreshToken })
    const sso = await postJson(
      "/accounts/sso/generate",
      { callbackUrl: `https://${new URL(indexerUrl).host}/sso` },
      accessToken
    )
    const token = sso.token ?? sso.accessToken
    if (!token) throw new Error("sso/generate response had no token")

    log("  indexer: authenticated")
    return {
      async getDocument(consensusTimestamp, network) {
        return getJson(`${indexerUrl}/${network}/entities/vc-documents/${consensusTimestamp}`, {
          attempts: 2,
          timeoutMs: 45_000,
          headers: { Authorization: `Bearer ${token}` },
        })
      },
    }
  } catch (err) {
    log(`  indexer: auth failed (${err.message}) — using public sources only`)
    return null
  }
}

// ── mirror node ──────────────────────────────────────────────────────────────

function decodeMessage(m) {
  try {
    return JSON.parse(Buffer.from(m.message, "base64").toString("utf8"))
  } catch {
    return null
  }
}

/** Walk mirror-node pagination and return every message on a topic. */
async function fetchTopicMessages(mirror, topicId) {
  const out = []
  let path = `/topics/${topicId}/messages?limit=100&order=asc`
  while (path) {
    const page = await getJson(`${mirror}${path}`)
    out.push(...(page.messages ?? []))
    // links.next is returned as an absolute API path including /api/v1
    const next = page.links?.next
    path = next ? next.replace("/api/v1", "") : null
  }
  return out
}

/** policyHederaId is the consensus timestamp of the publish-policy message. */
async function resolveInstanceTopic(mirror, policyHederaId) {
  const tx = await getJson(`${mirror}/transactions?timestamp=${policyHederaId}`)
  const registryTopic = tx.transactions?.[0]?.entity_id
  if (!registryTopic) throw new Error(`No transaction found at ${policyHederaId}`)

  const msgs = await getJson(
    `${mirror}/topics/${registryTopic}/messages?timestamp=${policyHederaId}&limit=1`
  )
  const decoded = decodeMessage(msgs.messages?.[0] ?? {})
  if (!decoded?.instanceTopicId) {
    throw new Error(`Publish message at ${policyHederaId} has no instanceTopicId`)
  }
  return { registryTopic, instanceTopicId: decoded.instanceTopicId, policyName: decoded.name }
}

/**
 * Collect every VC document under a policy by walking the instance topic and
 * the dynamic child topics it spawns.
 */
async function crawlTopics(mirror, rootTopicId) {
  const seen = new Set()
  const queue = [rootTopicId]
  const docs = []

  while (queue.length) {
    const topicId = queue.shift()
    if (seen.has(topicId)) continue
    seen.add(topicId)

    const messages = await fetchTopicMessages(mirror, topicId)
    log(`    topic ${topicId}: ${messages.length} messages`)

    for (const m of messages) {
      const body = decodeMessage(m)
      if (!body) continue

      if (body.type === "Topic" && body.childId) {
        queue.push(body.childId)
        continue
      }
      // VP documents live behind entities/vp-documents upstream, which the app
      // never calls — including them here would inflate the list response.
      if (body.type === "VC-Document") {
        docs.push({ topicId, consensusTimestamp: m.consensus_timestamp, body })
      }
    }
  }
  return { docs, topics: [...seen] }
}

// ── assembly ─────────────────────────────────────────────────────────────────

/**
 * The indexer exposes Mongo ObjectIds. Nothing in the UI resolves them against
 * the upstream API — they are only used as React keys — so a deterministic hash
 * of the consensus timestamp keeps ids stable across regenerations.
 */
function syntheticId(consensusTimestamp) {
  return createHash("sha1").update(consensusTimestamp).digest("hex").slice(0, 24)
}

function toListItem(doc, policyHederaId) {
  const { body, topicId, consensusTimestamp } = doc
  return {
    id: syntheticId(consensusTimestamp),
    uuid: body.id,
    consensusTimestamp,
    topicId,
    status: body.status,
    action: body.action,
    options: {
      entityType: body.entityType ?? null,
      relationships: body.relationships ?? [],
      documentStatus: body.documentStatus ?? "",
      issuer: body.issuer ?? "",
    },
    analytics: {
      policyId: policyHederaId,
      schemaId: body.schema ?? "",
      schemaName: "",
    },
    files: body.cid ? [body.cid] : [],
  }
}

async function fetchIpfs(cid) {
  let lastErr
  for (const gw of IPFS_GATEWAYS) {
    try {
      return await getJson(`${gw}/${cid}`, { attempts: 2, timeoutMs: 45_000 })
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`IPFS fetch failed for ${cid}: ${lastErr?.message}`)
}

/** Run tasks with bounded concurrency so gateways don't rate-limit us. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Revocation records are consensus messages, not documents — they carry no cid
 * and the indexer returns no body for them. They belong in the list (the client
 * uses status === "REVOKE" to exclude revoked projects) but must not be counted
 * as a hydration failure.
 */
function isRevocation(doc) {
  return doc.body.action === "revoke-document" || doc.body.status === "REVOKE"
}

/**
 * Token-mint VCs carry no entityType on-chain, and the indexer does not label
 * them either. Without this the trust chain loses its "Credits Issued" step, so
 * infer it from the credential subject regardless of which source supplied the
 * body.
 */
function inferEntityType(item, rawBody) {
  if (item.options.entityType) return
  let vc
  try {
    vc = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody
  } catch {
    return
  }
  const subject = vc?.credentialSubject?.[0] ?? vc?.credentialSubject ?? {}
  if (subject.tokenId && subject.amount !== undefined) {
    item.options.entityType = "mint_token"
    if (!item.analytics.schemaName) item.analytics.schemaName = "MintToken"
  }
}

async function buildPolicy(target, indexer, previous) {
  const mirror = MIRROR[target.network]
  log(`\n▶ ${target.slug} (${target.network}) — policyId ${target.policyHederaId}`)

  const { instanceTopicId, policyName } = await resolveInstanceTopic(mirror, target.policyHederaId)
  log(`  instance topic: ${instanceTopicId}  «${policyName}»`)

  const { docs, topics } = await crawlTopics(mirror, instanceTopicId)
  log(`  ${docs.length} VC documents across ${topics.length} topics`)

  const items = docs.map(d => toListItem(d, target.policyHederaId))
  const prior = previous?.policies?.[target.policyHederaId]?.documents ?? {}

  const documents = {}
  const sources = { indexer: 0, ipfs: 0, previous: 0, revocation: 0, missing: 0 }

  await mapLimit(docs, 4, async (doc, i) => {
    const item = items[i]
    const ts = doc.consensusTimestamp

    if (isRevocation(doc)) {
      sources.revocation++
      return
    }

    // 1. Live indexer — authoritative, and the only source for expired pins.
    if (indexer) {
      try {
        const detail = await indexer.getDocument(ts, target.network)
        const detailItem = detail.item ?? {}
        const bodies = detailItem.documents ?? []
        if (bodies.length) {
          if (detailItem.options?.entityType) {
            item.options.entityType = detailItem.options.entityType
          }
          if (detailItem.analytics?.schemaName) {
            item.analytics.schemaName = detailItem.analytics.schemaName
          }
          if (detailItem.analytics?.schemaId) {
            item.analytics.schemaId = detailItem.analytics.schemaId
          }
          const serialised = bodies.map(b => (typeof b === "string" ? b : JSON.stringify(b)))
          inferEntityType(item, serialised[0])
          documents[ts] = {
            id: item.id,
            item: { ...item, documents: serialised },
            history: [],
          }
          sources.indexer++
          log(`    ✓ ${ts} ${item.options.entityType ?? "(untyped)"} [indexer]`)
          return
        }
      } catch {
        // fall through to the public sources
      }
    }

    // 2. IPFS — public, works with no subscription.
    if (doc.body.cid) {
      try {
        const vc = await fetchIpfs(doc.body.cid)
        const subject = vc?.credentialSubject?.[0] ?? vc?.credentialSubject ?? {}
        if (subject.type) item.analytics.schemaId = String(subject.type)
        inferEntityType(item, vc)

        documents[ts] = {
          id: item.id,
          item: { ...item, documents: [JSON.stringify(vc)] },
          history: [],
        }
        sources.ipfs++
        log(`    ✓ ${ts} ${item.options.entityType ?? "(untyped)"} [ipfs]`)
        return
      } catch {
        // fall through to the previous snapshot
      }
    }

    // 3. Whatever the last run captured — never regress to fewer documents.
    const kept = prior[ts]
    if (kept) {
      // Keep the stored body, but take the freshly derived row fields.
      const kepttype = kept.item?.options?.entityType
      if (kepttype && !item.options.entityType) item.options.entityType = kepttype
      const keptSchema = kept.item?.analytics?.schemaName
      if (keptSchema) item.analytics.schemaName = keptSchema
      documents[ts] = {
        id: item.id,
        item: { ...item, documents: kept.item.documents },
        history: [],
      }
      sources.previous++
      log(`    ✓ ${ts} ${item.options.entityType ?? "(untyped)"} [kept from previous snapshot]`)
      return
    }

    sources.missing++
    log(`    ✗ ${ts} — no source has this document body`)
  })

  // Newest first — matches the indexer's default orderDir=DESC.
  items.sort((a, b) => Number(b.consensusTimestamp) - Number(a.consensusTimestamp))

  const expected = docs.length - sources.revocation
  log(
    `  hydrated ${Object.keys(documents).length}/${expected} bodies ` +
    `(indexer ${sources.indexer}, ipfs ${sources.ipfs}, kept ${sources.previous}` +
    `, missing ${sources.missing}) · ${sources.revocation} revocation records`
  )

  return {
    slug: target.slug,
    network: target.network,
    policyName,
    instanceTopicId,
    items,
    documents,
    hydrated: Object.keys(documents).length,
    /** Rows that should have a body — revocation records legitimately do not. */
    expectedDocuments: expected,
    sources,
  }
}

async function main() {
  await loadEnv()

  const targets = onlyPolicy ? TARGETS.filter(t => t.slug === onlyPolicy) : TARGETS
  if (!targets.length) throw new Error(`No target matches --policy ${onlyPolicy}`)

  // Load the existing snapshot so a run with no subscription cannot lose bodies.
  let previous = null
  try {
    const module = await readFile(OUT_PATH, "utf8")
    const b64 = module.match(/"([A-Za-z0-9+/=]+)"/)?.[1]
    if (b64) previous = JSON.parse(gunzipSync(Buffer.from(b64, "base64")).toString("utf8"))
  } catch {
    log("no existing snapshot — building from scratch")
  }

  const indexer = noIndexer ? null : await createIndexerClient()

  const policies = { ...(previous?.policies ?? {}) }
  for (const target of targets) {
    policies[target.policyHederaId] = await buildPolicy(target, indexer, previous)
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "hedera-mirror-node + ipfs + guardian-indexer",
    note:
      "Rows reconstructed from public Hedera consensus messages; document bodies " +
      "from the live indexer, IPFS, or the previous snapshot. Served by " +
      "app/api/proxy only when the upstream indexer cannot be reached.",
    policies,
  }

  const json = JSON.stringify(snapshot)
  const gz = gzipSync(Buffer.from(json, "utf8"), { level: 9 })
  const module =
    "// Generated by scripts/build-fallback-snapshot.mjs — do not edit by hand.\n" +
    "// Gzipped JSON, base64-encoded. Inflated lazily by lib/fallback/serve.ts.\n" +
    `export const generatedAt = ${JSON.stringify(snapshot.generatedAt)}\n` +
    `const snapshotGz = "${gz.toString("base64")}"\n` +
    "export default snapshotGz\n"

  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, module)

  log(
    `\n✓ Wrote ${OUT_PATH} ` +
    `(${(json.length / 1e6).toFixed(1)} MB JSON → ${(gz.length / 1e6).toFixed(1)} MB gzipped)`
  )
  let incomplete = false
  for (const [policyId, p] of Object.entries(policies)) {
    const gap = (p.expectedDocuments ?? p.items.length) - p.hydrated
    if (gap > 0) incomplete = true
    log(
      `  ${p.slug}/${p.network} (${policyId}): ${p.items.length} rows, ` +
      `${p.hydrated}/${p.expectedDocuments ?? p.items.length} bodies` +
      `${gap > 0 ? ` — ${gap} MISSING` : ""}`
    )
  }
  if (incomplete) {
    log(
      "\n⚠ Some document bodies are missing. Re-run while the Guardian\n" +
      "  subscription is active — the indexer is the only source for documents\n" +
      "  whose IPFS pins have expired."
    )
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
