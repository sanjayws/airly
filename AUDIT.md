# Airly repository audit

Remediation status: implementation changes are recorded in [AUDIT_FIXES.md](AUDIT_FIXES.md). This document preserves the original findings and source references as an audit snapshot.

Date: 2026-10-12

Reviewed the current working tree in `/home/airly/repo`, based on commit `28e6efce98e9020f7bb03d0e75226eff76ec0348`. This includes the uncommitted location and UI changes. Findings refer to this working tree, not the original GitHub version or a verified production deployment. Source line numbers below refer to `worker.js` as reviewed.

The root deployment copies `/home/airly/worker.js` and `/home/airly/wrangler.toml` matched the checkout during this audit. Worker SHA-256: `362ef88d83658c8dc2099bf4ca53eeaa82b9a608246668a13b0f1760ae87354b`.

Only this report was added. No application code was changed and nothing was deployed.

## Summary

Found 15 issues. The most urgent are incorrect provider selection despite valid GPS coordinates and an unused public endpoint that can invoke Workers AI without application-level usage controls. Alert state handling, stale station lists, and inconsistent location information also need attention.

Severity describes impact and repair priority, not evidence of exploitation. “Reproduced” means isolated execution with mocked upstream services or extracted frontend functions. “Inspected” means the issue follows from source control flow but was not exercised in a browser or production.

| ID | Priority | Issue | Evidence / applicability |
| --- | --- | --- | --- |
| A01 | High | GPS coordinates do not reliably determine the air-quality provider | Reproduced |
| A02 | High | Public compatibility endpoint can trigger uncontrolled AI work | Inspected; AI binding required |
| A03 | Medium | AI advice treats missing and stale readings as current data | Reproduced; compatibility endpoint |
| A04 | Medium | Disabling background alerts can leave the subscription active | Reproduced; push configured |
| A05 | Medium | Gradual changes can miss alert thresholds | Reproduced; foreground and background |
| A06 | Medium | Scheduled alerts ignore subsequent subscription pages | Reproduced; push configured |
| A07 | Medium | Subscription validation and request-size enforcement are incomplete | Reproduced; push configured |
| A08 | Medium | Map and Nearby lists retain stale station readings | Reproduced and inspected |
| A09 | Medium | A slow area response can overwrite newer viewport results | Reproduced |
| A10 | Low | High-latitude map requests target the wrong latitude | Reproduced |
| A11 | Medium | A selected city hides subsequent GPS errors | Reproduced |
| A12 | Medium | Local news can still use the IP city after successful GPS | Reproduced |
| A13 | Medium | Upstream outages appear as successful empty results | Reproduced |
| A14 | Medium | Loading the map library blocks dashboard initialization | Inspected |
| A15 | Medium | Release checks do not cover important user flows or enforce reproducible builds | Inspected |

## Findings and suggested fixes

### A01 — GPS coordinates do not reliably determine the provider

**Evidence:** `worker.js:97–103, 135–154, 619, 824`.

The browser GPS result contains coordinates but no country. Automatic provider selection can therefore fall back to `request.cf.country`, which describes the network location. A VPN, proxy, or cross-border mobile connection can choose a different index/provider despite accurate GPS. Separately, the Malaysia handler switches to WAQI when the nearest DOE station is more than 200 km away, even when the user explicitly selected Malaysia API.

Reproduced with mocked station feeds:

- Selangor coordinates `3.0738,101.5183` and IP country `SG` selected US AQI/WAQI.
- Singapore coordinates `1.3521,103.8198` and IP country `MY` selected the Johor Bahru DOE station.
- London coordinates with explicit `index=my` silently returned `index=us`.

This confirms a remaining location/provider mismatch. It does **not** establish that this exact path caused the original Penang reading; that would require the actual request and upstream response.

**Suggested fix:** Resolve the country from accepted coordinates, or use country metadata from a selected geocoded city. Keep the network location only as an explicitly approximate fallback. Define one provider-selection policy shared by current, area, and viewport requests. An explicit index choice should remain explicit: return a clear no-coverage state instead of silently changing scales.

