# Airly

[Open the live app](https://airly.sanjay6326.workers.dev) · [Accuracy investigation](ACCURACY_AUDIT.md) · [Audit fixes](AUDIT_FIXES.md)

Air quality near you, served by a Cloudflare Worker. Official Malaysia API readings come from the Department of Environment (DOE/APIMS); worldwide US AQI displays are derived from the World Air Quality Index Project (WAQI) pollutant sub-indices. Forecasts are WAQI model predictions.

The core app needs no database or frontend framework. The deployment entry point is `worker.js`; dashboard source lives in `ui/app.js`, shared alert and country logic in `lib/`, and committed vendor assets in `data/`. Wrangler emits a single `dist/worker.js` bundle. English, Bahasa Melayu, Tamil, and Mandarin are supported.

## Location behavior

- Airly requests a fresh device position first. Allow the browser's location permission for the nearest station to your device coordinates.
- **Use my location** requests a fresh position with high accuracy enabled and no cached positions. Device accuracy is shown beside the location. Accuracy ultimately depends on the browser and device.
- **Refresh** in your own area reacquires device location and finds the nearby station again. In a searched city it refreshes that city; after explicitly selecting a station it refreshes that station.
- When location is blocked, unavailable, or times out, Airly displays an explanation and an approximate IP area. IP location can resolve to another state because of a mobile carrier, ISP, or VPN. It is never labeled as a precise device position.
- **Choose a city** or the search button lets you select a city instead. City selection lasts only for the current visit. Opening, reloading, or returning to Airly requests the device location again and discards any previous city or station selection. Language, index preference, alerts and other settings stay saved. GPS coordinates and city selections are not saved in local storage.
- If both device and IP location fail, the Kuala Lumpur default is clearly labeled. A broad device accuracy estimate also displays a warning.
- Stations measure air at their own locations. The dashboard names the station and shows its distance from the device, approximate area, or selected city.

For a Selangor device incorrectly assigned a Penang IP address, device coordinates take priority. If device location is unavailable, search for your city, such as **Shah Alam**, **Petaling Jaya**, **Klang**, or **Kajang**.

## Dashboard

The reading and health guidance appear beside an interactive station map on desktop. Mobile has dedicated Air, Map, Nearby, News, and Forecast views. Current readings, stale readings, measurement times, index scales, source attribution, and pollutant sub-indices are labeled explicitly.

Malaysia API is the official DOE value, not a numerical conversion from US AQI. Automatic mode resolves the provider from coordinates using offline country boundaries, so VPN/ISP metadata cannot override GPS. Explicit Malaysia API selection returns a no-coverage error when no nearby DOE station is available. A distant Malaysian station is not substituted for a device position outside the supported area. You can select the provider in Settings.

DOE does not provide a forecast in this feed; Airly explains that instead of substituting a US AQI forecast. For WAQI stations, forecasts show upcoming daily PM2.5 AQI sub-indices, not measured concentrations. Health guidance is deterministic. The former AI advice endpoint is retired and returns HTTP 410 without invoking upstream services or Workers AI.

WAQI's headline `aqi` can contain a national index: it must not be assumed to be US AQI. Airly takes the maximum available pollutant AQI sub-index and labels its provider. Missing or contradictory incomplete data fails closed. Maps fetch detail for up to 12 nearby stations; other pins remain neutral and selectable. The app does not convert Malaysia API into US AQI, reconstruct raw concentrations, or claim to independently reproduce the current EPA NowCast. See [the accuracy investigation](ACCURACY_AUDIT.md) for evidence, tests and provider limitations.

## Develop and deploy

Use Node.js 22 or later and a Cloudflare account. Obtain a free [WAQI API token](https://aqicn.org/data-platform/token/). For your own deployment, update `name` and `account_id` in `wrangler.toml` to your Worker name and Cloudflare account before setting secrets or deploying.

```sh
git clone https://github.com/sanjayws/airly
cd airly
npm ci
npm run verify
npx wrangler login
npx wrangler secret put AQICN_TOKEN
npm run deploy
```

`npm run build` performs a deployment dry run and compares the bundled app HTML to the source app. HTML is stored as a template string so normal Wrangler bundling preserves it. The build bundles the dashboard and fixed Leaflet assets with the backend. The canonical deployment directory is the Git checkout; `npm run sync:root` optionally copies the verified bundle and config to its parent workspace. Edit source in the checkout, never the generated root copy. `npm run dev` starts Wrangler locally; IP geolocation may not be available in local development.

When updating an existing deployment, retain its account, bindings, secrets, and triggers. `npm run deploy` uses `--keep-vars`. Malaysia DOE readings do not require the WAQI token, but worldwide stations do. Never put secret values in source control.

## Guidance and news

`/api/advice` is retired and no AI binding is deployed. GPS news uses country-wide coverage when the device locality is unknown; it does not guess a city from the IP address. Selected cities get city-specific coverage. Search and news return explicit upstream errors, and partial news results carry a degraded-source header.

## Optional background push alerts

1. Generate VAPID keys with `npx web-push generate-vapid-keys`.
2. Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` with `wrangler secret put`. Optionally set `VAPID_SUBJECT` to a contact URI.
3. Create storage with `wrangler kv namespace create PUSH_SUBS` and uncomment the matching KV binding in `wrangler.toml` using its namespace ID.
4. Keep the cron trigger `0,30 * * * *` and deploy.

Users opt in under Settings. Background alerts store the subscription and station on the server. Without push setup, browser alerts check for changes while the app is open. On supported iOS versions, install the app on the Home Screen to use Web Push. Alerts compare dated readings from the same station and scale; stale readings do not trigger alerts. Every fresh measurement advances the last-seen timestamp while the notification baseline remains until a threshold crossing, so gradual changes still trigger alerts. Scheduled checks paginate KV with four concurrent checks, a three-minute processing budget, and a persisted continuation cursor.

Subscriptions expire after 30 days, and active consenting clients renew at most once a day. Records with malformed keys or expired consent are deleted. Opt-out waits for service-worker readiness and confirmed server removal. Registration uses per-network limits of 10 requests/minute and a shared budget of 100/minute per Cloudflare location. These are abuse controls, not a strict globally consistent billing quota; shared mobile networks may hit the per-network limit. Server-side subscription registration refuses to run without both rate-limit bindings.

## Configuration

| Name | Type | Purpose |
|---|---|---|
| `AQICN_TOKEN` | Secret | Worldwide WAQI readings, map, and forecasts |
| `PUSH_LIMIT`, `PUSH_BUDGET` | Rate-limit bindings | Subscription registration controls |
| `PUSH_SUBS` | Optional KV binding | Push subscriptions |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Optional secrets | Web Push authentication |
| `VAPID_SUBJECT` | Optional secret | Push contact URI |
| Cron trigger | Optional | Background change checks |

## Checks

`npm run verify` runs syntax checks, Node regression tests, and the Wrangler dry run/bundle comparison. `npm run deploy` runs these checks automatically before publishing. `npm run verify:full` additionally runs the Worker-runtime and Chromium suites; CI runs this full set after `npm ci` and installing Chromium.

The regression tests cover the reproduced API/AQI mismatch, pollutant sub-index aggregation, missing data, Malaysia/US category boundaries, timestamps, forecast ranges, GPS/IP country mismatches, manual-provider coverage, invalid inputs, gradual alert thresholds, delayed location responses, map/area ordering, Nearby refresh, news locality and outages, subscription validation, streamed body limits, KV pagination, and expiry. Browser tests exercise the actual page and narrow-screen controls. Runtime tests use Miniflare and local KV.

The restricted Codex sandbox used for the audit fixes blocks Chromium sockets and local listeners, so those two suites could not execute there. Node regressions and the deployment bundle can run there; full runtime/browser verification requires a normal development or CI environment. Physical GPS accuracy and real push delivery still depend on the user's device and optional push configuration.

## Architecture

`/` serves the app. `/api/air` retrieves a station or area readings, `/api/location` resolves coordinates to a country, or returns clearly approximate Cloudflare IP metadata when no coordinates are supplied; both use `no-store`, `/api/search` geocodes cities, `/api/news` retrieves regional coverage, `/api/advice` returns a retirement response, and `/api/push/*` manages opt-in notifications. `/vendor/*` serves the packaged Leaflet 1.9.4 assets without contacting a CDN. `scheduled()` checks push subscriptions.

Upstream calls have timeouts. Public DOE data can be edge-cached; pending I/O is scoped to each request. The WAQI token stays on the server. Security headers restrict page capabilities, framing, and external resource access. Worker logs and sampled traces are enabled; upstream and scheduled failures log sanitized route/error codes. Generalized country boundaries include a nearest-coast fallback within 2 km for reclaimed land; unknown offshore positions stay unresolved. See [THIRD_PARTY.md](THIRD_PARTY.md) for data attribution and the Leaflet license.

Preserve in-app [DOE/APIMS](https://eqms.doe.gov.my/APIMS/main), [WAQI](https://aqicn.org/api/), and [OpenStreetMap](https://www.openstreetmap.org/copyright) attribution and observe their terms. Configure Cloudflare rate limiting if needed. News is best-effort. Health guidance is informational.

## License

MIT — see [LICENSE](LICENSE).
