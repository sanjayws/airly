# Audit remediation

**14 October 2026 follow-up:** the earlier audit missed a critical assumption that WAQI's headline was always US AQI. This is now corrected across detail, maps, guidance and alerts. See [ACCURACY_AUDIT.md](ACCURACY_AUDIT.md) for the reproduced Shah Alam mismatch, deployed correction and validation limits.

Date: 2026-10-12. Applies to the findings in [AUDIT.md](AUDIT.md).

All 15 findings have implementation changes and targeted regression coverage. The original audit remains a historical snapshot. The Git checkout is now the canonical source, and deployment publishes the verified `dist/worker.js` artifact.

| Finding | Change |
| --- | --- |
| A01 | Resolve country offline from accepted coordinates for provider selection; coordinate metadata never inherits the IP country/city. Explicit Malaysia API returns a no-coverage error instead of changing scales. |
| A02 | Retire `/api/advice` with HTTP 410 and remove the Workers AI binding. No model inference or advice upstream request remains. |
| A03 | Removing the AI handler eliminates advice from null/stale measurements. The dashboard retains strict AQI and freshness validation. |
| A04 | Await service-worker readiness before opt-out, require confirmed server deletion, preserve settings on failed updates, and retain an endpoint receipt for retryable cleanup. |
| A05 | Share alert transition logic between frontend and scheduler; track last-seen measurement separately from the notification baseline. Delivery failure preserves the comparison baseline. |
| A06 | Paginate all KV pages, including empty incomplete pages. Process four subscriptions concurrently with a three-minute work budget, a 32-page bound, and a saved cursor/offset for continuation. |
| A07 | Enforce the 4,096-byte limit while reading, cancel oversized streams, validate canonical base64url and P-256 keys, require rate-limit bindings, expire subscriptions after 30 days, and renew active consent at most daily. |
| A08 | Replace area and viewport snapshots, refresh the area on periodic mobile refresh, and label measurement age/freshness in Nearby and map tooltips. |
| A09 | Keep area and viewport datasets independent; delayed area replies cannot replace the viewport snapshot. Each request stream retains its sequence checks. |
| A10 | Preserve the actual viewport latitude, constrain span, and split antimeridian requests into valid provider bounds. |
| A11 | Current location errors take precedence over a selected city's banner suppression. |
| A12 | Share resolved country metadata with news. GPS uses country-wide coverage when city metadata is unavailable, selected cities get locality-specific coverage, and accepted location changes invalidate/reload news. |
| A13 | Search and total news outages return non-cacheable 503 errors. Partial news results identify degraded sources and are not stored as successful cached snapshots. |
| A14 | Package Leaflet 1.9.4 and load the map asynchronously, with an independent retry action. Dashboard startup proceeds while map assets are unavailable. |
| A15 | Pin dependencies and commit a lockfile; add release checks, CI, frontend/backend regressions, browser scenarios, runtime checks, source-derived release identity, and publication of the already-tested bundle. Root deployment copies are generated. |

Additional maintenance changes: frontend source moved to `ui/app.js`, shared logic to `lib/`, and vendor/generated assets to `data/`. Added sanitized error logs and sampled Worker traces. Filled missing Malay, Tamil, and Chinese UI strings and translated accessible control labels. Dialogs inert all background siblings, including the location notice. Leaflet licensing and boundary-data attribution are recorded in [THIRD_PARTY.md](THIRD_PARTY.md).

## Validation

- `npm ci --offline --cache /tmp/airly-npm-cache --ignore-scripts --no-audit --no-fund` installed the pinned lockfile successfully. Registry tarballs were integrity-checked by npm; downloads used curl because npm DNS requests were blocked in this sandbox.
- Node regression suite: **36 passed**, including actual backend scheduled checks using valid crypto keys and mocked push transport, streamed input limits, delayed registration cleanup, map ordering, location warnings, and news errors.
- Worker/frontend syntax and Wrangler deployment dry run/bundle comparison: verified through `npm run verify` and automatically repeated before deployment.
- Ten Chromium scenarios and local Worker/KV checks are committed and included in CI's `npm run verify:full`.

**Validation gap:** This sandbox prevents Chromium's socket setup (`setsockopt: Operation not permitted`) and local Worker-runtime listeners (`listen EPERM`). Those two suites were attempted but could not execute here; they are not counted as passing. No physical GPS or real push delivery test was performed. Background push is not active in the inspected production configuration because no `PUSH_SUBS` namespace is bound; the fixes are tested with isolated subscriptions and do not enable push storage automatically.

Country boundaries are generalized geographic data, with detailed Malaysia/Singapore polygons and a nearest-coast fallback within 2 km for reclaimed land. They are not survey-grade border determinations. Unknown offshore positions remain unresolved. Registration rate limits operate per Cloudflare location; they are not a globally consistent billing quota and can affect users on a shared network.

## Deployment

Target: Worker `airly` in account `c5cc3f600a44c74d72518d91a320f828`, at https://airly.sanjay6326.workers.dev.

The existing variables and secrets are preserved with `--keep-vars`; AI is removed and registration rate-limit bindings and sampled traces are configured. The `worker.js` filename is preserved. `/api/config` and the HTML `x-airly-release` header identify the source-derived release.

Deployment succeeded. Cloudflare version: `0e116bff-f7ee-416c-a139-6033d6e79d64`. Source release: `e4b0465afcbc894c`. Reported Worker startup: 10 ms. The cron remains `0,30 * * * *`.

Live smoke checks passed:

- HTML exactly matches the verified source response and reports the expected release header.
- `/api/config` reports release `e4b0465afcbc894c` and `backgroundPush: false`, consistent with the existing lack of a push-storage binding.
- Coordinates `3.0738,101.5183` resolve to `MY` without an IP city.
- Automatic air-quality lookup for those Selangor coordinates returns `my:CA20B`, **Shah Alam, SELANGOR**, Malaysia API 78, measured at `2026-10-12T16:00:00+08:00` during the smoke check.
- `/api/advice` returns HTTP 410.
- The live Leaflet JavaScript exactly matches the packaged asset.

The generated root Worker matches `dist/worker.js`. Application sources and CI configuration remain local working-tree changes; this task deployed Cloudflare without publishing a GitHub commit.