**Regression checks:** Cover all three cases above, a VPN-country mismatch, and switching between automatic and explicit index choices.

### A02 — Public compatibility endpoint can trigger uncontrolled AI work

**Evidence:** `worker.js:55, 213–284`; `wrangler.toml:9–10`; `README.md:46–48`.

`/api/advice` is publicly callable and can invoke the configured AI binding. The current dashboard does not use this compatibility endpoint. There is no application-level authentication, rate limit, or request budget. The handler fetches WAQI before checking its application cache, and different coordinates, languages, profiles, and AQI bands create different cache keys. Failed or slow model attempts can lead to a second model invocation.

A caller can generate upstream and AI work without interacting with the UI. Actual exposure and cost depend on platform quotas and any external WAF/rate-limiting rules, which were not inspected. No abuse or bill increase was observed or simulated against production.

**Suggested fix:** Remove or disable this unused endpoint and its AI binding by default. If retained, enforce per-client and overall usage budgets, validate and normalize inputs, cache by resolved station where practical, and bound concurrent model work. Apply appropriate edge rate limiting; browser-origin checks alone are not authentication.

**Regression checks:** Verify disabled deployments never invoke AI, equivalent requests reuse results, and exhausted budgets reject requests before upstream/model work.

### A03 — AI advice accepts missing and stale air-quality readings

**Evidence:** `worker.js:226–232, 264–267`.

The advice endpoint validates AQI with `Number.isFinite(Number(value))`. Both `null` and an empty string become zero. It also does not validate measurement age before describing the result as current.

A mocked WAQI response with `aqi: null` and a timestamp from 2020 produced HTTP 200 and an AI prompt stating that the current US AQI was zero. This can generate reassuring advice from invalid data. The finding applies to the compatibility advice endpoint; the dashboard has separate validation.

**Suggested fix:** Reuse strict AQI validation and the application's freshness policy before classification or prompting. Reject missing, negative, stale, and implausibly future-dated readings. Return an explicit unavailable/stale response with station and measurement metadata when appropriate.

**Regression checks:** Test `null`, empty string, `"-"`, negative values, missing timestamps, old timestamps, future timestamps, and a valid current zero reading.

### A04 — Background-alert opt-out can succeed locally without unsubscribing

**Evidence:** `worker.js:895–920, 962`.

Service-worker registration is asynchronous. `disablePush()` returns successfully when `serviceRegistration` is not yet available, and `saveSettings()` can then persist `background: false`. An existing server subscription remains active. Future saves may not retry removal because the local setting is already false.

The isolated reproduction called the actual `disablePush()` with registration pending: it resolved successfully and sent zero unsubscribe requests. There is another inconsistent-state path when updating an existing subscription fails: the catch clears the local background flag without confirming removal of the previous server record.

**Suggested fix:** Distinguish “registration unknown” from “confirmed no subscription.” Await registration/readiness with explicit failure handling, and only record confirmed opt-out after successful removal. Retain retryable cleanup state across reloads. A failed subscription update should preserve or reconcile the previously active state.

**Regression checks:** Opt out immediately after reload with a delayed registration, simulate registration failure, and fail an update to an existing subscription. Assert both local and server state.

### A05 — Gradual pollution changes can miss alert thresholds

**Evidence:** `worker.js:469–478, 717–722`.

Both notification paths use the baseline timestamp to decide whether the baseline is stale. That timestamp advances on initialization or an alert, rather than on every fresh reading. Continuous fresh measurements can therefore look like a data gap and reset the comparison baseline.

With hourly readings `50 → 56 → 62 → 68 → 76` and a threshold of 25, both paths generated zero notifications. At hour four, the increase was 26, but the baseline was reset to 76. A subsequent abrupt increase successfully exercised the mocked push transport, confirming the missing alert was baseline logic rather than a transport failure.

**Suggested fix:** Track the last accepted measurement time separately from the last notified AQI/time. Update measurement freshness for every newer valid reading. Reset the alert baseline only after a real observation gap, or explicitly define and explain a rolling comparison window in the settings UI.

**Regression checks:** Slow rises and falls spanning more than three hours, a genuine stale-data gap, repeated timestamps, and successful/failed notification delivery.

