#!/usr/bin/env node
/**
 * Rebuilds the offline fallback snapshot served by app/api/proxy when the
 * upstream Guardian indexer is unreachable (outage, or an expired MGS
 * subscription).
 *
 * Everything here comes from public sources — the Hedera mirror node and IPFS —
 * so the snapshot can be regenerated without any Guardian/MGS credentials:
 *
 *   policyHederaId ─(mirror: transactions)→ registry topic
 *                  ─(mirror: message)→ instanceTopicId
 *                  ─(mirror: BFS over child topics)→ VC-Document messages
 *                  ─(IPFS: cid)→ the signed VC bodies
 *
 * The topic message already carries entityType, documentStatus, issuer and
 * relationships, which is everything the indexer puts in options.*, so the
 * reconstructed rows match the real API response field for field.
 *
 * Usage:  node scripts/build-fallback-snapshot.mjs [--policy mecd] [--quiet]
 * Output: lib/fallback/snapshot.json
 */

import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, "../lib/fallback/snapshot.json")

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
const quiet = args.includes("--quiet")
const log = (...a) => !quiet && console.log(...a)

async function getJson(url, { attempts = 4, timeoutMs = 30_000 } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ac.signal })
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
 * Collect every VC/VP document under a policy by walking the instance topic and
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
      // Resolved below from the fetched VC where possible.
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

async function buildPolicy(target) {
  const mirror = MIRROR[target.network]
  log(`\n▶ ${target.slug} (${target.network}) — policyId ${target.policyHederaId}`)

  const { instanceTopicId, policyName } = await resolveInstanceTopic(mirror, target.policyHederaId)
  log(`  instance topic: ${instanceTopicId}  «${policyName}»`)

  const { docs, topics } = await crawlTopics(mirror, instanceTopicId)
  log(`  ${docs.length} VC/VP documents across ${topics.length} topics`)

  const items = docs.map(d => toListItem(d, target.policyHederaId))

  // Hydrate every document from IPFS — the detail route serves these verbatim.
  const documents = {}
  let failed = 0
  await mapLimit(docs, 4, async (doc, i) => {
    const item = items[i]
    const cid = doc.body.cid
    if (!cid) return
    try {
      const vc = await fetchIpfs(cid)
      // credentialSubject[0].type is "<schemaUuid>&<version>" — the closest
      // thing to a schema identifier available without the indexer.
      const subject = vc?.credentialSubject?.[0] ?? vc?.credentialSubject ?? {}
      if (subject.type) item.analytics.schemaId = String(subject.type)

      // Token-mint VCs carry no entityType on-chain. The indexer labels them
      // from the schema; the credential subject is just as unambiguous.
      if (!item.options.entityType && subject.tokenId && subject.amount !== undefined) {
        item.options.entityType = "mint_token"
        item.analytics.schemaName = "MintToken"
      }

      documents[doc.consensusTimestamp] = {
        id: item.id,
        item: { ...item, documents: [JSON.stringify(vc)] },
        history: [],
      }
      log(`    ✓ ${doc.consensusTimestamp} ${item.options.entityType ?? "(no entityType)"}`)
    } catch (err) {
      failed++
      log(`    ✗ ${doc.consensusTimestamp}: ${err.message}`)
    }
  })

  // Newest first — matches the indexer's default orderDir=DESC.
  items.sort((a, b) => Number(b.consensusTimestamp) - Number(a.consensusTimestamp))

  if (failed) log(`  ⚠ ${failed} document(s) could not be hydrated from IPFS`)

  return {
    slug: target.slug,
    network: target.network,
    policyName,
    instanceTopicId,
    items,
    documents,
    hydrated: Object.keys(documents).length,
  }
}

async function main() {
  const targets = onlyPolicy ? TARGETS.filter(t => t.slug === onlyPolicy) : TARGETS
  if (!targets.length) throw new Error(`No target matches --policy ${onlyPolicy}`)

  const policies = {}
  for (const target of targets) {
    const built = await buildPolicy(target)
    policies[target.policyHederaId] = built
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "hedera-mirror-node+ipfs",
    note:
      "Reconstructed from public Hedera consensus messages and the IPFS bodies they " +
      "reference. Served by app/api/proxy only when the upstream indexer fails.",
    policies,
  }

  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2))

  log(`\n✓ Wrote ${OUT_PATH}`)
  for (const [policyId, p] of Object.entries(policies)) {
    log(`  ${p.slug}/${p.network} (${policyId}): ${p.items.length} rows, ${p.hydrated} hydrated`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
