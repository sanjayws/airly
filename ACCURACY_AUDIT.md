# Airly accuracy investigation — 14 October 2026

## Confirmed critical defect

The previous implementation passed WAQI's top-level `data.aqi` straight through and labeled it **US AQI**. That field is not sufficient to establish the scale. The bounds/map endpoint inherited the same assumption. Background alerts used the same unverified headline.

At **21:00 MYT on 14 October 2026**, Shah Alam showed:

| Field | Observed value |
| --- | ---: |
| Official DOE API, station CA20B | 175 |
| WAQI headline, station 2621 | 175 |
| WAQI PM2.5 AQI sub-index | 235 |
| WAQI PM10 AQI sub-index | 125 |
| WAQI O3 / NO2 / SO2 / CO sub-indices | 9.3 / 20.8 / 4.1 / 0.1 |
| Old Airly US AQI display | **175 — wrong field** |
| Corrected maximum of available WAQI pollutant sub-indices | **235** |

The matching headlines are evidence of a native-index pass-through for this observation, not proof that every WAQI station headline is a Malaysia API value. WAQI's public Shah Alam page also displayed a headline different from its PM2.5 sub-index. No country-wide heuristic based solely on station location is used in the fix.

**An API value of 160 does not uniquely determine a US AQI value.** Pollutants, concentrations, averaging periods and breakpoint editions matter. This implementation does not invent a numerical conversion or reconstruct concentrations from rounded index values.

## Corrections

1. **WAQI detail:** use the rounded maximum of available `iaqi.pm25`, `pm10`, `o3`, `no2`, `so2`, and `co`. These are documented pollutant AQI sub-indices, not µg/m³. Weather fields never contribute. The original headline is retained only as `reportedIndex` for diagnosis. The calculation is identified as `waqi-subindices-v1`, and the interface explicitly identifies WAQI as the source.
2. **Incomplete data:** reject a response with no usable pollutant sub-indices, a missing declared dominant pollutant, or incomplete pollutant coverage that would reduce a higher headline to a lower displayed value. Null, blank, negative and non-finite values never become zero. A real measured zero remains valid.
3. **Map and Nearby:** the bounds response only locates stations. Retrieve detail for at most 12 stations nearest the requested center, then apply the same normalization. Remaining/failed lookups stay selectable with neutral dashes; their unverified headline is not displayed as US AQI. Selected station details replace map summaries.
4. **Alerts:** foreground alerts consume the corrected detail response. Background alerts use the same normalization, including requested station identity validation. Stored baselines carry a calculation version; old baselines reset without sending a false jump notification. Renewing a subscription preserves a baseline only when station, scale and calculation match.
5. **Malaysia:** official DOE API values remain unchanged and explicitly labeled API. Malaysia uses its own category boundaries and DOE health guidance, including the 101–200 category. The previous common US activity guidance is no longer reused for Malaysia. The source link now points to the official DOE calculation/guidance document.
6. **Time:** WAQI detail timestamps require a real date and explicit timezone. Unzoned map timestamps never inherit the visitor's timezone. Unknown, future and stale observations do not drive health advice or alerts. The legacy DOE MapServer wall-clock encoding remains interpreted as Malaysia time, consistent with that feed's APIMS rendering path.
7. **Forecast:** validate calendar dates and `min ≤ avg ≤ max`, remove duplicate days, and preserve the explicit PM2.5 AQI model label. Explain that these are predictions and the feed supplies no model update time. Malaysia API does not acquire a WAQI forecast by relabeling it.
8. **Location and identity:** require valid station IDs and coordinates; reject an explicit UID response for a different station. Reject geographic matches over 200 km away rather than presenting them as nearby readings. Existing GPS-over-IP and saved-city behavior remains covered by regression tests.

The response property `aqi` remains a legacy numeric field for compatibility. Its meaning is defined by `index`, `units.index` and `calculation`; `index: "my"` means Malaysia API.

## Validation and limits

- All **68 official DOE station values** matched Airly's Malaysia response in the comparison snapshot taken during this investigation. This checks ingestion, not instrument calibration.
- Regression coverage includes the real Shah Alam mismatch, headline 160, pollutant maximum, missing data, zero, units, station identity, timezone handling, forecast validation, bounded map lookups, neutral pins, all Malaysia/US category boundaries, scale-specific guidance, GPS selection and alert baseline migration.
- `npm run check` and Node tests pass. Deployment also runs the build and source-versus-bundle HTML checks.
- Browser execution was attempted; all 10 scenarios were blocked before assertions because Chromium failed with `setsockopt: Operation not permitted`. They are not reported as passing. Direct tests exercise the actual frontend rendering and category functions.
- WAQI supplies precomputed sub-indices, not the raw concentrations and averaging histories needed to independently reproduce an EPA calculation. Its feed does not identify the breakpoint edition. **The WAQI view is therefore explicitly provider-derived, not a certified current-EPA NowCast calculation.** Official DOE API is the default for Malaysia.
- Sensor calibration, upstream revisions, completeness of the monitoring network and forecast skill cannot be established by reviewing this application. A monitoring station measures its location, not the user's exact surroundings.
- The bounded WAQI map lookup trades complete numerical coverage for verifiable per-station readings. Grey pins can be selected to request their detail.

## Primary references

- [DOE APIMS](https://eqms.doe.gov.my/apims/main): official station readings and Malaysia category bands.
- [DOE API calculation and health guidance](https://www.doe.gov.my/wp-content/uploads/2021/09/API_Calculation.pdf): pollutant averaging periods, maximum sub-index rule, PM2.5 breakpoints and health advice.
- [WAQI API](https://aqicn.org/api/) and [schema documentation](https://aqicn.org/json-api/doc/): pollutant fields are individual AQIs; raw concentration access is not part of this feed contract.
- [WAQI publishing guide](https://aqicn.org/publishingdata/): provider conversion to the US EPA scale and processing of averaging periods.
- [WAQI Shah Alam](https://aqicn.org/city/malaysia/selangor/shah-alam/): live headline and pollutant sub-index comparison; values change over time.
- [WAQI forecasts](https://aqicn.org/forecast/): model forecasts and their limits.
- [AirNow AQI categories](https://www.airnow.gov/aqi/aqi-basics/) and [EPA breakpoint tables](https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html): US categories and pollutant-specific breakpoints.

## Deployment verification

- Cloudflare Worker `airly`, production: <https://airly.sanjay6326.workers.dev>.
- Version: `92b00ec2-2341-45ad-88ed-d9e946137fba`; source release: `b735046408fc23bf`.
- Deployment completed with `npm run deploy`; **49/49 Node tests**, embedded frontend syntax, dry-run build and bundle equivalence passed.
- Live Shah Alam at 21:00 MYT: DOE API **175**, WAQI-derived US AQI **235**, original WAQI headline **175**. Both use their explicit source and calculation metadata.
- The tested Selangor viewport returned 10 stations; all 10 numerical values equal the rounded maximum of their pollutant sub-indices. Shah Alam's map and detail values agree. The viewport request completed in approximately 0.4 seconds in this check.
- Post-deployment comparison matched **68/68 DOE values and timestamps** against a new direct official-feed snapshot.
- Singapore automatic mode returned Central, Singapore with US AQI **187**, equal to its maximum available pollutant sub-index.
- Live HTML equals the source-generated HTML exactly; `/api/config` identifies the expected release.
- The generated workspace `/home/airly/worker.js` and configuration were synced from the verified deployment bundle.
