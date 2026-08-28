# CLAUDE.md — Carbon Atlas

## Project Overview

Public-facing Next.js dashboard for exploring verified emission reductions across multiple Guardian policies. Supports Gold Standard MECD v1.2 (testnet + mainnet) and Verra VM0033 (mainnet). Built on [Hedera Guardian](https://github.com/hashgraph/guardian), an open-source MRV platform using Hedera Hashgraph DLT.

**Stack:** Next.js 16 (App Router) | React 19 | TanStack Query | shadcn/ui | Tailwind CSS 4 | Vitest

## Architecture

```
PolicyNetworkProvider (client context, persisted in localStorage)
  → active policy derived from URL pathname (/policy/{slug}/...)
  → mainnet default when supported; testnet only on manual selection
  → fetchProxy builds URL: /api/proxy/{network}/{path}
    → proxy injects Bearer token server-side (lib/api/auth.ts manages SSO chain)
  → TanStack Query keys include (slug, network) for separate caches
  → Policy config from lib/policies/ registry
```

- **Multi-policy:** `lib/policies/` defines per-policy config. Sidebar methodology selector switches between policies; URL is the source of truth for the active policy.
- **Multi-network:** Each policy declares supported networks. Mainnet is default when supported; header toggle switches to testnet.
- **Auth proxy:** `app/api/proxy/[network]/[...path]/route.ts` injects Bearer JWT server-side. `lib/api/auth.ts` manages the MGS SSO chain (login → access-token → sso/generate) with auto-refresh.
- **API client:** `lib/api/client.ts` — `fetchProxy()` routes all client-side calls through the proxy with `ApiError` class for smart retry (4xx = no retry, 5xx = retry with backoff).
- **Offline fallback:** the proxy always tries the live indexer first, retrying 3 times with backoff (300ms, 900ms) on network errors, timeouts, 401s and 5xx. Only when every attempt fails does it serve the snapshot, tagged with an `x-carbon-atlas-source: offline-snapshot` response header. `INDEXER_FORCE_FALLBACK=1` skips the indexer entirely.

### Checking the fallback still works

Append `__fallback=1` to any proxy request to serve that one response from the snapshot, in any environment:

```bash
curl -sD- -o/dev/null \
  'https://atlas.carbonmarketshq.com/api/proxy/mainnet/entities/vc-documents?analytics.policyId=1774178235.879591074&__fallback=1' \
  | grep x-carbon-atlas
```

Without this the fallback is only exercised during an outage, which is the worst moment to find out it broke. Worth checking after any dependency or Next.js upgrade.

### Refreshing the snapshot

```bash
npm run snapshot              # all sources
npm run snapshot -- --no-indexer   # public sources only
```

Rows always come from the Hedera mirror node, so the snapshot rebuilds with no credentials. Document bodies are taken from the first source that has them: the **live indexer**, then **IPFS**, then **the previous snapshot** — that last step means a run without a subscription can never discard bodies an earlier run captured.

**Run this while the Guardian subscription is active.** The indexer is the only source for documents whose IPFS pins have expired — VM0033's already have, so its bodies exist solely because they were captured from the indexer. The script prints a warning if any body is missing. Re-run after new issuances so the snapshot keeps up.
- **Caching:** TanStack Query with 15 min staleTime, 1 hr gcTime. Keyed per slug+network.
- **Theming:** `next-themes` with system default, dark/light toggle in header.
- **Basemaps:** OpenFreeMap vector tiles (`dark` / `positron` by theme) rendered through MapLibre GL inside Leaflet via `@maplibre/maplibre-gl-leaflet`. No API key, no usage limits, no signup. All maps go through `MapTileLayer` in `components/ui/map.tsx`; pass `url`/`darkUrl` to that component if a raster layer is ever needed instead.
  - **maplibre-gl is pinned to v5 on purpose.** On v6 the worker never answers tile-loading tasks, so vector tiles sit in state `loading` forever and maps render as a blank background with no console error. Check the maps actually draw before raising that range.
  - CARTO was dropped because its keyless raster tiles are watermarked as of 2026; OSM's own tile servers are a donated resource whose usage policy does not cover this product.
  - Attribution is required (ODbL) and is on: `Map` sets `attributionControl`, and `MapTileLayer` passes a single linked credit via `attributionControl.customAttribution`.

## Key Files

| File | Purpose |
|---|---|
| `lib/policies/types.ts` | PolicyConfig, StatCardConfig, ChartSlot, NetworkDeployment types |
| `lib/policies/registry.ts` | POLICIES array, lookup helpers |
| `lib/policies/mecd.ts` | MECD config (testnet + mainnet) |
| `lib/policies/vm0033.ts` | VM0033 config (mainnet only) |
| `lib/policies/renderers.ts` | Policy-specific VC renderer registry (client-only) |
| `providers/PolicyNetworkProvider.tsx` | Combined policy + network React context |
| `app/api/proxy/[network]/[...path]/route.ts` | Auth proxy with 401 invalidation, 500 retry, offline-snapshot fallback |
| `lib/fallback/serve.ts` | Resolves proxy requests against the offline snapshot |
| `lib/fallback/snapshot.json` | VC list rows + document bodies, rebuilt from mirror node + IPFS |
| `scripts/build-fallback-snapshot.mjs` | Regenerates the snapshot from public sources |
| `lib/api/auth.ts` | Server-side token manager — MGS SSO chain with auto-refresh |
| `lib/api/client.ts` | `fetchProxy()` + `ApiError` class for client-side API calls |
| `lib/api/vc-documents.ts` | API client with normalizeEntityTypes() (3-pass algorithm) |
| `lib/utils/trust-chain.ts` | buildChain(), deduplicateProjects(), ENTITY_TYPE_CONFIG |
| `hooks/usePolicyVcDocuments.ts` | TanStack Query hooks for policy VCs |
| `hooks/useDashboardStats.ts` | Aggregates stats using policy.statsExtractors |
| `components/vc-views/VCRenderer.tsx` | Two-layer dispatch: policy-specific then generic |
| `components/vc-views/vm0033/PDDView.tsx` | VM0033 PDD viewer with search |
| `components/section-cards.tsx` | Config-driven dashboard stat cards |
| `components/dashboard-charts.tsx` | Config-driven chart slots |
| `docs/adding-a-new-policy.md` | Developer guide for adding policies |

## Entity Types

| Entity Type | Description |
|---|---|
| `approved_report` | Verified monitoring report (emission reduction issuance) |
| `report` | Calculated monitoring report |
| `verification_report` | VVB verification report |
| `validation_report` | VVB validation report |
| `daily_mrv_report` | Aggregated device MRV data |
| `approved_project` | Validated project |
| `project` | Calculated project (auto-completed fields) |
| `project_form` | Raw Project Design Document submission |
| `approved_vvb` | Approved Validation & Verification Body |
| `vvb` | VVB registration |
| `mint_token` | Token minting event |

## Adding a New Policy

See `docs/adding-a-new-policy.md` for the full guide. Quick summary:
1. Create `lib/policies/<slug>.ts` with PolicyConfig
2. Register in `lib/policies/registry.ts`
3. Done — base dashboard, trust chain, and views work automatically
4. Optional: add custom VC renderers in `components/vc-views/<slug>/`

## Development

```bash
npm install
cp .env.example .env.local   # Add Guardian auth credentials
npm run dev                   # http://localhost:3000
npm test                      # Vitest (55 tests)
npm run build                 # Type-check + production build
```

### Environment Variables

See `.env.example`. Policy-specific config (IDs, tokens) lives in `lib/policies/`, NOT in env vars. Env vars only hold:
- `INDEXER_API_BASE_URL` — base URL without network suffix
- Auth credentials (auto-auth or static token)

## Testing

Tests are in `__tests__/` and use Vitest with `environment: "node"`.

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Branding

- **CarbonMarketsHQ:** `public/cmhq-logo-dark.png`, `public/cmhq-logo-light.png` — sidebar footer
- **ATEC Global:** `public/atec-dark.png`, `public/atec-light.png` — MECD project developer
- **Allcot:** `public/allcot-logo.png` — VM0033 project developer