### A06 — Scheduled alerts skip subscription pages and process work serially

**Evidence:** `worker.js:449–479`.

The scheduler calls `PUSH_SUBS.list({limit:1000})` once and ignores `cursor` and `list_complete`. A mocked response with another page available resulted in one list call and processing only the first page. Subscriptions outside that page can be repeatedly skipped.

Cloudflare documents a maximum of 1,000 keys per page and requires following the cursor until `list_complete` is true; even an empty page can be incomplete. See [KV listing documentation](https://developers.cloudflare.com/kv/api/list-keys/).

Each subscription is also processed sequentially. Simply adding an unlimited pagination loop would create a second scaling problem: slow feeds and push services can exhaust the scheduled invocation's time budget. Scheduled invocations have a 15-minute wall-time limit. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

**Suggested fix:** Follow pagination with an explicit work budget and reliable continuation, or distribute batches through a queue. Use bounded concurrency, retain station-level feed reuse, and record progress and retryable failures.

**Regression checks:** Multiple pages, an empty incomplete page, slow upstreams, partial failures, and continuation without starving later subscriptions.

### A07 — Subscription input validation and body limits are incomplete

**Evidence:** `worker.js:417–436`.

Subscription keys are checked only for string type, then truncated and stored. The endpoint accepted `p256dh: "invalid"` and `auth: "invalid"` with HTTP 200 in a mocked KV test. Such records fail later during push processing. Stored records have no expiration, and there is no application-level registration quota. The same-origin header check helps browser request handling but can be supplied by a non-browser client.

The 4,096-character body check runs **after** `request.text()` buffers the whole body. A streamed 16,384-byte request without Content-Length was consumed in full before returning 413. String length also does not enforce a UTF-8 byte limit.

**Suggested fix:** Decode and validate subscription keys, including the 65-byte uncompressed P-256 public key and 16-byte authentication secret. Reject malformed values rather than truncating them. Enforce a byte limit while streaming and cancel immediately after it is exceeded. Add registration quotas and a subscription expiry/renewal and cleanup policy.

**Regression checks:** Invalid base64url, wrong decoded lengths, invalid curve points, chunked oversized bodies, multibyte payloads, exact size boundaries, and expired subscriptions.

### A08 — Map and Nearby lists can retain stale readings indefinitely

**Evidence:** `worker.js:709–716, 768, 779–781, 786–800, 842`.

Viewport refreshes merge incoming stations into the old collection. Stations missing from a newer response are retained without an expiry policy. A reproduction kept a station dated 2020 after a successful empty refresh.

On mobile, viewport loading is skipped while Nearby is active. Periodic refresh updates the current reading, but does not independently refresh the area's other stations. Nearby can therefore show old AQI badges while the main reading is current, without a measurement-age indication on each badge.

**Suggested fix:** Maintain explicit snapshots for each queried area, replace or expire entries that disappear, and give retained off-screen data a bounded lifetime. Refresh Nearby independently of whether the map is visible. Show stale/unavailable status based on each station's measurement time.

**Regression checks:** A station disappearing from a feed, a successful empty snapshot, old timestamps, and multiple refresh intervals while mobile Nearby remains open.

### A09 — A slow area response can overwrite a newer viewport result

**Evidence:** `worker.js:767–790`.

`loadArea()` and `loadViewport()` have separate sequence counters but write the same `stations` array. After an area request starts, a pan can produce a newer viewport result; the older area response then passes its own sequence checks and replaces the collection.

An isolated reproduction resolved a delayed area request after a newer viewport result. Only the old area's station remained. Markers in the visible region can disappear until another refresh.

**Suggested fix:** Use a shared generation/version for writes to the station collection, or maintain separate area and viewport snapshots with explicit merge rules. Invalidate obsolete work when changing the active query, including preserving the authoritative current-station detail.

**Regression checks:** Resolve area and viewport requests in both orders after a pan, location change, and provider change.

### A10 — High-latitude map requests target a different latitude

**Evidence:** `worker.js:769–772`.

The viewport request clamps the map center to ±65 degrees even when the map is visibly centered farther north or south. For visible bounds `69.8..70.2` latitude and `19.8..20.2` longitude, the requested box was `64.8,19.8,65.2,20.2`, excluding the visible area entirely.

**Suggested fix:** Build the query from actual visible bounds, constrain its span without relocating its center, and clamp only to the supported map/provider latitude range. Handle antimeridian wrapping explicitly.

**Regression checks:** Viewports near 70° north and south, the provider's latitude boundaries, and both sides of the antimeridian.

### A11 — Selecting a city hides subsequent GPS errors

**Evidence:** `worker.js:652, 816`.

The location banner is always hidden when `searchLocation` exists. If someone selects a city, then requests device location and denies permission or encounters a timeout, the error state is set but its banner stays hidden. There is no corresponding failure toast in that path.

With a selected Shah Alam city and `locationError: 'locBlocked'`, the actual rendering condition set `bannerHidden: true`. The old city can remain visible without explaining why the location button did not work.

**Suggested fix:** Give current location-request errors precedence over banner suppression. Preserve the existing reading while clearly stating that device location failed, with a retry or browser-settings action.

**Regression checks:** Permission denial and timeout with and without a saved city, followed by a successful retry that clears the error.

### A12 — Local news can follow the IP city after GPS succeeds

**Evidence:** `worker.js:320–326, 824, 846`; location transition in `useArea()`.

GPS results do not contain city/country metadata. `newsQuery()` sends no GPS-derived city, so the backend falls back to `request.cf.city` or region. A reproduction using Selangor GPS coordinates and a George Town/Penang IP location generated the query `air quality haze PM2.5 George Town Malaysia`.

This lets the reading and local-news panels describe different places. Changing location while News is already open also does not explicitly refresh its content through the location transition.

**Suggested fix:** Share a resolved location model across air quality and news. Pass the accepted locality/country, invalidate news when that location changes, and label approximate location honestly. When locality is unresolved, show clearly labeled broader coverage instead of implying a precise nearby location.

**Regression checks:** Selangor GPS with Penang IP metadata, location changes while News is open, manual-city selection, and unresolved locality.

### A13 — Upstream outages appear as successful empty results

**Evidence:** `worker.js:295–297, 341–354, 626`.

Search catches upstream failure and returns HTTP 200 with `[]`. News can likewise turn failures from all sources into an empty successful result and cache it for 900 seconds. The frontend cannot distinguish these failures from a genuine lack of matches or coverage.

Mocked upstream failures returned `200 []` from both endpoints. A temporary news outage can therefore remain visible as an empty result even after the source recovers.

**Suggested fix:** Return a typed 502/503 error with appropriate non-cacheable failure headers when all sources fail. Keep genuine empty success distinct. For partial news results, include degraded-source metadata; optionally serve a clearly marked last successful snapshot.

**Regression checks:** All sources failing, one source failing, a valid empty result, and recovery without waiting for the successful-result cache lifetime.

### A14 — Loading the map library blocks the whole dashboard

**Evidence:** `worker.js:300–314, 538, 729`.

The HTML loads `/vendor/leaflet.js` with a blocking script tag before the application script. The proxy tries two CDN sources sequentially with configured eight-second timeouts. On a cold or failing vendor fetch, initialization of location, settings, and the rest of the dashboard waits for the map dependency. The missing-map fallback only runs after that wait.

This is a source-level finding; the approximately 16 seconds of configured upstream timeout was not measured in a browser, and actual cache/network behavior may differ.

**Suggested fix:** Package the fixed Leaflet asset with the deployment, and initialize the dashboard independently of map loading. Load the map asynchronously with its own loading, retry, and unavailable states.

**Regression checks:** Delay or reject the map asset and verify the location controls, current reading, and settings remain usable immediately.

### A15 — Release checks leave major user flows unverified

**Evidence:** `package.json:6–14`; `tests/location.test.mjs:14–18`; `scripts/check-frontend.mjs`; `scripts/check-bundle.mjs`; root/check-out file layout.

The existing tests and build pass despite the reproduced issues above. Location tests stub rendering and key data-loading functions, and duplicate some query logic. Syntax and bundled-HTML equality checks are useful, but do not verify integrated location changes, alert state, map request ordering, or browser behavior.

The checkout also has no lockfile or CI configuration. Wrangler uses a caret version range, and `npm run deploy` does not require checks first. The parent directory has a separate installation/lockfile and duplicate deployment sources. These copies currently match, but testing the checkout does not guarantee a later deployment from its parent uses identical code or dependencies. Uncommitted work itself is not a defect.

**Suggested fix:** Establish one canonical source/deployment directory. If root copies are necessary, generate and verify them automatically. Commit a matching lockfile, use `npm ci` in CI, and gate releases on syntax, meaningful tests, and the deployment bundle check. Add focused browser tests for the reproduced location and UI failures, plus Worker-runtime tests for scheduled/KV behavior.

**Regression checks:** A clean checkout can install reproducibly, checks reject a deliberately broken location flow, and the deployed artifact can be traced to the tested source revision.

## Additional maintenance observations

- **Failures are difficult to diagnose.** Several catches discard errors, including subscription processing, provider fetching, AI fallback, and news. Add sanitized structured logs and counters for route, provider, error category, latency, and outcome. Avoid logging tokens, push endpoints, or precise user coordinates. Enabling observability alone does not enable tracing; tracing requires explicit configuration if desired. See [Workers tracing documentation](https://developers.cloudflare.com/workers/observability/traces/).
- **The single-file implementation increases change risk.** Backend handlers, translations, frontend state, HTML/CSS, and embedded assets share one large file. Consider separate source modules and assets while continuing to emit `worker.js` as the deployment entry point. Prioritize the correctness fixes before restructuring.
- **Localization and accessibility deserve browser review.** Some labels and error strings remain hard-coded in English. The settings dialog inerts the main layout but not every sibling element, including the location notice. Verify translated accessible names, screen-reader focus, and narrow-screen layouts with the notice visible. These were not fully exercised and are follow-up review items, not confirmed accessibility conformance failures.

## Validation performed and limits

| Check | Result |
| --- | --- |
| `npm run check` | Passed Worker and frontend syntax checks |
| `node tests/worker.test.mjs` | 6/6 passed |
| `node tests/location.test.mjs` | 8/8 passed |
| `WRANGLER_LOG_PATH=/tmp/airly-audit-build.log WRANGLER_SEND_METRICS=false npm run build` | Passed with Wrangler 4.149.0 |
| Bundled HTML comparison | Source and bundle matched: 85,090 characters |
| Root/check-out deployment copies | Worker and configuration matched |
| Targeted audit probes | Reproduced the behaviors identified above using mocked upstream/KV/AI/push services and isolated frontend functions |

Temporary reproduction scripts were written to `/tmp/airly-audit-probes.mjs` and `/tmp/airly-audit-news.mjs`; the primary results were saved in `/tmp/airly-audit-results.json`. They are local audit aids, not committed regression tests. No real notifications were sent by these probes.

This audit did not perform physical-device GPS testing, browser visual testing, a real push delivery test, load testing, a dependency vulnerability scan, or an inspection of production secrets, WAF rules, billing, and Cloudflare account settings. Optional push findings require KV and VAPID configuration; the checked-in KV binding is commented out. Existing runtime bindings were not assumed to match the template. Passing a dry run establishes bundle validity, not production correctness.

Positive controls observed include HTML escaping and HTTP(S) URL filtering, server-side upstream-token use, coordinate validation, push-endpoint host restrictions, and strict reading validation in the main dashboard path. These observations do not constitute a comprehensive security certification.

## Suggested repair order

1. Fix the shared location/provider policy and location-error visibility (A01, A11, A12). This addresses the reported trust problem directly.
2. Disable or constrain the unused AI route, and reject invalid advice inputs if it remains enabled (A02–A03).
3. Repair alert baseline and subscription state handling, then pagination and input validation (A04–A07).
4. Make station snapshots fresh and request ordering deterministic (A08–A10), and expose upstream failures clearly (A13).
5. Decouple map initialization (A14), then enforce reproducible releases and retain regression tests for the repaired behaviors (A15).
