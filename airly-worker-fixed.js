/**
 * MIT License — Copyright (c) 2026 Airly contributors
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions: The above copyright notice and this
 * permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/**
 * AIRLY — single-file Cloudflare Worker. Official Malaysia API from DOE APIMS;
 * worldwide US AQI from WAQI. Location-aware readings, health guidance, news,
 * trend/forecast, 4-language UI (EN/BM/TA/ZH) and background Web Push.
 *
 * Required:  secret AQICN_TOKEN
 * Optional:  [ai] binding = "AI"                      -> AI advisories (else static advice)
 *            KV binding PUSH_SUBS + VAPID_* secrets
 *              + [triggers] crons = ["0,30 * * * *"]  -> background push (else in-page alerts)
 *
 * NOTE: do not minify — the frontend lives in the HTML_SOURCE function comment.
 * Audited edition: official Malaysia API auto-selection, strict US AQI units elsewhere.
 * Malaysia uses the public DOE APIMS feed; no extra token or binding is needed.
 * AI advice endpoint is retained for compatibility; primary guidance is deterministic.
 * Required secret remains AQICN_TOKEN. Deploy this file as-is, without minifying.
 */

const SEA_BOUNDS = '-11,92,29,141';
const SW_JS = "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(c=>c[0]?c[0].focus():self.clients.openWindow('/')))});self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title||'Airly',{body:d.body||''}))});";
const UPSTREAM_TIMEOUT = 8000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/push/')) return pushApi(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    if (url.pathname === '/logo.png') return png(LOGO_PNG_B64);
    if (url.pathname === '/favicon.png' || url.pathname === '/favicon.ico') return png(FAVICON_PNG_B64);
    if (url.pathname === '/og-image.png') return png(OG_PNG_B64);
    if (url.pathname === '/icon-180.png') return png(ICON_PNG_B64);
    if (url.pathname === '/manifest.webmanifest') return new Response(JSON.stringify({ id: '/', scope: '/', name: 'Airly by Ordinexis', short_name: 'Airly', description: 'Live air quality worldwide', start_url: '/', display: 'standalone', background_color: '#f6f2e9', theme_color: '#f6f2e9', icons: [{ src: '/icon-180.png', sizes: '180x180', type: 'image/png' }, { src: '/logo.png', sizes: '256x256', type: 'image/png' }] }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
    if (url.pathname === '/sw.js') return new Response(SW_JS, { headers: { 'content-type': 'text/javascript; charset=UTF-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' } });
    if (url.pathname === '/vendor/leaflet.js' || url.pathname === '/vendor/leaflet.css') return vendor(url.pathname);
    if (url.pathname === '/api/config') return json({ backgroundPush: pushReady(env) });
    if (url.pathname === '/api/air') return air(request, env);
    if (url.pathname === '/api/search') return searchStations(request);
    if (url.pathname === '/api/advice') return aiAdvice(request, env, ctx);
    if (url.pathname === '/api/location') return location(request);
    if (url.pathname === '/api/news') return news(request, ctx);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML.replaceAll('__ORIGIN__', url.origin), { headers: {
        'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-cache',
        'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'permissions-policy': 'geolocation=(self), camera=(), microphone=()', 'referrer-policy': 'strict-origin-when-cross-origin',
        'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY'
      } });
    }
    return new Response('Not found', { status: 404 });
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(checkSubscriptions(env)); }
};

const json = (data, status = 200, cache = 'no-store') => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': cache, 'x-content-type-options': 'nosniff' }
});
const number = value => (typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const clamp = (v, min, max) => v === null ? null : Math.min(max, Math.max(min, v));
const pngBytes = new Map(); // decode each embedded asset once per isolate, not per request
const png = b64 => {
  if (!pngBytes.has(b64)) pngBytes.set(b64, Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
  return new Response(pngBytes.get(b64), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400, immutable', 'x-content-type-options': 'nosniff' }
  });
};

async function fetchJson(endpoint, cf) {
  const response = await fetch(endpoint, { cf, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) });
  if (!response.ok) throw new Error('upstream ' + response.status);
  return response.json();
}

function location(request) {
  const cf = request.cf || {};
  const lat = number(cf.latitude), lon = number(cf.longitude);
  if (lat === null || lon === null) return json({ error: 'IP location unavailable' }, 404);
  return json({ lat, lon, city: cf.city || '', region: cf.region || '', country: cf.country || '' });
}

async function air(request, env) {
  const p = new URL(request.url).searchParams, uid = p.get('uid');
  if (p.has('index') && !['auto','my','us'].includes(p.get('index'))) return json({ error: 'Invalid index' }, 400);
  if (p.has('country') && !/^[A-Z]{2}$/.test(p.get('country'))) return json({ error: 'Invalid country' }, 400);
  // Station identity pins the provider: never change scales mid-refresh or alert.
  const malaysia = uid ? /^my:/.test(uid) : p.get('index') === 'my' || (p.get('index') !== 'us' && (p.get('country') || request.cf?.country) === 'MY');
  return malaysia ? malaysiaAir(request, env) : waqiAir(request, env);
}

const MY_FEED = 'https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query?where=1%3D1&outFields=STATION_ID,DATETIME,API,PARAM_SELECTED,STATION_LOCATION,LONGITUDE,LATITUDE&returnGeometry=false&f=json';
let malaysiaPending = null;
async function malaysiaStations() {
  // Coalesce concurrent map/detail reads; only public station data is edge-cached.
  if (malaysiaPending) return malaysiaPending;
  malaysiaPending = (async () => {
    const result = await fetchJson(MY_FEED, { cacheTtl: 120, cacheEverything: true });
    if (result.error || !Array.isArray(result.features) || result.exceededTransferLimit) throw Error('DOE feed unavailable');
    const fetchedAt = new Date().toISOString();
    const stations = result.features.map(f => {
      const a = f.attributes || {}, stamp = number(a.DATETIME);
      // This legacy DOE MapServer encodes Malaysian wall-clock time as UTC epoch
      // numbers. APIMS renders it with getUTC*; interpret those components as +08:00.
      const time = stamp !== null && stamp > 0 && stamp < 8640000000000000 ? new Date(stamp).toISOString().replace('Z', '+08:00') : null;
      return {
        uid: 'my:' + String(a.STATION_ID || ''), stationCode: String(a.STATION_ID || ''),
        provider: 'doe', index: 'my', name: String(a.STATION_LOCATION || 'DOE monitoring station'),
        aqi: validAqi(a.API), lat: number(a.LATITUDE), lon: number(a.LONGITUDE), time,
        fetchedAt, timezone: '+08:00', dominant: a.PARAM_SELECTED || null,
        pm25: null, pm10: null, pollutants: {}, humidity: null, wind: null, temperature: null,
        forecast: [], units: { index: 'Malaysia API' },
        attribution: [{ name: 'Department of Environment Malaysia · APIMS', url: 'https://eqms.doe.gov.my/APIMS/main' }],
        stationUrl: 'https://eqms.doe.gov.my/APIMS/main'
      };
    }).filter(s => /^my:[A-Z0-9_-]{1,20}$/.test(s.uid) && s.aqi !== null && s.lat !== null && s.lon !== null && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180);
    if (!stations.length) throw Error('No valid DOE readings');
    return stations;
  })();
  try { return await malaysiaPending; } finally { malaysiaPending = null; }
}
function stationDistance(lat, lon, s) {
  const r = Math.PI / 180, h = Math.sin((s.lat-lat)*r/2)**2 + Math.cos(lat*r)*Math.cos(s.lat*r)*Math.sin((s.lon-lon)*r/2)**2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
async function malaysiaAir(request, env) {
  const p = new URL(request.url).searchParams, uid = p.get('uid'), lat = number(p.get('lat')), lon = number(p.get('lon'));
  if ((p.has('lat') || p.has('lon')) && (lat === null || lon === null || Math.abs(lat)>90 || Math.abs(lon)>180)) return json({ error: 'Invalid coordinates' }, 400);
  if (uid !== null && !/^my:[A-Z0-9_-]{1,20}$/.test(uid)) return json({ error: 'Invalid station ID' }, 400);
  if (p.has('scope') && !['area','sea'].includes(p.get('scope'))) return json({ error: 'Invalid scope' }, 400);
  let bounds = null;
  if (p.has('bbox')) {
    bounds = p.get('bbox').split(',').map(number);
    if (bounds.length!==4 || bounds.some(x=>x===null) || bounds[0]<-90 || bounds[2]>90 || bounds[1]<-180 || bounds[3]>180 || bounds[0]>=bounds[2] || bounds[1]>=bounds[3] || bounds[2]-bounds[0]>40 || bounds[3]-bounds[1]>60) return json({ error: 'Invalid map bounds' }, 400);
  } else if (lat !== null && p.get('scope') === 'area') bounds = [lat-2,lon-3,lat+2,lon+3];
  try {
    const stations = await malaysiaStations();
    if (p.has('scope')) return json(bounds ? stations.filter(s=>s.lat>=bounds[0] && s.lat<=bounds[2] && s.lon>=bounds[1] && s.lon<=bounds[3]) : stations);
    const station = uid ? stations.find(s=>s.uid===uid) : stations.slice().sort((a,b)=>stationDistance(lat??3.139,lon??101.687,a)-stationDistance(lat??3.139,lon??101.687,b))[0];
    if (!station) return json({ error: 'This DOE station has no available API reading', code: 'NO_READING' }, 502);
    // IP country can be wrong (e.g. a VPN). Never imply a distant Malaysian station
    // measures air at a GPS position on another continent.
    if (!uid && lat !== null && stationDistance(lat,lon,station)>200) return waqiAir(request, env);
    return json(station);
  } catch { return json({ error: 'Malaysia DOE API readings are temporarily unavailable. Try again or select US AQI in settings.', code: 'DOE_UNAVAILABLE' }, 502); }
}

async function waqiAir(request, env) {
  if (!env.AQICN_TOKEN) return json({ error: 'AQICN_TOKEN is not configured', code: 'TOKEN_MISSING' }, 503);
  const url = new URL(request.url), p = url.searchParams;
  const lat = number(p.get('lat')), lon = number(p.get('lon'));
  if ((p.has('lat') || p.has('lon')) && (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180)) return json({ error: 'Invalid coordinates' }, 400);
  const uid = p.get('uid');
  if (uid !== null && !/^[1-9]\d{0,8}$/.test(uid)) return json({ error: 'Invalid station ID' }, 400);
  if (p.has('scope') && !['area','sea'].includes(p.get('scope'))) return json({ error: 'Invalid scope' }, 400);
  try {
    if (p.has('scope')) {
      let bounds = SEA_BOUNDS;
      if (lat !== null) { const center=Math.max(-83,Math.min(83,lat)); bounds = [center-2,Math.max(-180,lon-3),center+2,Math.min(180,lon+3)].join(','); }
      if (p.has('bbox')) {
        const bb = p.get('bbox').split(',').map(number);
        if (bb.length !== 4 || bb.some(x => x === null) || bb[0] < -90 || bb[2] > 90 || bb[1] < -180 || bb[3] > 180 || bb[0] >= bb[2] || bb[1] >= bb[3] || bb[2]-bb[0] > 40 || bb[3]-bb[1] > 60) return json({ error: 'Invalid map bounds' }, 400);
        bounds = bb.map(x=>x.toFixed(4)).join(',');
      }
      const result = await fetchJson('https://api.waqi.info/v2/map/bounds?latlng='+bounds+'&networks=all&token='+encodeURIComponent(env.AQICN_TOKEN));
      if (result.status !== 'ok' || !Array.isArray(result.data)) throw new Error('unavailable');
      return json(result.data.map(s => ({
        uid: number(s.uid), provider: 'waqi', index: 'us', name: String(s.station?.name || 'Monitoring station'), aqi: validAqi(s.aqi),
        lat: number(s.lat), lon: number(s.lon), time: s.station?.time || null
      })).filter(s => s.uid > 0 && s.aqi !== null && s.lat !== null && s.lon !== null && Math.abs(s.lat)<=90 && Math.abs(s.lon)<=180));
    }
    // Preserve coordinates for station matching. No artificial kilometre rounding.
    const target = uid ? '@'+uid : lat !== null ? 'geo:'+lat+';'+lon : 'geo:3.139;101.687';
    const result = await fetchJson('https://api.waqi.info/feed/'+target+'/?token='+encodeURIComponent(env.AQICN_TOKEN));
    if (result.status !== 'ok' || !result.data) throw new Error('unavailable');
    const d = result.data, stamp = d.time?.iso || (d.time?.s && /^[+-]\d{2}:\d{2}$/.test(d.time?.tz||'') ? d.time.s.replace(' ','T')+d.time.tz : null);
    const aqi = validAqi(d.aqi);
    if (aqi === null) return json({ error: 'This station has no valid AQI reading', code: 'NO_READING' }, 502);
    const value = key => number(d.iaqi?.[key]?.v);
    return json({
      uid: number(d.idx), provider: 'waqi', index: 'us', name: String(d.city?.name || 'Monitoring station'), aqi,
      lat: number(d.city?.geo?.[0]), lon: number(d.city?.geo?.[1]), time: stamp,
      fetchedAt: new Date().toISOString(), timezone: d.time?.tz || /[+-]\d{2}:\d{2}$/.exec(stamp || '')?.[0] || null, dominant: d.dominentpol || null,
      pm25: validAqi(value('pm25')), pm10: validAqi(value('pm10')),
      pollutants: Object.fromEntries(['pm25','pm10','o3','no2','so2','co'].map(k=>[k,validAqi(value(k))])),
      humidity: value('h') !== null && value('h') >= 0 && value('h') <= 100 ? value('h') : null,
      wind: value('w') !== null && value('w') >= 0 ? value('w') : null, temperature: value('t'),
      units: { pollutants: 'US AQI sub-index', wind: 'm/s', temperature: '°C', humidity: '%' },
      forecast: (d.forecast?.daily?.pm25 || []).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.day)).map(x=>({day:x.day,avg:validAqi(x.avg),min:validAqi(x.min),max:validAqi(x.max)})).filter(x=>x.avg !== null).slice(-8),
      attribution: (d.attributions || []).filter(x=>/^https?:\/\//i.test(x.url||'')).map(x=>({name:String(x.name||'Data provider'),url:x.url})),
      stationUrl: /^https?:\/\//i.test(d.city?.url||'') ? d.city.url : null
    });
  } catch { return json({ error: 'Air quality data is temporarily unavailable', code: 'UPSTREAM_UNAVAILABLE' }, 502); }
}
const validAqi = value => { const n = number(value); return n !== null && n >= 0 ? n : null; };

/**
 * AI-written health guidance via Workers AI (requires [ai] binding = "AI" in wrangler.toml).
 * Free-tier friendly: results cached 15 min per ~1km location bucket + language, so a busy
 * city costs a handful of inferences per hour. Any failure — no binding, no token, quota
 * exhausted, rate limit, timeout — returns {fallback:true} and the client keeps static text.
 * On the Workers Free plan, exhausting the free allocation makes AI.run throw (never bills).
 */
async function aiAdvice(request, env, ctx) {
  if (!env.AI || !env.AQICN_TOKEN) return json({ fallback: true }, 200, 'public, max-age=300');
  const url = new URL(request.url);
  const lat = clamp(number(url.searchParams.get('lat')), -90, 90);
  const lon = clamp(number(url.searchParams.get('lon')), -180, 180);
  const langCode = ['en','ms','ta','zh'].includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en';
  const language = ({ en:'English', ms:'Bahasa Melayu (Malay)', ta:'Tamil', zh:'Simplified Chinese' })[langCode];
  // Script check so a model that ignores the language instruction falls through to the next tier.
  const langOk = text => langCode === 'ta' ? /[஀-௿]/.test(text) : langCode === 'zh' ? /[一-鿿]/.test(text) : true;
  const sensitive = url.searchParams.get('sensitive') === '1';
  const target = lat !== null && lon !== null ? `geo:${lat.toFixed(2)};${lon.toFixed(2)}` : 'geo:3.139;101.687';
  const cache = caches.default;
  try {
    const feed = await fetchJson(`https://api.waqi.info/feed/${target}/?token=${encodeURIComponent(env.AQICN_TOKEN)}`, { cacheTtl: 120, cacheEverything: true });
    if (feed.status !== 'ok' || !feed.data || !Number.isFinite(Number(feed.data.aqi))) throw new Error('no data');
    const d = feed.data;
    // Cache key includes the EPA band AND the AQI decade bucket: a band crossing or a ~10+ unit
    // swing yields a fresh generation; small wobbles keep hitting the cached text.
    const aqiNow = Number(d.aqi);
    const bandIdx = aqiNow <= 50 ? 0 : aqiNow <= 100 ? 1 : aqiNow <= 150 ? 2 : aqiNow <= 200 ? 3 : aqiNow <= 300 ? 4 : 5;
    const key = new Request(`https://airly-cache.local/advice/v6/${encodeURIComponent(target)}/${encodeURIComponent(language)}/${sensitive ? 's' : 'n'}/${bandIdx}-${Math.round(aqiNow / 10)}`);
    const cached = await cache.match(key); if (cached) return cached;
    const fc = (d.forecast?.daily?.pm25 || []).slice(0, 3).map(x => `${x.day} avg PM2.5 ${x.avg}`).join(', ');
    // Reuse the news cache if it happens to be warm (never triggers new feed fetches).
    let headlines = '';
    try {
      const cc = /^[A-Z]{2}$/.test((request.cf || {}).country || '') ? request.cf.country : 'MY';
      const newsHit = await cache.match(new Request(`https://airly-cache.local/news/v4/${cc}/${encodeURIComponent((request.cf || {}).region || 'all')}`));
      if (newsHit) headlines = (await newsHit.json()).slice(0, 2).map(x => x.title).join(' | ');
    } catch { /* headlines are optional */ }
    // Deterministic band verdict — computed above from the official US EPA AQI table,
    // not left to the model to classify. Descriptions and cautionary statements are the
    // EPA's own (PM2.5 cautionary statements, AirNow.gov).
    const bands = [
      ['Good (0-50)', 'EPA: Air quality is satisfactory, and air pollution poses little or no risk. Cautionary statement: none — it is a good time to be active outside. Airing rooms is fine.'],
      ['Moderate (51-100)', 'EPA: Air quality is acceptable; there may be a risk only for people unusually sensitive to air pollution. Cautionary statement: unusually sensitive people should consider reducing prolonged or heavy exertion; EVERYONE ELSE can be active outside as normal. Do NOT tell the general public to avoid going outside, stay indoors, or wear masks — the EPA does not recommend that in this band.'],
      ['Unhealthy for Sensitive Groups (101-150)', 'EPA: Members of sensitive groups (heart or lung disease, asthma, older adults, children) may experience health effects; the general public is less likely to be affected. Cautionary statement: sensitive groups should reduce prolonged or heavy exertion — it is OK for them to be active outside with more breaks; the general public can continue normal activity. Keep windows closed; filtration helps.'],
      ['Unhealthy (151-200)', 'EPA: Some of the general public may experience health effects; sensitive groups may experience more serious effects. Cautionary statement: sensitive groups avoid prolonged or heavy exertion; everyone else reduce prolonged or heavy exertion. A well-fitted mask (e.g. N95) outdoors is reasonable; keep windows closed and use filtration.'],
      ['Very Unhealthy (201-300)', 'EPA health alert: the risk of health effects is increased for everyone. Cautionary statement: sensitive groups avoid all outdoor physical activity; everyone else avoid prolonged or heavy exertion. Stay indoors where possible with windows closed and filtration running; wear a well-fitted mask if going out.'],
      ['Hazardous (301+)', 'EPA health warning of emergency conditions. Cautionary statement: everyone avoid all outdoor physical activity; remain indoors, keep windows sealed, run filtration.']
    ];
    const band = bands[bandIdx];
    const prompt = `You are a cautious air-quality health advisor who follows the official US EPA Air Quality Index guidance exactly. The current US AQI is ${aqiNow}, which the EPA table classifies as "${band[0]}". Official EPA guidance for this category — your advice MUST agree with it, neither more relaxed nor more alarming: ${band[1]} Additional rules you must never break: the current absolute AQI decides safety — never judge safety by comparing to the forecast; if AQI is above 100, never suggest opening windows or unfiltered ventilation; only suggest airing rooms when AQI is 100 or below, and never describe opening windows as a way to minimize or reduce exposure — ventilation brings outdoor air in, it only helps against indoor-generated pollutants; when AQI is above 80, prefer filtration tips over ventilation tips; use only the data provided, never invent numbers.
Interpretation rails for the other variables — use them only to add nuance (comfort, heat, dispersal), NEVER to change the EPA band stance above: pollutant sub-indices are each on the same AQI bands (0-50 good, 51-100 moderate, 101-150 unhealthy for sensitive groups, and so on) — the dominant pollutant is the one driving the overall AQI, and a pollutant whose sub-index sits in a lower band than the overall AQI is not a concern worth mentioning. Temperature C: below 20 cool, 20-27 comfortable, 27-33 hot (hydrate during exertion), above 33 very hot (heat stress risk — prefer morning/evening exertion). Humidity %: below 30 dry, 30-60 comfortable, 60-80 humid, above 80 very humid (exertion feels harder; combined with heat, add heat caution). Wind m/s: below 1 calm (pollution tends to linger), 1-4 light, 4-8 moderate (helps disperse pollution), above 8 strong (disperses pollution quickly — conditions may improve ahead of the forecast).
Data — air quality near ${d.city?.name || 'the user'}: US AQI ${d.aqi}, dominant pollutant ${d.dominentpol || 'n/a'}; pollutant sub-indices (AQI units) — PM2.5 ${d.iaqi?.pm25?.v ?? 'n/a'}, PM10 ${d.iaqi?.pm10?.v ?? 'n/a'}, ozone ${d.iaqi?.o3?.v ?? 'n/a'}, NO2 ${d.iaqi?.no2?.v ?? 'n/a'}, SO2 ${d.iaqi?.so2?.v ?? 'n/a'}, CO ${d.iaqi?.co?.v ?? 'n/a'}; weather — temperature ${d.iaqi?.t?.v ?? 'n/a'}C, humidity ${d.iaqi?.h?.v ?? 'n/a'}%, wind ${d.iaqi?.w?.v ?? 'n/a'} m/s. PM2.5 forecast: ${fc || 'unavailable'}. Ignore any value marked n/a.${headlines ? ` Recent local headlines: ${headlines}.` : ''}
Task: write practical guidance for a resident${sensitive ? ' with a sensitive health profile (asthma, heart or lung conditions)' : ''} right now: exactly 2 short sentences, at most 40 words total, plain text, no preamble, no lists. Cover whether to go outside now, plus one concrete everyday tip (exercise timing, commuting, ventilation, masks, or indoor air) consistent with the rules above. Mention the trend only as trend, never as a reason to relax precautions. Respond ONLY in ${language} — every word of the reply must be in ${language}.`;
    // Newest suitable model first (fast MoE, strong multilingual), older model as backup.
    const MODELS = ['@cf/qwen/qwen3-30b-a3b-fp8', '@cf/meta/llama-3.2-3b-instruct'];
    let text = '';
    for (const model of MODELS) {
      try {
        const ai = await Promise.race([
          env.AI.run(model, { messages: [{ role: 'user', content: prompt }], max_tokens: 220 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('ai timeout')), UPSTREAM_TIMEOUT))
        ]);
        text = String(ai?.response || ai?.output_text || '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '') // Qwen3 reasoning blocks
          .replace(/\s+/g, ' ').trim().slice(0, 320);
        // Reject contradictory ventilation advice when the air is bad (en/ms/zh/ta patterns).
        const badVent = aqiNow > 100 && /open(?:ing|ed)?\s+(?:the\s+|your\s+|some\s+)?windows?|windows?\s+open|membuka\s+tingkap|buka(?:kan)?\s+tingkap|开窗|打开窗|开着窗|ஜன்னல்[^.]{0,20}திற/i.test(text);
        // Reject over-alarming advice when the air is good/moderate (mirror guard).
        const overAlarm = aqiNow <= 100 && /avoid\s+(?:going\s+)?out|stay\s+indoors?|do\s+not\s+go\s+out|\bN95\b|\bunhealthy\b|elakkan\s+keluar|kekal\s+di\s+dalam|tidak\s+sihat|避免外出|留在室内|不健康|வெளியே\s+செல்ல\s+வேண்டாம்|ஆரோக்கியமற்ற/i.test(text);
        const minLen = langCode === 'zh' ? 10 : 20; // CJK says more per character
        if (text.length >= minLen && langOk(text) && !badVent && !overAlarm) break; text = '';
      } catch { /* try next model */ }
    }
    if (!text) throw new Error('no ai output');
    // Browser holds advice max 2 min; the edge keeps it 15 min (s-maxage) for free-tier economy.
    const response = json({ advice: text }, 200, 'public, max-age=120, s-maxage=900');
    ctx.waitUntil(cache.put(key, response.clone()));
    return response;
  } catch { return json({ fallback: true }, 200, 'no-store'); }
}

// City finder: Open-Meteo geocoding (free, keyless), proxied so the client stays same-origin.
// Picking a city then rides the normal nearest-station flow (geo feed) to home in on a reading.
async function searchStations(request) {
  const u = new URL(request.url);
  const q = (u.searchParams.get('q') || '').trim().slice(0, 60);
  if (q.length < 2) return json([], 200, 'public, max-age=3600');
  const langP = u.searchParams.get('lang') === 'zh' ? 'zh' : 'en';
  try {
    const result = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${langP}&format=json`, { cacheTtl: 86400, cacheEverything: true });
    return json((result.results || []).map(x => ({ name: x.name, country: x.country_code || '', region: [x.admin1, x.country].filter(Boolean).join(', '), lat: number(x.latitude), lon: number(x.longitude) })).filter(x => x.name && x.lat !== null && x.lon !== null).slice(0, 8), 200, 'public, max-age=86400');
  } catch { return json([], 200, 'public, max-age=120'); }
}

async function vendor(pathname) {
  const isJs = pathname.endsWith('.js');
  const file = isJs ? 'leaflet.js' : 'leaflet.css';
  const sources = [
    `https://unpkg.com/leaflet@1.9.4/dist/${file}`,
    `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/${file}`
  ];
  for (const source of sources) {
    try {
      const upstream = await fetch(source, { cf: { cacheTtl: 86400, cacheEverything: true }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) });
      if (!upstream.ok) continue;
      return new Response(upstream.body, { headers: { 'content-type': isJs ? 'text/javascript; charset=UTF-8' : 'text/css; charset=UTF-8', 'cache-control': 'public, max-age=86400, immutable', 'x-content-type-options': 'nosniff' } });
    } catch { /* try next source */ }
  }
  return new Response('Map library unavailable', { status: 502 });
}

async function news(request, ctx) {
  const reqUrl = new URL(request.url);
  const fresh = reqUrl.searchParams.get('fresh') === '1';
  const cf = request.cf || {};
  const requested = reqUrl.searchParams.get('locale');
  const country = requested && requested !== 'AUTO' && /^[A-Z]{2}$/.test(requested) ? requested : (/^[A-Z]{2}$/.test(cf.country || '') ? cf.country : 'MY');
  let countryName = country; try { countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country } catch {}
  const isSea = { MY:1, SG:1, ID:1, TH:1, VN:1, PH:1, BN:1, KH:1, LA:1, MM:1, TL:1 }[country];
  const city = (reqUrl.searchParams.get('city') || '').replace(/[\u0000-\u001f]/g,'').trim().slice(0,80);
  const localArea = city || ((!requested || requested === 'AUTO' || country === cf.country) ? (cf.city || cf.region || '') : '');
  const cache = caches.default;
  const key = new Request(`https://airly-cache.local/news/v5/${country}/${encodeURIComponent(localArea || 'all')}`);
  if (!fresh) { const cached = await cache.match(key); if (cached) { const response=new Response(cached.body,cached); response.headers.set('cache-control','private, max-age=900'); return response; } }
  try {
    // Decode &amp; LAST so "&amp;lt;" doesn't become "<"; strip tags before entity decode.
    const decode = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
    const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);
    const scopes = [
      localArea ? { label:'Near you', query:`air quality haze PM2.5 ${localArea} ${countryName}` } : null,
      { label:countryName, query:`air quality haze PM2.5 ${countryName}` },
      isSea ? { label:'Southeast Asia', query:'air quality haze PM2.5 Southeast Asia' } : null,
      { label:'Global', query:'air quality pollution wildfire smoke global' }
    ].filter(Boolean);
    const market = ({ MY:'en-MY', SG:'en-SG', ID:'id-ID', TH:'th-TH', VN:'vi-VN', PH:'en-PH', US:'en-US', GB:'en-GB', IN:'en-IN', AU:'en-AU', CN:'zh-CN', TW:'zh-TW', HK:'zh-HK', JP:'ja-JP', KR:'ko-KR', DE:'de-DE', FR:'fr-FR' })[country] || 'en-US';
    const feeds = (await Promise.allSettled(scopes.map(async scope => {
      const rssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(scope.query)}&format=rss&mkt=${market}&qft=${encodeURIComponent('sortbydate="1"')}`;
      const response = await fetch(rssUrl, { headers:{ 'user-agent':'Airly/1.0 (+https://www.ordinexis.com) RSS reader' }, cf:{ cacheTtl:900, cacheEverything:true }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) });
      if (!response.ok) return [];
      const rss = await response.text();
      return [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => ({ title:tag(m[1],'title'), link:tag(m[1],'link'), source:`${scope.label} · ${tag(m[1],'News:Source') || tag(m[1],'source') || 'News'}`, published:tag(m[1],'pubDate') })).filter(x => x.title && /^https?:\/\//i.test(x.link || '')).sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0)).slice(0,4);
    }))).map(r => r.status === 'fulfilled' ? r.value : []);
    const seen = new Set();
    // Keep local → country → region → global priority, newest first within each group.
    const stories = feeds.flat().filter(story => { const id = story.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'').slice(0,120); if(seen.has(id)) return false; seen.add(id); return true; })
      .slice(0,16);
    const cacheable = json(stories, 200, 'public, max-age=900'); ctx.waitUntil(cache.put(key, cacheable.clone()));
    return json(stories, 200, fresh ? 'no-store' : 'private, max-age=900');
  } catch { return json([], 200, 'public, max-age=120'); }
}

/* ==== Background Web Push ====================================================
 * Setup (all three required, else the feature degrades gracefully to in-page alerts):
 *   1. KV namespace bound as PUSH_SUBS   ->  [[kv_namespaces]] binding = "PUSH_SUBS", id = "..."
 *   2. Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (from `npx web-push generate-vapid-keys`),
 *      optional VAPID_SUBJECT ("mailto:you@example.com")
 *   3. Cron:  [triggers] crons = ["0,30 * * * *"]   (every 30 minutes)
 * ==========================================================================*/
const b64uToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const pad = s.length % 4 ? '='.repeat(4 - s.length % 4) : ''; return Uint8Array.from(atob(s + pad), c => c.charCodeAt(0)) };
const bytesToB64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pushReady = env => !!(env.PUSH_SUBS && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

async function vapidJwt(env, audience) {
  const pub = b64uToBytes(env.VAPID_PUBLIC_KEY);
  const jwk = { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY, x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)) };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToB64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: env.VAPID_SUBJECT || 'mailto:hello@ordinexis.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(header + '.' + payload));
  return header + '.' + payload + '.' + bytesToB64u(sig);
}

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// RFC 8291 aes128gcm payload encryption
async function encryptPayload(sub, payload) {
  const clientPub = b64uToBytes(sub.keys.p256dh), auth = b64uToBytes(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const clientKey = await crypto.subtle.importKey('raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, local.privateKey, 256));
  const enc = new TextEncoder();
  const ikm = await hkdf(auth, shared, new Uint8Array([...enc.encode('WebPush: info\0'), ...clientPub, ...localPub]), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, new Uint8Array([...enc.encode(payload), 2])));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return new Uint8Array([...salt, ...rs, 65, ...localPub, ...cipher]);
}

async function sendPush(env, sub, payload) {
  const audience = new URL(sub.endpoint).origin;
  const [jwt, body] = await Promise.all([vapidJwt(env, audience), encryptPayload(sub, payload)]);
  return fetch(sub.endpoint, { method: 'POST', headers: { ttl: '3600', urgency: 'normal', 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}` }, body, signal: AbortSignal.timeout(10000) });
}

const subKeyOf = async endpoint => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))].map(b => b.toString(16).padStart(2, '0')).join('');

function validPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return null;
  try { const u=new URL(endpoint); if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    return ['fcm.googleapis.com','android.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname) || u.hostname.endsWith('.notify.windows.com') ? endpoint : null;
  } catch { return null; }
}

async function pushApi(request, env) {
  if (!pushReady(env)) return json({ fallback: true }, 200, 'no-store');
  const url = new URL(request.url);
  if (url.pathname === '/api/push/key' && request.method === 'GET') return json({ key: env.VAPID_PUBLIC_KEY }, 200, 'public, max-age=86400');
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Origin not allowed' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 4096) return json({ error: 'Body too large' }, 413);
  let body; try { const raw = await request.text(); if (raw.length > 4096) return json({ error: 'Body too large' }, 413); body = JSON.parse(raw); } catch { return json({ error: 'invalid body' }, 400) }
  const endpoint = validPushEndpoint(body?.endpoint);
  if (!endpoint) return json({ error: 'invalid subscription' }, 400);
  const id = await subKeyOf(endpoint);
  if (url.pathname === '/api/push/unsubscribe') { await env.PUSH_SUBS.delete(id); return json({ ok: true }); }
  if (url.pathname === '/api/push/subscribe') {
    if (typeof body.keys?.p256dh !== 'string' || typeof body.keys?.auth !== 'string') return json({ error: 'invalid subscription' }, 400);
    const lat = number(body.lat), lon = number(body.lon), my = typeof body.uid === 'string' && /^my:[A-Z0-9_-]{1,20}$/.test(body.uid), uid = my ? body.uid : number(body.uid);
    if (lat === null || lon === null || Math.abs(lat)>90 || Math.abs(lon)>180 || (!my && (!Number.isInteger(uid) || uid<=0))) return json({ error: 'Invalid station' }, 400);
    const rec = { endpoint, keys: { p256dh: body.keys.p256dh.slice(0, 200), auth: body.keys.auth.slice(0, 60) },
      uid, index: my ? 'my' : 'us', lat, lon, delta: Math.min(100, Math.max(10, Number(body.delta) || 25)),
      lang: ['en', 'ms', 'ta', 'zh'].includes(body.lang) ? body.lang : 'en', lastAqi: null, ts: Date.now() };
    await env.PUSH_SUBS.put(id, JSON.stringify(rec));
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}

const PUSH_I18N = {
  en: (n, d, dir, a) => [`Airly — air quality ${dir > 0 ? 'worsened' : 'improved'}`, `${n}: AQI ${dir > 0 ? 'rose' : 'fell'} ${d} to ${a}.`],
  ms: (n, d, dir, a) => [`Airly — kualiti udara ${dir > 0 ? 'merosot' : 'bertambah baik'}`, `${n}: AQI ${dir > 0 ? 'naik' : 'turun'} ${d} kepada ${a}.`],
  ta: (n, d, dir, a) => [`Airly — காற்றுத் தரம் ${dir > 0 ? 'மோசமடைந்தது' : 'மேம்பட்டது'}`, `${n}: AQI ${d} ${dir > 0 ? 'உயர்ந்து' : 'குறைந்து'} ${a} ஆனது.`],
  zh: (n, d, dir, a) => [`Airly — 空气质量${dir > 0 ? '恶化' : '改善'}`, `${n}：AQI ${dir > 0 ? '上升' : '下降'} ${d}，现为 ${a}。`]
};

async function checkSubscriptions(env) {
  if (!pushReady(env)) return;
  const list = await env.PUSH_SUBS.list({ limit: 1000 });
  const feedMemo = new Map(); // one request per station, one DOE snapshot per run
  for (const k of list.keys) {
    try {
      const rec = JSON.parse(await env.PUSH_SUBS.get(k.name) || 'null'); if (!rec?.endpoint) continue;
      if (!validPushEndpoint(rec.endpoint)) continue;
      const my = typeof rec.uid === 'string' && /^my:[A-Z0-9_-]{1,20}$/.test(rec.uid);
      if (!my && !env.AQICN_TOKEN) continue;
      const bucket = my ? rec.uid : Number.isInteger(rec.uid) && rec.uid > 0 ? '@'+rec.uid : 'geo:'+Number(rec.lat)+';'+Number(rec.lon);
      if (!feedMemo.has(bucket)) {
        if (my) {
          if (!feedMemo.has('doe')) feedMemo.set('doe', await malaysiaStations().catch(()=>[]));
          const d = feedMemo.get('doe').find(s=>s.uid===rec.uid);
          feedMemo.set(bucket, d ? {status:'ok',data:{aqi:d.aqi,city:{name:d.name},time:{iso:d.time}}} : null);
        } else feedMemo.set(bucket, await fetchJson(`https://api.waqi.info/feed/${bucket}/?token=${encodeURIComponent(env.AQICN_TOKEN)}`).catch(() => null));
      }
      const feed = feedMemo.get(bucket); if (!feed) continue;
      const aqi = validAqi(feed?.data?.aqi), stamp = Date.parse(feed?.data?.time?.iso || '');
      if (feed?.status !== 'ok' || aqi === null || !Number.isFinite(stamp) || Date.now()-stamp>10800000 || stamp>Date.now()+600000) continue;
      if (Number.isFinite(rec.lastTime) && stamp<=rec.lastTime) continue;
      if (Number.isFinite(rec.lastTime) && Date.now()-rec.lastTime>10800000) rec.lastAqi=null;
      if (Number.isFinite(rec.lastAqi) && Math.abs(aqi - rec.lastAqi) >= rec.delta) {
        const dir = aqi > rec.lastAqi ? 1 : -1;
        const [title, msg] = (PUSH_I18N[rec.lang] || PUSH_I18N.en)(feed.data.city?.name || 'Your area', Math.abs(aqi - rec.lastAqi), dir, aqi);
        const res = await sendPush(env, rec, JSON.stringify({ title, body: msg.replace('AQI',my?'Malaysia API':'US AQI') }));
        if (res.status === 404 || res.status === 410) { await env.PUSH_SUBS.delete(k.name); continue; }
        if (res.ok) { rec.lastAqi = aqi; rec.lastTime = stamp; await env.PUSH_SUBS.put(k.name, JSON.stringify(rec)); }
      } else if (!Number.isFinite(rec.lastAqi)) { rec.lastAqi = aqi; rec.lastTime = stamp; await env.PUSH_SUBS.put(k.name, JSON.stringify(rec)); }
    } catch { /* continue with next subscriber */ }
  }
}

function HTML_SOURCE(){/*<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#fffefa"><title>Airly by Ordinexis — Air quality near you</title><link rel="stylesheet" href="/vendor/leaflet.css">
<style>
:root{--ink:#16382d;--muted:#56665f;--paper:#fffefa;--base:#f4f5f0;--line:#dce4dd;--green:#27694f;--soft:#e8f1ea;--header:114px;--nav:68px;color-scheme:light}
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:var(--ink);background:var(--paper);-webkit-text-size-adjust:100%}
button,input,select{font:inherit}button,a,input,select{-webkit-tap-highlight-color:transparent}button{cursor:pointer;touch-action:manipulation}button:disabled{cursor:default;opacity:.55}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #257bc2;outline-offset:3px}button{color:inherit}a{color:var(--green);text-underline-offset:3px}button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.hidden,[hidden]{display:none!important}
.app{height:100vh;height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.top{background:var(--paper);border-bottom:1px solid var(--line);padding:12px max(20px,env(safe-area-inset-right)) 10px max(20px,env(safe-area-inset-left));display:grid;grid-template-columns:1fr auto;gap:10px 16px;z-index:20}.brand{text-decoration:none;color:var(--ink);display:flex;align-items:center;gap:7px;font-size:23px;font-weight:750;letter-spacing:-.7px}.brand img{width:24px;height:24px}.brand small{font-weight:450;font-size:11px;letter-spacing:0;color:var(--muted);align-self:center}.actions{display:flex;align-items:center;gap:5px}.icon-button,.round{height:44px;min-width:44px;border:1px solid var(--line);border-radius:8px;background:transparent;display:inline-flex;align-items:center;justify-content:center;padding:9px}.actions select{max-width:86px;padding:0 6px;font-size:14px}.locationbar{grid-column:1/-1;display:flex;gap:8px;align-items:center;min-width:0}.locationbar .place{background:transparent;border:0;min-width:0;min-height:36px;padding:0;display:flex;gap:7px;align-items:center;font-size:13px}.place span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.locationbar .refresh{margin-left:auto;min-width:36px;height:36px;border:0;padding:5px}.connection{color:var(--muted);font-size:11px;white-space:nowrap}.workspace{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 420px;position:relative}.map-wrap{position:relative;min-width:0;min-height:0;background:#e8eee7;isolation:isolate}.map{position:absolute;inset:0;z-index:1}.map-controls{position:absolute;top:14px;left:14px;z-index:800;display:flex;gap:6px}.map-controls button{background:var(--paper);border:1px solid #ccd5ce}.map-hint{position:absolute;z-index:800;bottom:36px;left:14px;right:14px;pointer-events:none;font-size:12px}.map-hint span{background:var(--paper);padding:5px 9px;display:inline-block;border:1px solid var(--line);border-radius:5px}.map-status{background:var(--paper);padding:20px;color:var(--muted)}.card{min-width:0;min-height:0;overflow:auto;border-left:1px solid var(--line);padding:20px 24px 16px;scrollbar-width:thin;overscroll-behavior:contain;background:var(--paper)}.tabs{display:flex;gap:2px;padding:4px 16px;position:absolute;top:0;right:0;width:420px;background:var(--paper);border-bottom:1px solid var(--line);z-index:10}.tabs button{flex:1;min-width:0;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 2px;border:0;border-radius:6px;background:transparent;font-size:11px;color:var(--muted)}.tabs button svg{display:none}.tabs button[aria-selected=true]{background:var(--soft);color:var(--ink);font-weight:700}.tabs [data-tab=map]{display:none}.card{padding-top:78px}.live{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);margin:0 0 16px}.status-dot{width:7px;height:7px;border-radius:100%;background:#6a7c70;flex-shrink:0}.live[data-quality=fresh] .status-dot{background:#327657}.live[data-quality=stale] .status-dot{background:#b77916}.eyebrow{font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin:0 0 5px}.station-name{font-size:19px;line-height:1.35;font-weight:650;letter-spacing:-.35px;margin:0;overflow-wrap:anywhere}.distance{font-size:12px;color:var(--muted);margin:6px 0 14px}.score{display:flex;gap:18px;align-items:center;margin:12px 0 18px}.score strong{font-size:82px;letter-spacing:-5px;line-height:1;font-weight:650;font-variant-numeric:tabular-nums}.score span{font-size:12px;color:var(--muted)}.score b{display:block;font-size:19px;line-height:1.25;max-width:190px;color:var(--ink);font-weight:650;margin-bottom:5px}.aqi-scale{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin:0 0 22px}.aqi-scale i{height:5px;border-radius:2px;opacity:.3}.aqi-scale i.active{opacity:1;transform:scaleY(1.8)}.advice{border-left:3px solid var(--green);padding:2px 0 2px 14px;margin:0 0 20px}.advice h2{font-size:15px;margin:0 0 5px}.advice p{font-size:14px;line-height:1.55;margin:0;color:#3f5148}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:18px 0;margin:0;border-block:1px solid var(--line)}.metric span,.metric small{display:block;font-size:11px;color:var(--muted)}.metric b{display:block;font-size:23px;font-weight:600;margin:3px 0;letter-spacing:-.5px;font-variant-numeric:tabular-nums}.reading-details{margin:16px 0;font-size:12px;color:var(--muted)}.reading-details summary{cursor:pointer;min-height:32px;display:flex;align-items:center;gap:6px;color:var(--ink);font-weight:600}.reading-details summary:after{content:'+';margin-left:auto}.reading-details[open] summary:after{content:'−'}.reading-details p{margin:8px 0;line-height:1.6}.reading-details a{display:inline}.pollutants{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px;margin:8px 0}.pollutants span{padding:7px;background:var(--base);border-radius:4px}.alert{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;min-height:48px;text-align:left;border:1px solid var(--line);border-radius:8px;background:var(--base);margin:18px 0}.alert span{flex:1}.alert b{font-size:13px;display:block}.alert small{display:block;font-size:11px;color:var(--muted);margin-top:2px}.credit{border-top:1px solid var(--line);padding-top:16px;margin-top:24px;font-size:11px;line-height:1.65;color:var(--muted)}.credit p{margin:3px 0}.credit .credits{display:flex;gap:4px 10px;flex-wrap:wrap}.credits span{white-space:nowrap}.panel h2{font-size:23px;letter-spacing:-.5px;font-weight:650;margin:0 0 6px}.panel>p{margin:0 0 18px;font-size:13px;color:var(--muted)}.row{width:100%;display:flex;align-items:center;gap:12px;border:0;border-bottom:1px solid var(--line);background:transparent;padding:14px 0;text-align:left;min-height:64px}.row:hover{background:var(--base)}.row .row-text{flex:1;min-width:0}.row b{display:block;font-size:14px;font-weight:600;overflow-wrap:anywhere}.row small{display:block;color:var(--muted);font-size:12px;margin-top:3px}.badge{min-width:42px;height:38px;display:grid;place-items:center;border-radius:6px;color:white;font-size:13px;font-weight:700;flex-shrink:0}.story{display:block;text-decoration:none;padding:15px 0;border-bottom:1px solid var(--line);color:var(--ink)}.story b{display:block;font-size:15px;line-height:1.45;font-weight:600;margin:5px 0}.story small,.story span{display:block;font-size:11px;color:var(--muted)}.panelhead{display:flex;justify-content:space-between;align-items:start;gap:10px}.notice{padding:12px 14px;border:1px solid #e1d4aa;border-radius:6px;background:#fff9e9;color:#6b522a;font-size:12px;margin:12px 0}.empty{padding:28px 0;min-height:210px}.empty h1{font-size:25px;letter-spacing:-.5px;line-height:1.25;margin:10px 0}.empty p{font-size:14px;color:var(--muted)}.primary{background:var(--ink);color:white;min-height:46px;border:0;border-radius:7px;padding:10px 16px}.skeleton{height:14px;border-radius:3px;background:#e5ebe4;margin:14px 0;animation:breathe 1.5s ease-in-out infinite alternate}.skeleton.score-load{height:78px;width:55%;margin:26px 0}.overlay{position:fixed;inset:0;background:#10261c65;display:flex;justify-content:center;align-items:center;padding:16px;z-index:200}.modal{background:var(--paper);padding:28px;width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;border:1px solid var(--line);border-radius:12px;position:relative}.modal h2{font-size:23px;letter-spacing:-.5px;margin:0 40px 8px 0}.modal>p{font-size:13px;color:var(--muted)}.close{position:absolute;right:10px;top:10px;height:44px;width:44px;border:0;background:transparent;font-size:26px}.field{display:block;margin:20px 0;font-size:14px}.field input[type=range]{width:100%;height:44px;accent-color:var(--green)}.setting{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px 0;border-top:1px solid var(--line)}.setting b{font-size:14px}.setting small{display:block;color:var(--muted);font-size:12px;margin-top:4px}.setting input{width:24px;height:24px;accent-color:var(--green);flex-shrink:0}.field select,.sinput{width:100%;min-height:48px;border:1px solid var(--line);border-radius:6px;padding:10px;background:var(--paper);color:var(--ink);font-size:16px}.save{width:100%;margin-top:12px}.toast{position:fixed;z-index:300;bottom:22px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 32px);padding:12px 16px;font-size:13px;border-radius:8px;background:var(--ink);color:#fff;box-shadow:0 4px 18px #10251c20;pointer-events:none}.leaflet-container{font-family:inherit;background:#e6eee7}.leaflet-control-attribution{font-size:10px!important}.leaflet-control-zoom{box-shadow:none!important;border:1px solid var(--line)!important}.leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important}.map-bubble{height:34px;min-width:38px;padding:0 5px;display:grid;place-items:center;background:var(--aqi);border:2px solid #fff;border-radius:8px;color:#fff;font-size:12px;font-weight:750;font-variant-numeric:tabular-nums;box-shadow:0 1px 4px #17261e30}.map-bubble{position:relative}.map-bubble:after{content:'';position:absolute;bottom:-6px;left:14px;border:4px solid transparent;border-top-color:var(--aqi);border-bottom:0}.mobile-map-card>span:last-child{flex:none;width:24px}.map-bubble.active{outline:3px solid #173c30;outline-offset:2px}.user-dot{width:16px;height:16px;background:#257bc2;border:3px solid white;border-radius:100%;box-shadow:0 0 0 6px #257bc230}.forecast-row{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid var(--line);font-size:13px}.forecast-row span{color:var(--muted)}.mobile-map-card{display:none}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.spin{animation:rotate 1s linear infinite}.chart{width:100%;height:auto}.chart text{font-family:inherit}.lang-ta .tabs button{font-size:10px}
@keyframes rotate{to{transform:rotate(360deg)}}@keyframes breathe{to{opacity:.5}}
@media(min-width:1100px){.top{grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;padding-top:12px;padding-bottom:12px}.actions{grid-column:3;grid-row:1;justify-self:end}.locationbar{grid-column:2;grid-row:1;min-width:280px}}
@media(max-width:820px){.workspace{display:block;min-height:0;overflow:hidden}.top{padding:7px max(12px,env(safe-area-inset-right)) 4px max(12px,env(safe-area-inset-left));gap:3px 8px}.brand{font-size:21px;gap:5px;letter-spacing:-.6px}.brand small{font-size:10px;display:block;max-width:58px;line-height:1.15}.actions{gap:2px}.actions .icon-button{border:0}.actions select{width:64px;font-size:13px;border:0}.locationbar .place{font-size:12px}.locationbar{gap:4px}.connection{font-size:10px}.card{border:0;position:absolute;inset:0 0 calc(var(--nav) + env(safe-area-inset-bottom));padding:22px max(20px,env(safe-area-inset-right)) 20px max(20px,env(safe-area-inset-left));}.tabs{position:absolute;top:auto;bottom:0;left:0;right:0;width:100%;height:calc(var(--nav) + env(safe-area-inset-bottom));padding:4px max(6px,env(safe-area-inset-right)) calc(4px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));border:0;border-top:1px solid var(--line);gap:0}.tabs button{font-size:11px;min-height:56px;border-radius:6px;gap:4px}.tabs button svg{display:block;width:20px;height:20px}.tabs [data-tab=map]{display:flex}.tabs button[aria-selected=true]{background:transparent;color:var(--green)}.tabs button[aria-selected=true] svg{stroke-width:2.4}.map-wrap{position:absolute;inset:0 0 calc(var(--nav) + env(safe-area-inset-bottom));visibility:hidden;pointer-events:none}.app[data-view=map] .map-wrap{visibility:visible;pointer-events:auto}.app[data-view=map] .card{display:none}.score strong{font-size:88px}.score{margin-top:18px}.station-name{font-size:22px}.live{margin-bottom:20px}.credit{margin-top:22px}.map-hint{bottom:107px}.mobile-map-card{position:absolute;z-index:800;left:14px;right:14px;bottom:32px;min-height:58px;padding:10px 14px;display:flex;align-items:center;gap:12px;border:1px solid var(--line);background:var(--paper);border-radius:8px;text-align:left}.mobile-map-card>span{min-width:0;flex:1}.mobile-map-card b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.mobile-map-card small{font-size:11px;color:var(--muted)}.mobile-map-card strong{font-size:25px}.overlay{align-items:flex-end;padding:0}.modal{max-height:calc(100dvh - 20px);width:100%;border-radius:16px 16px 0 0;padding:26px 22px calc(22px + env(safe-area-inset-bottom));border:0}.toast{bottom:calc(80px + env(safe-area-inset-bottom))}.leaflet-control-zoom{margin-bottom:116px!important}}
@media(max-width:360px){.brand small{display:none}.card{padding-left:16px;padding-right:16px}.connection{max-width:88px;overflow:hidden;text-overflow:ellipsis}.tabs button{font-size:10px}.score strong{font-size:78px}.score b{font-size:17px}}
.map-hint{left:64px}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;scroll-behavior:auto!important;transition:none!important}}

</style>
</head><body><main class="app" data-view="now">
<header class="top">
<a class="brand" href="/" aria-label="Airly by Ordinexis"><img src="/favicon.png" alt="" width="24" height="24">Airly <small>by Ordinexis</small></a>
<div class="actions"><button class="icon-button" id="open-search" aria-label="Search for a city" data-icon="search"></button><select class="round" id="lang" aria-label="Language"><option value="en">EN</option><option value="ms">BM</option><option value="ta">தமிழ்</option><option value="zh">中文</option></select><button class="icon-button" id="open-settings" aria-label="Settings" data-icon="settings"></button></div>
<div class="locationbar"><button class="place" id="location" aria-label="Use my location"><span data-icon="location"></span><span id="place">Finding your area…</span></button><span id="connection" class="connection" role="status">Connecting</span><button class="icon-button refresh" id="refresh" aria-label="Refresh current station" data-icon="refresh"></button></div>
</header>
<div class="workspace">
<section class="map-wrap" aria-label="Air quality map"><div id="map" class="map"><p class="map-status">Loading map…</p></div><div class="map-controls"><button id="locate" class="icon-button" aria-label="Centre map on my location" data-icon="location"></button></div><div class="map-hint"><span id="map-hint">US AQI · tap a station</span></div><button class="mobile-map-card" id="map-reading"><span><b id="map-station">Select a station</b><small id="map-reading-label">View air quality</small></span><strong id="map-aqi">—</strong><span data-icon="arrow"></span></button></section>
<aside class="card" id="card" aria-label="Air quality dashboard">
<section id="now" role="tabpanel" aria-labelledby="tab-now"></section>
<section id="nearby" role="tabpanel" aria-labelledby="tab-nearby" hidden></section>
<section id="news" role="tabpanel" aria-labelledby="tab-news" hidden></section>
<section id="trend" role="tabpanel" aria-labelledby="tab-trend" hidden></section>
<footer class="credit"><p>Airly by <a href="https://www.ordinexis.com" target="_blank" rel="noopener noreferrer">Ordinexis</a> · <a href="https://github.com/sanjayws/airly" target="_blank" rel="noopener noreferrer">GitHub</a></p><p data-i18n="privacyNote">Preferences stay on this device.</p><div class="credits"><span>Map: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></span><span>Data: <a id="data-source" href="https://waqi.info" target="_blank" rel="noopener noreferrer">World Air Quality Index Project</a></span></div></footer>
</aside>
<nav class="tabs" role="tablist" aria-label="Views">
<button id="tab-now" role="tab" data-tab="now" aria-controls="now" aria-selected="true"><span data-icon="air"></span><span data-i18n="now">Air Quality</span></button>
<button id="tab-map" role="tab" data-tab="map" aria-controls="map" aria-selected="false"><span data-icon="map"></span><span data-i18n="mapTab">Map</span></button>
<button id="tab-nearby" role="tab" data-tab="nearby" aria-controls="nearby" aria-selected="false"><span data-icon="location"></span><span data-i18n="nearby">Nearby</span></button>
<button id="tab-news" role="tab" data-tab="news" aria-controls="news" aria-selected="false"><span data-icon="news"></span><span data-i18n="news">News</span></button>
<button id="tab-trend" role="tab" data-tab="trend" aria-controls="trend" aria-selected="false"><span data-icon="chart"></span><span data-i18n="forecastTab">Forecast</span></button>
</nav>
</div>
<div id="modal" class="overlay" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button class="close" id="close" aria-label="Close settings">×</button><h2 id="settings-title" data-i18n="settingsBtn">Settings</h2><p data-i18n="settingsNote">Preferences are saved on this device.</p>
<label class="field"><span data-i18n="indexL">Air quality index</span><select id="index"><option value="auto" data-i18n="indexAuto">Automatic · Malaysia API in Malaysia</option><option value="my" data-i18n="indexMY">Malaysia API · official DOE stations</option><option value="us" data-i18n="indexUS">US AQI · worldwide stations</option></select></label>
<label class="field"><span data-i18n="deltaL">Notify when AQI changes by</span> <b id="delta-label">25+</b><input id="delta" type="range" min="10" max="100" step="5" value="25"></label>
<label class="setting"><span><b data-i18n="notifT">Browser notifications</b><small id="notify-help" data-i18n="foregroundNote">Check for changes while this app is open.</small></span><input id="browser-alert" type="checkbox"></label>
<label class="setting" id="background-setting" hidden><span><b data-i18n="backgroundTitle">Background alerts</b><small data-i18n="backgroundNote">Opt in to store this station and your push subscription on the server for scheduled checks. Turn off to delete the subscription.</small></span><input id="background-alert" type="checkbox"></label>
<label class="setting"><span><b data-i18n="sensT">Sensitive health profile</b><small data-i18n="sensS">Stricter personal guidance</small></span><input id="sensitive" type="checkbox"></label>
<label class="field"><span data-i18n="localeL">Local news</span><select id="locale"><option value="AUTO">Automatic</option value="MY">Malaysia</option><option value="SG">Singapore</option><option value="ID">Indonesia</option><option value="TH">Thailand</option><option value="VN">Vietnam</option><option value="PH">Philippines</option><option value="BN">Brunei</option><option value="KH">Cambodia</option><option value="LA">Laos</option><option value="MM">Myanmar</option><option value="TL">Timor-Leste</option></select></label><button class="save primary" id="save" data-i18n="save">Save preferences</button></section></div>
<div id="smodal" class="overlay" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="search-title"><button class="close" id="sclose" aria-label="Close search">×</button><h2 id="search-title" data-i18n="searchT">Find a city</h2><label class="sr-only" for="sinput">City name</label><input id="sinput" class="sinput" type="search" autocomplete="off" enterkeyhint="search" placeholder="City name…"><div id="sresults" aria-live="polite"></div></section></div>
<div id="toast" class="toast" role="status" hidden></div>
</main>
<script src="/vendor/leaflet.js"></script><script>
const I18N={
en:{settingsBtn:'Settings',now:'Air Quality',nearby:'Nearby',news:'News',sample:'SAMPLE DATA',live:'LIVE READING',monitor:'NEAREST MONITOR',usaqi:'US AQI',fromyou:'km from you',reading:'current reading',humidity:'Humidity',wind:'Wind',lvl0:'Good',lvl1:'Moderate',lvl2:'Sensitive',lvl3:'Unhealthy',lvl4:'Very unhealthy',lvl5:'Hazardous',adv0T:'Good time to be outside',adv0B:'Enjoy your usual activities.',adv1T:'Generally acceptable',adv1B:'Unusually sensitive people may reduce prolonged exertion.',adv1Bs:'Watch for symptoms during long outdoor activity.',adv2T:'Reduce prolonged activity',adv2B:'Sensitive groups should limit prolonged outdoor exertion.',adv2Bs:'Keep activity light and consider a well-fitted mask.',adv3T:'Limit time outdoors',adv3B:'Everyone should reduce intense outdoor activity.',adv4T:'Stay indoors if possible',adv4B:'Close windows, use filtration, and avoid outdoor exertion.',alertT:'Alert me to meaningful changes',alertS:'Alerts on meaningful AQI changes — even when Airly is closed.',nearbyT:'Monitoring stations near you',nearbyS:'Tap a station to make it your dashboard.',newsT:'What’s shaping the air',newsS:'Recent haze and air-quality coverage for your locale.',nonews:'No recent coverage found.',settingsT:'Alerts that matter',settingsP:'Preferences stay on this device. Alerts can arrive even when Airly is closed.',deltaL:'Notify when AQI changes by',notifT:'Browser notifications',notifS:'Alert me to meaningful AQI changes',sensT:'Sensitive health profile',sensS:'Stricter personal guidance',localeL:'Local news',save:'Save preferences',saved:'Preferences saved on this device.',locA:'Using approximate IP location',locB:'Location unavailable — using Kuala Lumpur.',errA:'Live token is not configured — showing sample readings.',errB:'Live data temporarily unavailable — retrying soon.',noNotif:'Notifications are not supported in this browser.',aiStamp:'The above advisory is generated by AI — check critical information',updated:'Station updated',myapi:'API (MY) approx.',trend:'Trend & Forecast',trendT:'PM2.5 outlook',trendS:'Daily forecast range and average',trendNone:'No forecast available for this station yet.',trendSrc:'Forecast by the World Air Quality Index Project.',reset:'Reset',hsHint:'On iPhone/iPad: Share → Add to Home Screen, then open Airly from that icon to enable alerts.',searchT:'Find a city',searchPh:'City or station name…',noResults:'No stations found.',locBlocked:'Location is blocked. Allow it in the browser\'s site settings — and on iPhone also Settings → your browser app → Location.',yourloc:'My Location (zoom in)',approx:'Approx. '},
ms:{settingsBtn:'Tetapan',now:'Kualiti Udara',nearby:'Berdekatan',news:'Berita',sample:'DATA CONTOH',live:'BACAAN LANGSUNG',monitor:'STESEN TERDEKAT',usaqi:'AQI AS',fromyou:'km dari anda',reading:'bacaan semasa',humidity:'Kelembapan',wind:'Angin',lvl0:'Baik',lvl1:'Sederhana',lvl2:'Sensitif',lvl3:'Tidak sihat',lvl4:'Sangat tidak sihat',lvl5:'Berbahaya',adv0T:'Sesuai untuk aktiviti luar',adv0B:'Nikmati aktiviti seperti biasa.',adv1T:'Umumnya boleh diterima',adv1B:'Individu yang sangat sensitif boleh kurangkan aktiviti berpanjangan.',adv1Bs:'Perhatikan simptom semasa aktiviti luar yang lama.',adv2T:'Kurangkan aktiviti berpanjangan',adv2B:'Kumpulan sensitif harus hadkan aktiviti luar yang lama.',adv2Bs:'Kekalkan aktiviti ringan dan pertimbangkan pelitup muka.',adv3T:'Hadkan masa di luar',adv3B:'Semua orang harus kurangkan aktiviti luar yang berat.',adv4T:'Kekal di dalam jika boleh',adv4B:'Tutup tingkap, guna penapis udara dan elakkan aktiviti luar.',alertT:'Maklumkan perubahan penting',alertS:'Amaran perubahan AQI ketara — walaupun Airly ditutup.',nearbyT:'Stesen pemantauan berdekatan',nearbyS:'Ketik stesen untuk jadikan papan pemuka anda.',newsT:'Apa yang mempengaruhi udara',newsS:'Liputan jerebu dan kualiti udara terkini untuk lokasi anda.',nonews:'Tiada liputan terkini.',settingsT:'Amaran yang penting',settingsP:'Tetapan disimpan pada peranti ini. Notifikasi boleh tiba walaupun Airly ditutup.',deltaL:'Maklumkan apabila AQI berubah sebanyak',notifT:'Notifikasi pelayar',notifS:'Maklumkan perubahan AQI yang ketara',sensT:'Profil kesihatan sensitif',sensS:'Panduan peribadi lebih ketat',localeL:'Berita tempatan',save:'Simpan tetapan',saved:'Tetapan disimpan pada peranti ini.',locA:'Menggunakan lokasi IP anggaran',locB:'Lokasi tidak tersedia — menggunakan Kuala Lumpur.',errA:'Token langsung belum dikonfigurasi — memaparkan data contoh.',errB:'Data langsung tidak tersedia buat masa ini.',noNotif:'Notifikasi tidak disokong dalam pelayar ini.',aiStamp:'Nasihat di atas dijana oleh AI — semak maklumat penting',updated:'Stesen dikemas kini',myapi:'API (MY) anggaran',trend:'Tren & Ramalan',trendT:'Unjuran PM2.5',trendS:'Julat dan purata ramalan harian',trendNone:'Tiada ramalan untuk stesen ini lagi.',trendSrc:'Ramalan oleh World Air Quality Index Project.',reset:'Set Semula',hsHint:'Di iPhone/iPad: Kongsi → Tambah ke Skrin Utama, kemudian buka Airly dari ikon itu untuk amaran.',searchT:'Cari bandar',searchPh:'Nama bandar atau stesen…',noResults:'Tiada stesen dijumpai.',locBlocked:'Lokasi disekat. Benarkan dalam tetapan laman pelayar — di iPhone, juga Tetapan → aplikasi pelayar → Lokasi.',yourloc:'Lokasi Saya (zum)',approx:'Anggaran '},
ta:{settingsBtn:'அமைப்பு',now:'காற்றுத் தரம்',nearby:'அருகில்',news:'செய்திகள்',sample:'மாதிரி தரவு',live:'நேரடி அளவீடு',monitor:'அருகிலுள்ள நிலையம்',usaqi:'US AQI',fromyou:'கி.மீ தொலைவில்',reading:'தற்போதைய அளவீடு',humidity:'ஈரப்பதம்',wind:'காற்று',lvl0:'நல்லது',lvl1:'மிதமானது',lvl2:'உணர்திறனுக்கு தீங்கு',lvl3:'ஆரோக்கியமற்றது',lvl4:'மிகவும் ஆரோக்கியமற்றது',lvl5:'அபாயகரமானது',adv0T:'வெளியே செல்ல நல்ல நேரம்',adv0B:'வழக்கமான செயல்பாடுகளைத் தொடரலாம்.',adv1T:'பொதுவாக ஏற்கத்தக்கது',adv1B:'மிக உணர்திறன் உள்ளவர்கள் நீண்ட உழைப்பைக் குறைக்கலாம்.',adv1Bs:'நீண்ட வெளிப்புற செயல்பாட்டின்போது அறிகுறிகளைக் கவனியுங்கள்.',adv2T:'நீண்ட செயல்பாட்டைக் குறைக்கவும்',adv2B:'உணர்திறன் குழுக்கள் நீண்ட வெளிப்புற உழைப்பைக் கட்டுப்படுத்த வேண்டும்.',adv2Bs:'இலகுவான செயல்பாடு; பொருத்தமான முகக்கவசம் பரிசீலிக்கவும்.',adv3T:'வெளியே இருக்கும் நேரத்தைக் குறைக்கவும்',adv3B:'அனைவரும் கடும் வெளிப்புற செயல்பாட்டைக் குறைக்க வேண்டும்.',adv4T:'முடிந்தால் உள்ளேயே இருங்கள்',adv4B:'ஜன்னல்களை மூடி, காற்று வடிகட்டியைப் பயன்படுத்தவும்.',alertT:'முக்கிய மாற்றங்களை அறிவிக்கவும்',alertS:'முக்கிய AQI மாற்றங்களுக்கு எச்சரிக்கை — Airly மூடியிருந்தாலும்.',nearbyT:'அருகிலுள்ள கண்காணிப்பு நிலையங்கள்',nearbyS:'நிலையத்தைத் தட்டி உங்கள் டாஷ்போர்டாக்குங்கள்.',newsT:'காற்றை பாதிக்கும் நிகழ்வுகள்',newsS:'உங்கள் பகுதிக்கான சமீபத்திய காற்றுத்தர செய்திகள்.',nonews:'சமீபத்திய செய்திகள் இல்லை.',settingsT:'முக்கியமான எச்சரிக்கைகள்',settingsP:'விருப்பங்கள் இந்தச் சாதனத்திலேயே சேமிக்கப்படும். Airly மூடியிருந்தாலும் அறிவிப்புகள் வரலாம்.',deltaL:'AQI இவ்வளவு மாறினால் அறிவிக்கவும்',notifT:'உலாவி அறிவிப்புகள்',notifS:'குறிப்பிடத்தக்க AQI மாற்றங்களை அறிவிக்கவும்',sensT:'உணர்திறன் சுகாதார விவரம்',sensS:'கடுமையான தனிப்பட்ட வழிகாட்டுதல்',localeL:'உள்ளூர் செய்திகள்',save:'சேமிக்கவும்',saved:'விருப்பங்கள் சேமிக்கப்பட்டன.',locA:'தோராயமான IP இருப்பிடம் பயன்படுத்தப்படுகிறது',locB:'இருப்பிடம் கிடைக்கவில்லை — கோலாலம்பூர் பயன்படுத்தப்படுகிறது.',errA:'நேரடி டோக்கன் அமைக்கப்படவில்லை — மாதிரி தரவு காட்டப்படுகிறது.',errB:'நேரடி தரவு தற்காலிகமாக கிடைக்கவில்லை.',noNotif:'இந்த உலாவியில் அறிவிப்புகள் ஆதரிக்கப்படவில்லை.',aiStamp:'மேலே உள்ள அறிவுரை AI ஆல் உருவாக்கப்பட்டது — முக்கியத் தகவலைச் சரிபார்க்கவும்',updated:'நிலையம் புதுப்பிக்கப்பட்டது',myapi:'API (MY) தோராயம்',trend:'போக்கு & கணிப்பு',trendT:'PM2.5 கணிப்பு',trendS:'தினசரி முன்னறிவிப்பு வரம்பும் சராசரியும்',trendNone:'இந்த நிலையத்திற்கு கணிப்பு இல்லை.',trendSrc:'கணிப்பு: World Air Quality Index Project.',reset:'மீட்டமை',hsHint:'iPhone/iPad-இல்: Share → Add to Home Screen செய்து, அந்த ஐகானில் இருந்து Airly-ஐத் திறக்கவும்.',searchT:'நகரத்தைத் தேடு',searchPh:'நகரம் அல்லது நிலையம்…',noResults:'நிலையங்கள் இல்லை.',locBlocked:'இருப்பிடம் தடுக்கப்பட்டுள்ளது. உலாவியின் தள அமைப்புகளில் அனுமதிக்கவும் — iPhone-இல் Settings → உலாவி ஆப் → Location-ஐயும் சரிபார்க்கவும்.',yourloc:'என் இருப்பிடம் (பெரிதாக்க)',approx:'தோராய '},
zh:{settingsBtn:'设置',now:'空气质量',nearby:'附近',news:'新闻',sample:'示例数据',live:'实时读数',monitor:'最近监测站',usaqi:'美国 AQI',fromyou:'公里外',reading:'当前读数',humidity:'湿度',wind:'风速',lvl0:'良好',lvl1:'中等',lvl2:'敏感人群不健康',lvl3:'不健康',lvl4:'非常不健康',lvl5:'危险',adv0T:'适合户外活动',adv0B:'可照常进行日常活动。',adv1T:'总体可接受',adv1B:'特别敏感者可减少长时间剧烈活动。',adv1Bs:'长时间户外活动时注意身体反应。',adv2T:'减少长时间活动',adv2B:'敏感人群应限制长时间户外活动。',adv2Bs:'保持轻度活动，建议佩戴口罩。',adv3T:'减少外出时间',adv3B:'所有人应减少剧烈户外活动。',adv4T:'尽量留在室内',adv4B:'关闭门窗，使用空气净化器，避免户外活动。',alertT:'重要变化提醒',alertS:'重要 AQI 变化提醒 — 即使 Airly 已关闭。',nearbyT:'附近的监测站',nearbyS:'点按站点设为您的仪表板。',newsT:'影响空气的动态',newsS:'您所在地区最新的雾霾与空气质量报道。',nonews:'暂无最新报道。',settingsT:'重要提醒',settingsP:'偏好仅保存在本设备上。即使 Airly 已关闭也能收到通知。',deltaL:'AQI 变化达到以下值时提醒',notifT:'浏览器通知',notifS:'提醒我显著的 AQI 变化',sensT:'敏感健康档案',sensS:'更严格的个人建议',localeL:'本地新闻',save:'保存设置',saved:'偏好已保存在本设备上。',locA:'正在使用大致的 IP 位置',locB:'无法获取位置 — 使用吉隆坡。',errA:'未配置实时令牌 — 显示示例数据。',errB:'实时数据暂不可用。',noNotif:'此浏览器不支持通知。',aiStamp:'以上建议由 AI 生成 — 请核实重要信息',updated:'监测站更新于',myapi:'API（马来西亚）约',trend:'趋势与预报',trendT:'PM2.5 展望',trendS:'每日预报范围与平均值',trendNone:'该站点暂无预报。',trendSrc:'预报来自 World Air Quality Index Project。',reset:'重置',hsHint:'在 iPhone/iPad 上：分享 → 添加到主屏幕，再从该图标打开 Airly 即可启用通知。',searchT:'搜索城市',searchPh:'城市或监测站名称…',noResults:'未找到监测站。',locBlocked:'位置权限被阻止。请在浏览器的网站设置中允许 — iPhone 上还需检查 设置 → 浏览器应用 → 位置。',yourloc:'我的位置（放大）',approx:'大约 '}};


const $ = q=>document.querySelector(q), $$ = q=>[...document.querySelectorAll(q)];
const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u=>/^https?:\/\//i.test(u||'') ? esc(u) : '#';
const ICONS={
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--paper)"/><circle cx="16" cy="17" r="3" fill="var(--paper)"/>',
 location:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
 air:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3"/>',
 map:'<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2ZM9 3v15M15 6v15"/>',
 news:'<path d="M4 3h16v18H4zM8 7h8M8 11h8M8 15h3M14 15h2M8 18h8"/>',
 chart:'<path d="M4 3v17h17M7 15l4-5 4 2 6-7"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>'
};
const icon=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[n]+'</svg>';
$$('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));
const storage={
 get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}},
 set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
};
const saved=storage.get('airly-settings')||{};
let settings={delta:Math.min(100,Math.max(10,Number(saved.delta)||25)),browser:!!saved.browser,sensitive:!!saved.sensitive,locale:/^(AUTO|MY|SG|ID|TH|VN|PH|BN|KH|LA|MM|TL)$/.test(saved.locale)?saved.locale:'AUTO',lang:['en','ms','ta','zh'].includes(saved.lang)?saved.lang:'en',background:!!saved.background};
settings.index=['auto','my','us'].includes(saved.index)?saved.index:'auto';
settings.backgroundStation=typeof saved.backgroundStation==='string'?saved.backgroundStation:null;
let lang=settings.lang;
const t=k=>I18N[lang]?.[k]||I18N.en[k]||k;
const EXTRA={
 en:{now:'Air',mapTab:'Map',forecastTab:'Forecast',searchPh:'City name…',lvl2:'Unhealthy for sensitive groups',loading:'Checking the air',loadingB:'Fetching the latest available station reading.',noData:'Reading unavailable',retry:'Try again',matched:'Station near your location',selected:'Selected station',fresh:'Latest reported reading',stale:'Older station reading',unknownTime:'Measurement time unavailable',failed:'Refresh failed · last reading shown',offline:'Offline · last reading shown',fetching:'Updating',ago:'ago',privacyNote:'Preferences stay on this device.',settingsNote:'Your preferences are stored on this device.',foregroundNote:'Checks for changes while this app is open and connected.',backgroundTitle:'Background alerts',backgroundNote:'Opt in to store this station and your push subscription on the server for scheduled checks. Turn off to delete the subscription.',details:'Reading details',indexNote:'PM2.5 and PM10 values are pollutant AQI sub-indices, not concentrations in µg/m³. US AQI is not Malaysia’s official API.',spatialNote:'A station measures air at its own location. Nearby conditions can differ.',olderNote:'This reading is over 3 hours old. It may not describe current conditions.',noTimeNote:'The provider has not supplied a verified measurement time.',range:'Range',average:'Average',forecastNote:'PM2.5 AQI forecast, not a measured concentration. Dates follow the station’s local time.',noForecast:'No current forecast is available. Older forecasts are not shown as upcoming conditions.',locationPrecision:'Location accuracy',approxLabel:'Approximate IP area',locationAction:'Use my location',newsFailed:'News could not be loaded. Try again.',nearbyEmpty:'No stations loaded in this area. Open the map or search for a city.',checked:'Checked',alertActive:'Alerts are on',alertInactive:'Set a change alert',alertDescription:'Choose your AQI threshold in settings.',unavailableAdvice:'Check the reading time and your local environment agency for current guidance.',stationLoading:'Loading station details',sampleRemoved:'No sample readings are displayed.',mapHint:'US AQI · tap a station',mapUnavailable:'Map could not load. Station readings are still available.',allClear:'No valid AQI reported',advisorySource:'Guidance follows US AQI health categories.',geoFail:'Precise location unavailable. Using an approximate area.',permissionDenied:'Notifications are blocked. Allow them in browser settings.',notSaved:'Settings work for this session; browser storage is unavailable.',oldForecast:'Forecast unavailable',reportFrom:'Reported by',defaultArea:'Kuala Lumpur · default area',noAlertsStale:'Alerts only use dated readings from the same station, no more than 3 hours old.',bgFailed:'Background alerts could not be saved; foreground alerts remain available.',navForecast:'Forecast',dataError:'Unable to retrieve a valid station reading.'},
 ms:{now:'Udara',mapTab:'Peta',forecastTab:'Ramalan',searchPh:'Nama bandar…',loading:'Menyemak udara',noData:'Bacaan tidak tersedia',retry:'Cuba lagi',matched:'Stesen berhampiran anda',selected:'Stesen dipilih',fresh:'Bacaan terkini dilaporkan',stale:'Bacaan stesen lama',unknownTime:'Masa bacaan tidak tersedia',fetching:'Mengemas kini',privacyNote:'Tetapan disimpan pada peranti ini.',settingsNote:'Tetapan disimpan pada peranti ini.',foregroundNote:'Semakan dibuat semasa aplikasi dibuka dan bersambung.',details:'Butiran bacaan',average:'Purata',range:'Julat',locationAction:'Guna lokasi saya',mapHint:'AQI AS · ketik stesen',defaultArea:'Kuala Lumpur · kawasan lalai',alertInactive:'Tetapkan amaran',alertActive:'Amaran diaktifkan'},
 ta:{now:'காற்று',mapTab:'வரைபடம்',forecastTab:'முன்னறிவிப்பு',searchPh:'நகரத்தின் பெயர்…',loading:'காற்றைச் சரிபார்க்கிறது',noData:'அளவீடு கிடைக்கவில்லை',retry:'மீண்டும் முயல்க',matched:'உங்கள் அருகிலுள்ள நிலையம்',selected:'தேர்ந்தெடுத்த நிலையம்',fresh:'சமீபத்திய அளவீடு',stale:'பழைய அளவீடு',privacyNote:'விருப்பங்கள் இந்தச் சாதனத்தில் சேமிக்கப்படும்.',foregroundNote:'செயலி திறந்திருக்கும் போது மாற்றங்களைச் சரிபார்க்கும்.',details:'அளவீட்டு விவரங்கள்',average:'சராசரி',range:'வரம்பு',locationAction:'எனது இருப்பிடம்',alertInactive:'எச்சரிக்கை அமைக்கவும்'},
 zh:{now:'空气',mapTab:'地图',forecastTab:'预报',searchPh:'城市名称…',loading:'正在查询空气质量',noData:'暂无读数',retry:'重试',matched:'附近监测站',selected:'所选监测站',fresh:'最新报告读数',stale:'较旧读数',unknownTime:'测量时间未知',fetching:'正在更新',privacyNote:'偏好设置保存在此设备。',settingsNote:'偏好设置保存在此设备。',foregroundNote:'应用打开且联网时检查变化。',details:'读数详情',average:'平均值',range:'范围',locationAction:'使用我的位置',mapHint:'美国 AQI · 点击监测站',defaultArea:'吉隆坡 · 默认区域',alertInactive:'设置变化提醒',alertActive:'提醒已开启'}
};
for(const [l,values] of Object.entries(EXTRA))Object.assign(I18N[l],values);
Object.assign(I18N.en,{myapi:'Malaysia API · DOE',indexL:'Air quality index',indexAuto:'Automatic · Malaysia API in Malaysia',indexMY:'Malaysia API · official DOE stations',indexUS:'US AQI · worldwide stations',myNote:'Official API reported by Malaysia’s Department of Environment, not a conversion from US AQI. API and US AQI use different methods and must not be compared directly.',myForecast:'This DOE feed does not provide an API forecast. We do not substitute a US AQI forecast.',myMetrics:'Dominant pollutant',mySource:'Official source',myMap:'Malaysia API · DOE stations',myGuide:'Follow the Malaysian API health guidance.',myMissing:'No DOE stations in this view. Search another city or choose US AQI for worldwide coverage.',alertDescription:'Choose an index-point change in settings.',deltaL:'Notify when the index changes by',notifS:'Alert me to meaningful changes at this station'});
Object.assign(I18N.ms,{myapi:'API Malaysia · JAS',indexL:'Indeks kualiti udara',indexAuto:'Automatik · API untuk Malaysia',indexMY:'API Malaysia · stesen rasmi JAS',indexUS:'AQI AS · stesen seluruh dunia',myNote:'API rasmi Jabatan Alam Sekitar Malaysia, bukan penukaran AQI AS. Kaedah pengiraan berbeza dan nilainya tidak boleh dibandingkan secara langsung.',myForecast:'Suapan JAS ini tidak menyediakan ramalan API. Ramalan AQI AS tidak digunakan sebagai ganti.',myMetrics:'Pencemar dominan',mySource:'Sumber rasmi',myMap:'API Malaysia · stesen JAS',myGuide:'Ikuti panduan kesihatan API Malaysia.',deltaL:'Maklumkan apabila indeks berubah sebanyak',alertDescription:'Pilih perubahan mata indeks dalam tetapan.'});
Object.assign(I18N.ta,{myapi:'மலேசிய API · DOE',indexL:'காற்றுத் தரக் குறியீடு',indexAuto:'தானாக · மலேசியாவில் API',indexMY:'மலேசிய API · DOE',indexUS:'US AQI · உலகளவில்'});
Object.assign(I18N.zh,{myapi:'马来西亚 API · 环境局',indexL:'空气质量指数',indexAuto:'自动 · 马来西亚使用 API',indexMY:'马来西亚 API · 官方监测站',indexUS:'美国 AQI · 全球监测站',myNote:'马来西亚环境局发布的官方 API，并非由美国 AQI 换算。两者计算方式不同，不能直接比较。',myForecast:'此环境局数据源不提供 API 预报，不会用美国 AQI 预报替代。',myMetrics:'主要污染物',mySource:'官方来源',myMap:'马来西亚 API · 环境局监测站',myGuide:'请遵循马来西亚 API 健康指引。',deltaL:'指数变化达到以下点数时提醒',alertDescription:'在设置中选择指数变化点数。'});
const COLORS=['#287750','#94710b','#b86221','#b64436','#81406c','#721f40'];
const MY_COLORS=['#2369b5','#357b28',null,'#8c7100','#b75e16','#b83131'];
const band=(a,index='us')=>!Number.isFinite(a)?-1:a<=50?0:a<=100?1:index!=='my'&&a<=150?2:a<=200?3:a<=300?4:5;
const color=(a,index='us')=>(index==='my'?MY_COLORS:COLORS)[band(a,index)]||'#62746a';
const indexLabel=d=>t(d?.index==='my'?'myapi':'usaqi');
const stationKey=d=>(d.index||'us')+':'+d.uid;
const quality=d=>{
 const time=Date.parse(d?.time||'');
 if(!Number.isFinite(time)||time>Date.now()+600000)return 'unknown';
 return Date.now()-time>10800000?'stale':'fresh';
};
const haversine=(a,b)=>{
 if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;
 const rad=Math.PI/180,dy=(b.lat-a.lat)*rad,dx=(b.lon-a.lon)*rad;
 const h=Math.sin(dy/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dx/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
};
const distanceText=d=>d===null?'':d<1?Math.round(d*1000)+' m':(d<10?d.toFixed(1):Math.round(d))+' km';
const ageText=stamp=>{const diff=Date.now()-Date.parse(stamp||'');if(!Number.isFinite(diff)||diff< -600000)return t('unknownTime');const min=Math.max(0,Math.floor(diff/60000));return new Intl.RelativeTimeFormat(lang,{numeric:'auto'}).format(min<60?-min:min<1440?-Math.floor(min/60):-Math.floor(min/1440),min<60?'minute':min<1440?'hour':'day')};
const dateText=stamp=>{const n=Date.parse(stamp||'');return Number.isFinite(n)?new Date(n).toLocaleString(lang,{dateStyle:'medium',timeStyle:'short'}):t('unknownTime')};
const latestForecast=d=>{const offset=/^([+-])(\d\d):(\d\d)$/.exec(d?.timezone||'');const minutes=offset?(+offset[2]*60 + +offset[3])*(offset[1]==='-'?-1:1):0;const today=new Date(Date.now()+minutes*60000).toISOString().slice(0,10);return (d?.forecast||[]).filter(x=>x.day>=today&&Number.isFinite(x.avg)).sort((a,b)=>a.day.localeCompare(b.day))};
let current=null,stations=[],userLocation=null,searchLocation=null,map=null,userMarker=null,accuracyCircle=null;
let activeView='now',requestMode='home',selection=null,loading=false,loadError='',lastSuccess=0,lastAttempt=0;
let detailController,detailSequence=0,mapController,mapSequence=0,areaSequence=0,locationSequence=0,searchController,searchSequence=0;
let mapTimer,refreshTimer,lastMapKey='',lastMapTime=0,backgroundReady=false,serviceRegistration=null,geoBusy=false;
const markers=new Map(),baseline=new Map(),scrollPositions={};
const indexQuery=()=>{const country=searchLocation?.country||userLocation?.country,index=settings.index==='auto'&&current?.index?current.index:settings.index;return '&index='+index+(country?'&country='+encodeURIComponent(country):'')};
const mapHint=()=>stations.some(s=>s.index==='my')?t('myMap'):current?.index==='my'?t('myMissing'):t('mapHint');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
async function requestJSON(path,signal,timeout=12000){
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();
 const timer=setTimeout(abort,timeout);
 try{const r=await fetch(path,{signal:controller.signal,cache:'no-store'});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||t('dataError')),{status:r.status});return data}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
function applyI18n(){
 document.documentElement.lang=lang;document.body.classList.toggle('lang-ta',lang==='ta');
 $$('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('#sinput').placeholder=t('searchPh');
 $('#map-hint').textContent=mapHint();$('#lang').value=lang;
}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4500)}
function advice(a,index='us'){
 const i=band(a,index);if(i<0)return [t('noData'),t('unavailableAdvice')];
 if(i===5)return [t('adv4T'),({en:'Everyone should avoid outdoor physical activity. Stay inside with cleaner air and follow local health advisories.',ms:'Semua orang perlu elakkan aktiviti fizikal di luar. Kekal di dalam dengan udara bersih dan ikut nasihat kesihatan tempatan.',ta:'வெளிப்புற உடற்பயிற்சியை அனைவரும் தவிர்க்கவும். சுத்தமான உட்புறக் காற்றில் இருந்து உள்ளூர் சுகாதார ஆலோசனைகளைப் பின்பற்றவும்.',zh:'所有人应避免户外体力活动，留在空气较清洁的室内并遵循当地健康建议。'})[lang]];
 return [t('adv'+Math.min(i,4)+'T'),t('adv'+Math.min(i,4)+((i===1||i===2)&&settings.sensitive?'Bs':'B'))]
}
function connectionText(){
 if(navigator.onLine===false)return 'Offline';
 if(loading)return t('fetching')+'…';
 if(loadError)return t('retry');
 return lastSuccess?t('checked')+' '+new Date(lastSuccess).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'}):t('loading')+'…';
}
function render(){
 $('#connection').textContent=connectionText();$('#refresh').classList.toggle('spin',loading);$('#refresh').disabled=loading;
 $('#place').textContent=searchLocation?.name||userLocation?.label||t('defaultArea');
 $('#place').title=userLocation?.accuracy?t('locationPrecision')+' ±'+Math.round(userLocation.accuracy)+' m':userLocation?.approx?t('approxLabel'):'';
 const now=$('#now'),scroll=$('#card').scrollTop,open=now.querySelector('details')?.open;
 if(!current){
  now.innerHTML='<div class="empty"><p class="eyebrow">Airly by Ordinexis</p><h1>'+esc(loading?t('loading'):t('noData'))+'</h1><p>'+esc(loading?t('loadingB'):loadError||t('dataError'))+'</p>'+(loading?'<div class="skeleton"></div><div class="skeleton score-load"></div><div class="skeleton"></div>':'<button class="primary" id="retry">'+esc(t('retry'))+'</button>')+'</div>';
  $('#retry')?.addEventListener('click',()=>refresh(true));
 }else{
  const q=quality(current),valid=Number.isFinite(current.aqi),[title,body]=advice(current.aqi,current.index),c=color(current.aqi,current.index),my=current.index==='my',bands=my?[0,1,3,4,5]:[0,1,2,3,4,5];
  const status=current.detail===false?t('stationLoading'):loadError?t(navigator.onLine===false?'offline':'failed'):t(q==='fresh'?'fresh':q==='stale'?'stale':'unknownTime');
  const d=haversine(userLocation,current);
  const attribution=(current.attribution||[]).map(a=>'<a href="'+safeUrl(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.name)+'</a>').join(' · ');
  now.innerHTML='<div class="live" data-quality="'+(loadError?'stale':q)+'"><span class="status-dot"></span><span>'+esc(status)+(current.time?' · '+esc(ageText(current.time)):'')+'</span></div>'+
   '<p class="eyebrow">'+esc(t(requestMode==='home'?'matched':'selected'))+'</p><h1 class="station-name">'+esc(current.name)+'</h1>'+
   '<p class="distance">'+(d===null?esc(t('spatialNote')):esc(userLocation.approx?(d<1?'<1 km':'≈ '+Math.round(d)+' km'):distanceText(d))+' '+esc(({en:'from you',ms:'dari anda',ta:'தொலைவில்',zh:'距您'})[lang])+(userLocation.approx?' · '+esc(t('approxLabel')):userLocation.accuracy?' · ±'+Math.round(userLocation.accuracy)+' m':''))+'</p>'+
   '<div class="score"><strong style="color:'+c+'">'+(valid?current.aqi:'—')+'</strong><span><b>'+esc(valid?t('lvl'+band(current.aqi,current.index)):t('noData'))+'</b>'+esc(indexLabel(current))+'</span></div>'+
   '<div class="aqi-scale" style="grid-template-columns:repeat('+bands.length+',1fr)" aria-label="'+esc(indexLabel(current))+' category scale">'+bands.map(i=>'<i class="'+(i===band(current.aqi,current.index)?'active':'')+'" style="background:'+(my?MY_COLORS:COLORS)[i]+'"></i>').join('')+'</div>'+
   (q!=='fresh'?'<p class="notice">'+esc(t(q==='stale'?'olderNote':'noTimeNote'))+'</p>':'')+
   '<div class="advice" style="border-color:'+c+'"><h2>'+esc(q==='fresh'?title:t('details'))+'</h2><p>'+esc(q==='fresh'?body:t('unavailableAdvice'))+'</p></div>'+
   (my?'<div class="metrics" style="grid-template-columns:1fr 1fr"><div class="metric"><span>'+esc(t('myMetrics'))+'</span><b>'+esc(current.dominant||'—')+'</b></div><div class="metric"><span>'+esc(t('mySource'))+'</span><b>DOE</b><small>'+esc(current.stationCode||'APIMS')+'</small></div></div>':'<div class="metrics"><div class="metric"><span>PM2.5</span><b>'+(current.pm25??'—')+'</b><small>AQI sub-index</small></div><div class="metric"><span>'+esc(t('humidity'))+'</span><b>'+(current.humidity??'—')+'</b><small>%</small></div><div class="metric"><span>'+esc(t('wind'))+'</span><b>'+(current.wind??'—')+'</b><small>m/s</small></div></div>')+
   '<details class="reading-details"'+(open?' open':'')+'><summary>'+esc(t('details'))+'</summary><p>'+esc(t('updated'))+': '+esc(dateText(current.time))+'</p><p>'+esc(t(my?'myNote':'indexNote'))+'</p><p>'+esc(t('spatialNote'))+'</p>'+
   '<div class="pollutants">'+Object.entries(current.pollutants||{}).filter(([k,v])=>v!==null).map(([k,v])=>'<span>'+esc(({pm25:'PM2.5',pm10:'PM10',o3:'O₃',no2:'NO₂',so2:'SO₂',co:'CO'})[k]||k)+' <b>'+v+'</b></span>').join('')+'</div>'+
   (current.dominant?'<p>Dominant pollutant: '+esc(current.dominant.toUpperCase().replace('PM25','PM2.5'))+'</p>':'')+
   (current.temperature!==null&&current.temperature!==undefined?'<p>'+current.temperature+' °C</p>':'')+
   '<p>'+esc(t(my?'myGuide':'advisorySource'))+' <a href="'+(my?'https://www.doe.gov.my/2021/10/04/english-air-pollutant-index-api/':'https://www.airnow.gov/aqi/aqi-basics/')+'" target="_blank" rel="noopener noreferrer">'+(my?'DOE Malaysia':'AirNow')+'</a></p>'+
   (attribution?'<p>'+esc(t('reportFrom'))+': '+attribution+'</p>':'')+'</details>'+
   '<button class="alert" id="alert">'+icon('settings')+'<span><b>'+esc(t(settings.browser?'alertActive':'alertInactive'))+'</b><small>'+esc(t('alertDescription'))+'</small></span>'+icon('arrow')+'</button>';
  $('#alert').onclick=()=>openModal('modal');
 }
 $('#map-station').textContent=current?.name||t('noData');$('#map-aqi').textContent=current?.aqi??'—';$('#map-aqi').style.color=color(current?.aqi,current?.index);
 $('#map-reading-label').textContent=indexLabel(current)+(current?.time?' · '+ageText(current.time):'');$('#map-hint').textContent=mapHint();
 $('#data-source').textContent=current?.index==='my'?'DOE Malaysia · APIMS':'World Air Quality Index Project';$('#data-source').href=current?.index==='my'?'https://eqms.doe.gov.my/APIMS/main':'https://waqi.info';
 $('#card').scrollTop=scroll;
 if(activeView==='nearby')renderNearby();if(activeView==='trend')renderTrend();
 updateMarkers();
}
async function loadReading(query,summary=null){
 const seq=++detailSequence;detailController?.abort();detailController=new AbortController();
 loading=true;loadError='';lastAttempt=Date.now();
 if(summary){current={...summary,detail:false,time:null,pm25:null,wind:null,humidity:null};}
 render();
 try{
  const next=await requestJSON('/api/air?'+query,detailController.signal);
  if(seq!==detailSequence)return;
  if(!Number.isFinite(next.aqi)||next.aqi<0||!(Number.isFinite(next.uid)||next.index==='my'&&/^my:[A-Z0-9_-]{1,20}$/.test(next.uid)))throw Error(t('dataError'));
  current={...next,detail:true};selection={uid:next.uid,lat:next.lat,lon:next.lon};lastSuccess=Date.now();loadError='';
  checkAlert(next);
  // The detail endpoint is authoritative; replace, rather than mixing it with the map summary.
  const i=stations.findIndex(s=>s.uid===next.uid);if(i<0)stations.push(next);else stations[i]=next;
 }catch(e){if(seq!==detailSequence)return;loadError=navigator.onLine===false?'Offline':e.message||t('dataError')}
 finally{if(seq===detailSequence){loading=false;render();scheduleRefresh()}}
}
function selectStation(s){
 locationSequence++;
 requestMode='station';selection={uid:s.uid,lat:s.lat,lon:s.lon};
 loadReading('uid='+encodeURIComponent(s.uid),s);
 if(activeView!=='map')showTab('now');
}
async function refresh(force=false){
 if(!force&&(document.hidden||loading||navigator.onLine===false))return;
 if(selection?.uid)await loadReading('uid='+selection.uid);
 else{const p=searchLocation||userLocation||{lat:3.139,lon:101.687};await loadReading('lat='+p.lat+'&lon='+p.lon+indexQuery())}
 if(map&&(activeView==='map'||innerWidth>820))loadViewport(true);
}
function scheduleRefresh(){clearTimeout(refreshTimer);if(!document.hidden&&navigator.onLine!==false)refreshTimer=setTimeout(()=>refresh(),loadError?60000:300000)}
function checkAlert(d){
 if(!settings.browser||(settings.background&&settings.backgroundStation===stationKey(d))||quality(d)!=='fresh')return;
 const key=stationKey(d),previous=baseline.get(key),stamp=Date.parse(d.time);
 if(!previous||Date.now()-previous.time>10800000){baseline.set(key,{aqi:d.aqi,time:stamp});return}
 if(stamp<=previous.time)return;
 if(Math.abs(d.aqi-previous.aqi)>=settings.delta){notifyChange(d,previous.aqi);baseline.set(key,{aqi:d.aqi,time:stamp})}
}
async function notifyChange(d,old){
 if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
 const direction=d.aqi>old?'increased':'decreased',options={body:d.name+': '+indexLabel(d)+' '+direction+' by '+Math.abs(d.aqi-old)+' to '+d.aqi+'.',tag:'airly-'+stationKey(d),icon:'/icon-180.png'};
 try{if(serviceRegistration)await serviceRegistration.showNotification('Airly by Ordinexis',options);else new Notification('Airly by Ordinexis',options)}catch{}
}
function initMap(){
 if(!window.L){$('#map').innerHTML='<p class="map-status">'+esc(t('mapUnavailable'))+'</p>';return}
 $('#map').replaceChildren();
 map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:18,preferCanvas:true,zoomAnimation:!reduceMotion,fadeAnimation:!reduceMotion,worldCopyJump:true}).setView([3.139,101.687],8);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',updateWhenIdle:true,keepBuffer:2}).addTo(map);
 L.control.zoom({position:'bottomleft'}).addTo(map);
 map.on('moveend',()=>{clearTimeout(mapTimer);mapTimer=setTimeout(()=>loadViewport(),350)});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>map.invalidateSize({pan:false})).observe($('#map'));
}
function centreMap(p=userLocation||selection){if(!map||!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return;map.setView([p.lat,p.lon],11,{animate:!reduceMotion});loadViewport()}
function drawUser(){
 if(!map||!userLocation)return;
 if(userMarker)map.removeLayer(userMarker);if(accuracyCircle)map.removeLayer(accuracyCircle);
 const p=userLocation;
 userMarker=L.marker([p.lat,p.lon],{interactive:false,keyboard:false,zIndexOffset:1000,icon:L.divIcon({className:'',html:'<div class="user-dot"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
 if(p.accuracy>0)accuracyCircle=L.circle([p.lat,p.lon],{radius:p.accuracy,color:'#257bc2',weight:1,fillOpacity:.07,interactive:false}).addTo(map);
}
function updateMarkers(){
 if(!map)return;
 const center=map.getCenter(),origin={lat:center.lat,lon:center.lng},bounds=map.getBounds().pad(.15);
 const list=stations.filter(s=>Number.isFinite(s.aqi)&&Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&bounds.contains([s.lat,s.lon])).sort((a,b)=>haversine(origin,a)-haversine(origin,b)).slice(0,120);
 if(current&&Number.isFinite(current.lat)&&Number.isFinite(current.lon)&&!list.some(s=>s.uid===current.uid))list.push(current);
 const seen=new Set();
 for(const s of list){
  const key=s.uid;seen.add(key);const active=key===current?.uid,signature=s.aqi+'|'+active+'|'+s.lat+'|'+s.lon+'|'+lang;
  let entry=markers.get(key);
  if(!entry){
   const marker=L.marker([s.lat,s.lon],{title:s.name+' · '+indexLabel(s)+' '+s.aqi}).addTo(map);
   entry={marker,station:s,signature:''};markers.set(key,entry);marker.on('click',()=>selectStation(entry.station));
  }
  entry.station=s;
  if(signature!==entry.signature){
   entry.marker.setLatLng([s.lat,s.lon]).setIcon(L.divIcon({className:'',html:'<div class="map-bubble'+(active?' active':'')+'" style="--aqi:'+color(s.aqi,s.index)+'">'+s.aqi+'</div>',iconSize:[38,34],iconAnchor:[19,43]})).setZIndexOffset(active?500:0);
   entry.marker.unbindTooltip().bindTooltip(esc(s.name)+' · '+esc(indexLabel(s))+' '+s.aqi,{direction:'top'});entry.signature=signature;
  }
 }
 for(const [key,e]of markers)if(!seen.has(key)){map.removeLayer(e.marker);markers.delete(key)}
}
async function loadViewport(force=false){
 if(!map||document.hidden||(innerWidth<=820&&activeView!=='map'))return;
 const b=map.getBounds(),c=map.getCenter(),lat=Math.max(-65,Math.min(65,c.lat)),lon=((c.lng+180)%360+360)%360-180;
 const dy=Math.min(19,(b.getNorth()-b.getSouth())/2),dx=Math.min(29,(b.getEast()-b.getWest())/2);
 const box=[Math.max(-85,lat-dy),Math.max(-180,lon-dx),Math.min(85,lat+dy),Math.min(180,lon+dx)].map(x=>+x.toFixed(4));
 if(box[0]>=box[2]||box[1]>=box[3])return;
 const key=box.join(','),cacheKey=key+indexQuery();if(!force&&cacheKey===lastMapKey&&Date.now()-lastMapTime<300000){updateMarkers();return}
 const seq=++mapSequence;mapController?.abort();mapController=new AbortController();
 try{
  const inc=await requestJSON('/api/air?scope=area&bbox='+key+indexQuery(),mapController.signal);
  if(seq!==mapSequence||!Array.isArray(inc))return;
  lastMapKey=cacheKey;lastMapTime=Date.now();
  const merged=new Map(stations.map(s=>[s.uid,s]));inc.forEach(s=>merged.set(s.uid,s));
  if(current?.detail)merged.set(current.uid,current);
  stations=[...merged.values()].sort((a,b)=>(haversine(userLocation||originPoint(),a)??Infinity)-(haversine(userLocation||originPoint(),b)??Infinity)).slice(0,600);
  $('#map-hint').textContent=mapHint();updateMarkers();if(activeView==='nearby')renderNearby();
 }catch(e){if(seq===mapSequence)$('#map-hint').textContent='Station map could not refresh'}
}
function originPoint(){return searchLocation||userLocation||selection||{lat:3.139,lon:101.687}}
async function loadArea(p,seq){
 const areaSeq=++areaSequence;
 try{const inc=await requestJSON('/api/air?scope=area&lat='+p.lat+'&lon='+p.lon+indexQuery());
 if(seq!==locationSequence||areaSeq!==areaSequence||!Array.isArray(inc))return;stations=inc;if(current?.detail&&!stations.some(s=>s.uid===current.uid))stations.push(current);
 updateMarkers();if(activeView==='nearby')renderNearby()}catch{}
}
async function useArea(p,mode='home'){
 const seq=++locationSequence;selection=null;requestMode=mode;loadError='';current=null;stations=[];lastMapKey='';mapSequence++;mapController?.abort();
 if(mode==='home'){userLocation=p;searchLocation=null;drawUser()}else searchLocation=p;
 render();if(map){map.setView([p.lat,p.lon],10,{animate:false});}
 loadArea(p,seq);await loadReading('lat='+p.lat+'&lon='+p.lon+indexQuery());
 if(seq===locationSequence&&current?.index==='us'&&settings.index==='auto'&&(p.country||userLocation?.country)==='MY')loadArea(p,seq);
}
async function ipLocate(){
 try{const p=await requestJSON('/api/location');await useArea({...p,approx:true,label:(p.city||p.region||p.country)+' · '+t('approxLabel')})}
 catch{await useArea({lat:3.139,lon:101.687,approx:true,label:t('defaultArea')})}
}
async function locate(){
 if(geoBusy)return;if(!navigator.geolocation){toast(t('geoFail'));return}
 geoBusy=true;$('#location').disabled=true;const generation=locationSequence;
 navigator.geolocation.getCurrentPosition(async p=>{
  geoBusy=false;$('#location').disabled=false;if(generation!==locationSequence)return;
  await useArea({lat:p.coords.latitude,lon:p.coords.longitude,country:userLocation?.country,accuracy:p.coords.accuracy,approx:false,label:t('locationAction')});
  centreMap(userLocation);
 },()=>{geoBusy=false;$('#location').disabled=false;toast(t('geoFail'));if(!userLocation)ipLocate()}, {enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}
function renderNearby(){
 const origin=originPoint(),list=stations.filter(s=>Number.isFinite(s.aqi)&&haversine(origin,s)!==null).sort((a,b)=>haversine(origin,a)-haversine(origin,b)).slice(0,30);
 $('#nearby').innerHTML='<div class="panel"><h2>'+esc(t('nearbyT'))+'</h2><p>'+esc(t('nearbyS'))+'</p>'+(!list.length?'<p>'+esc(t('nearbyEmpty'))+'</p>':list.map((s,i)=>'<button class="row" data-station="'+i+'"><span class="badge" style="background:'+color(s.aqi,s.index)+'">'+s.aqi+'</span><span class="row-text"><b>'+esc(s.name)+'</b><small>'+(origin.approx?(haversine(origin,s)<1?'<1 km':'≈ '+Math.round(haversine(origin,s))+' km'):distanceText(haversine(origin,s)))+' · '+esc(indexLabel(s))+' · '+esc(t('lvl'+band(s.aqi,s.index)))+'</small></span>'+icon('arrow')+'</button>').join(''))+'</div>';
 $$('#nearby [data-station]').forEach(b=>b.onclick=()=>selectStation(list[+b.dataset.station]));
}
let newsCache=null,newsTime=0,newsLocale='',newsController,newsSeq=0;
function newsQuery(){const p=new URLSearchParams({locale:settings.locale==='AUTO'?(searchLocation?.country||'AUTO'):settings.locale});if(settings.locale==='AUTO'&&searchLocation?.name)p.set('city',searchLocation.name);return p.toString()}
async function loadNews(force=false){
 const query=newsQuery();if(!force&&newsCache&&newsLocale===query&&Date.now()-newsTime<900000){renderNews(newsCache);return}
 const seq=++newsSeq;newsController?.abort();newsController=new AbortController();
 if(!newsCache||newsLocale!==query)$('#news').innerHTML='<div class="panel"><h2>'+esc(t('newsT'))+'</h2><div class="skeleton"></div><div class="skeleton"></div></div>';
 try{const items=await requestJSON('/api/news?'+query+(force?'&fresh=1':''),newsController.signal);if(seq!==newsSeq)return;if(!Array.isArray(items))throw Error();newsCache=items;newsTime=Date.now();newsLocale=query;renderNews(items)}
 catch{if(seq===newsSeq)renderNews(newsLocale===query?(newsCache||[]):[],true)}
}
function renderNews(items,failed=false){
 $('#news').innerHTML='<div class="panel"><div class="panelhead"><h2>'+esc(t('newsT'))+'</h2><button class="icon-button" id="news-refresh" aria-label="Refresh news">'+icon('refresh')+'</button></div><p>'+esc(t('newsS'))+'</p>'+(failed?'<p class="notice">'+esc(t('newsFailed'))+'</p>':'')+(items.length?items.map(x=>'<a class="story" href="'+safeUrl(x.link)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(x.source)+'</span><b>'+esc(x.title)+'</b><small>'+esc(Number.isFinite(Date.parse(x.published))?dateText(x.published):'')+'</small></a>').join(''):'<p>'+esc(t('nonews'))+'</p>')+'</div>';$('#news-refresh').onclick=()=>loadNews(true);
}
function renderTrend(){
 if(current?.index==='my'){$('#trend').innerHTML='<div class="panel"><h2>'+esc(t('forecastTab'))+'</h2><p>'+esc(t('myForecast'))+'</p></div>';return}
 const f=latestForecast(current);
 if(!f.length){$('#trend').innerHTML='<div class="panel"><h2>'+esc(t('trendT'))+'</h2><p>'+esc(t('noForecast'))+'</p></div>';return}
 const max=Math.max(50,...f.map(x=>x.max??x.avg)),w=340,h=155,step=300/f.length,y=v=>125-v/max*100;
 const bars=f.map((x,i)=>{const cx=20+step*(i+.5),min=x.min??x.avg,max=x.max??x.avg;return '<line x1="'+cx+'" x2="'+cx+'" y1="'+y(max)+'" y2="'+y(min)+'" stroke="'+color(x.avg)+'" stroke-width="8" opacity=".3" stroke-linecap="round"/><circle cx="'+cx+'" cy="'+y(x.avg)+'" r="4" fill="'+color(x.avg)+'"/><text x="'+cx+'" y="'+(y(max)-10)+'" text-anchor="middle" font-size="12" fill="'+color(x.avg)+'">'+x.avg+'</text><text x="'+cx+'" y="149" text-anchor="middle" font-size="11" fill="#56665f">'+esc(new Date(x.day+'T12:00:00').toLocaleDateString(lang,{weekday:'short'}))+'</text>'}).join('');
 $('#trend').innerHTML='<div class="panel"><h2>'+esc(t('trendT'))+'</h2><p>'+esc(current.name)+'</p><svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Daily PM2.5 AQI forecast. Values in the table below.">'+bars+'</svg><p>'+esc(t('forecastNote'))+'</p><div class="forecast-row"><b>Date</b><b>'+esc(t('range'))+'</b><b>'+esc(t('average'))+'</b></div>'+f.map(x=>'<div class="forecast-row"><b>'+esc(new Date(x.day+'T12:00:00').toLocaleDateString(lang,{month:'short',day:'numeric'}))+'</b><span>'+(x.min??'—')+'–'+(x.max??'—')+'</span><b style="color:'+color(x.avg)+'">'+x.avg+'</b></div>').join('')+'<p style="margin-top:16px">'+esc(t('trendSrc'))+'</p></div>';
}
function showTab(view){
 scrollPositions[activeView]=$('#card').scrollTop;activeView=view;$('.app').dataset.view=view;
 $$('.tabs button').forEach(b=>{const on=b.dataset.tab===view;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1});
 ['now','nearby','news','trend'].forEach(id=>$('#'+id).hidden=id!==(view==='map'?'now':view));
 if(view==='nearby')renderNearby();if(view==='news')loadNews();if(view==='trend')renderTrend();
 $('#card').scrollTop=scrollPositions[view]||0;
 if(view==='map'){requestAnimationFrame(()=>{map?.invalidateSize({pan:false});loadViewport()})}
}
let focusReturn=null,openOverlay=null;
function openModal(id){
 focusReturn=document.activeElement;openOverlay=$('#'+id);openOverlay.hidden=false;
 $('.top').inert=true;$('.workspace').inert=true;
 if(id==='modal'){syncSettings();$('#close').focus()}else{$('#sinput').focus()}
}
function closeModal(){
 if(!openOverlay)return;openOverlay.hidden=true;openOverlay=null;$('.top').inert=false;$('.workspace').inert=false;focusReturn?.focus();
}
document.addEventListener('keydown',e=>{
 if(openOverlay){if(e.key==='Escape'){e.preventDefault();closeModal()}else if(e.key==='Tab'){
 const nodes=[...openOverlay.querySelectorAll('button,input,select,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }}
});
function syncSettings(){
 $('#index').value=settings.index;
 $('#delta').value=settings.delta;$('#delta-label').textContent=settings.delta+'+';$('#browser-alert').checked=settings.browser;$('#background-alert').checked=settings.background;$('#sensitive').checked=settings.sensitive;$('#locale').value=settings.locale;
 const supported=typeof Notification!=='undefined';$('#browser-alert').disabled=!supported;
 $('#notify-help').textContent=supported?t('foregroundNote'):t('noNotif')+(/iPad|iPhone|iPod/.test(navigator.userAgent)?' '+t('hsHint'):'');
 $('#background-setting').hidden=!backgroundReady;$('#background-alert').disabled=!settings.browser;
}
async function saveSettings(){
 const button=$('#save');button.disabled=true;
 try{
  let enabled=$('#browser-alert').checked;
  if(enabled){if(typeof Notification==='undefined')enabled=false;else if(Notification.permission==='default')enabled=await Notification.requestPermission()==='granted';else enabled=Notification.permission==='granted';if(!enabled)toast(t('permissionDenied'))}
  const indexChanged=settings.index!==$('#index').value;
  const next={delta:+$('#delta').value,browser:enabled,sensitive:$('#sensitive').checked,locale:$('#locale').value,index:$('#index').value,lang,background:!indexChanged&&backgroundReady&&enabled&&$('#background-alert').checked};
  if(next.background){
   try{await enablePush(next);next.backgroundStation=stationKey(current)}catch{next.background=false;toast(t('bgFailed'))}
  }else if(settings.background){await disablePush()}
  const localeChanged=settings.locale!==next.locale;settings=next;baseline.clear();
  if(current)checkAlert(current);
  const persisted=storage.set('airly-settings',settings);closeModal();render();if(indexChanged){const p=originPoint(),mode=searchLocation?'search':'home';await useArea(p,mode)}if(localeChanged&&activeView==='news')loadNews(true);if($('#toast').hidden)toast(t(persisted?'saved':'notSaved'));
 }catch{toast(t('bgFailed'))}finally{button.disabled=false}
}
async function enablePush(next){
 if(!serviceRegistration||!current?.uid)throw Error('Select a station first');
 const kj=await requestJSON('/api/push/key');if(!kj.key)throw Error('Unavailable');
 const dec=v=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));
 let sub=await serviceRegistration.pushManager.getSubscription();if(!sub)sub=await serviceRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:dec(kj.key)});
 const response=await fetch('/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...sub.toJSON(),uid:current.uid,lat:current.lat,lon:current.lon,delta:next.delta,lang})});
 if(!response.ok)throw Error('Could not save');
}
async function disablePush(){
 const sub=await serviceRegistration?.pushManager?.getSubscription();if(!sub)return;
 const r=await fetch('/api/push/unsubscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});if(!r.ok)throw Error('Could not remove subscription');await sub.unsubscribe();
}
let searchTimer;
async function runSearch(){
 const q=$('#sinput').value.trim();searchController?.abort();const seq=++searchSequence;
 if(q.length<2){$('#sresults').replaceChildren();return}
 searchController=new AbortController();$('#sresults').textContent=t('fetching')+'…';
 try{const items=await requestJSON('/api/search?q='+encodeURIComponent(q)+'&lang='+lang,searchController.signal);
 if(seq!==searchSequence||$('#sinput').value.trim()!==q)return;
 $('#sresults').innerHTML=items.length?items.map((s,i)=>'<button class="row" data-city="'+i+'"><span class="row-text"><b>'+esc(s.name)+'</b><small>'+esc(s.region)+'</small></span>'+icon('arrow')+'</button>').join(''):'<p>'+esc(t('noResults'))+'</p>';
 $$('#sresults [data-city]').forEach(b=>b.onclick=()=>{const p=items[+b.dataset.city];closeModal();showTab('now');useArea(p,'search')});
 }catch(e){if(seq===searchSequence)$('#sresults').textContent=t('dataError')}
}
$('#delta').oninput=e=>$('#delta-label').textContent=e.target.value+'+';
$('#browser-alert').onchange=e=>{ $('#background-alert').disabled=!e.target.checked;if(!e.target.checked)$('#background-alert').checked=false };
$('#open-settings').onclick=()=>openModal('modal');$('#close').onclick=closeModal;
$('#open-search').onclick=()=>openModal('smodal');$('#sclose').onclick=closeModal;
$$('.overlay').forEach(el=>el.onclick=e=>{if(e.target===el)closeModal()});
$('#sinput').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,300)};
$('#save').onclick=saveSettings;$('#refresh').onclick=()=>refresh(true);$('#location').onclick=locate;
$('#locate').onclick=()=>centreMap();$('#map-reading').onclick=()=>showTab('now');
$('#lang').onchange=e=>{lang=e.target.value;settings.lang=lang;storage.set('airly-settings',settings);applyI18n();render();if(activeView==='news'&&newsCache)renderNews(newsCache)};
$$('.tabs button').forEach(b=>{
 b.onclick=()=>showTab(b.dataset.tab);
 b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=$$('.tabs button').filter(el=>el.getClientRects().length);const index=buttons.indexOf(b),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;showTab(buttons[next].dataset.tab);buttons[next].focus()};
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(refreshTimer);return}render();if(Date.now()-lastSuccess>300000)refresh();else scheduleRefresh()});
window.addEventListener('offline',()=>{clearTimeout(refreshTimer);loadError='Offline';render()});
window.addEventListener('online',()=>refresh());
matchMedia('(max-width:820px)').addEventListener('change',e=>{if(!e.matches&&activeView==='map')showTab('now');requestAnimationFrame(()=>map?.invalidateSize({pan:false}))});
// Keep age labels current without replacing the dashboard or interrupting focus.
setInterval(()=>{
 if(document.hidden||!current||loading)return;
 const live=$('#now .live');if(!live)return;
 const q=quality(current);if(!loadError&&live.dataset.quality!==q){render();return}
 const status=current.detail===false?t('stationLoading'):loadError?t(navigator.onLine===false?'offline':'failed'):t(q==='fresh'?'fresh':q==='stale'?'stale':'unknownTime');
 live.lastElementChild.textContent=status+(current.time?' · '+ageText(current.time):'');
 $('#map-reading-label').textContent=indexLabel(current)+(current.time?' · '+ageText(current.time):'');
},60000);
applyI18n();initMap();loading=true;render();
(async()=>{
 await ipLocate();
 try{const permission=await navigator.permissions?.query({name:'geolocation'});if(permission?.state==='granted'&&requestMode==='home')locate()}catch{}
})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(r=>{serviceRegistration=r}).catch(()=>{});
requestJSON('/api/config').then(c=>{backgroundReady=!!c.backgroundPush&&'PushManager' in window;syncSettings()}).catch(()=>syncSettings());

</script></body></html>*/}
const HTML = HTML_SOURCE.toString().slice(HTML_SOURCE.toString().indexOf('/*') + 2, HTML_SOURCE.toString().lastIndexOf('*/'))
  .replace('<link rel="stylesheet"', [
    '<meta name="description" content="Live air quality worldwide: AQI readings, PM2.5, haze maps, daily forecasts and health advice for your location — Malaysia, Southeast Asia and every region on the World Air Quality Index network.">',
    '<meta name="keywords" content="air quality Malaysia, AQI Malaysia, API Malaysia, jerebu, indeks pencemaran udara, haze Southeast Asia, PM2.5, Kuala Lumpur air quality, Singapore PSI, haze forecast, kualiti udara, 空气质量, காற்றுத் தரம், air quality near me, world AQI map, global air pollution">',
    '<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebApplication',name:'Airly by Ordinexis',url:'__ORIGIN__/',description:'Live worldwide air quality: AQI readings, PM2.5, haze maps, forecasts and health advice, scoped to your location.',applicationCategory:'Weather',operatingSystem:'Any',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},creator:{'@type':'Organization',name:'Ordinexis',url:'https://www.ordinexis.com'},inLanguage:['en','ms','ta','zh']})+'</'+'script>',
    '<link rel="icon" type="image/png" href="/favicon.png">',
    '<link rel="apple-touch-icon" href="/icon-180.png">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="apple-mobile-web-app-title" content="Airly">',
    '<link rel="canonical" href="__ORIGIN__/">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Airly">',
    '<meta property="og:title" content="Airly — Global AQI · Live Air Quality Map">',
    '<meta property="og:description" content="Live AQI, PM2.5 and haze readings across Southeast Asia, with health guidance and local air-quality news.">',
    '<meta property="og:url" content="__ORIGIN__/">',
    '<meta property="og:image" content="__ORIGIN__/og-image.png">',
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="Airly — live Southeast Asia air quality">',
    '<meta property="og:locale" content="en_MY">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="Airly — Global AQI · Live Air Quality Map">',
    '<meta name="twitter:description" content="Live AQI, PM2.5 and haze readings across Southeast Asia.">',
    '<meta name="twitter:image" content="__ORIGIN__/og-image.png">',
    '<link rel="stylesheet"'
  ].join(''));

const LOGO_PNG_B64 = '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';
const FAVICON_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEl0lEQVR4nO1bQW8bRRT+3uzaqe0aVW3DmRsVFClOj6DsnQoqVS1SJE5NKtXtAaTc6I8oHFIj1e01ikgjFak/YC0hTiQ5FJQTl0rhUFekiR1nnd33OCQLjr1ee7OzNrHz3bwez8z3zZs3895bEyJAvH2J0n5YIOMc9d22V4PTQrobeomhwr487eSB3hwC1RkF4kEIsoYOCxhV8kAwN9WrwaihnWOoDxgH/CvAOKy+j1auqv3BuMDnfLYFhj2BYYPG0fxbMfYWYA57AnEhItz+jIj6XthTL0AUskHQJoCIiAhYKTJ09RkEZvGIoIiIBJDXr//a9Dx2BQIiQi6byb8/efGDfvvTJgAREREMYTCpZHyL8KHAIiIAwMxe5de1t7W6MwFhYebU39u77ncLd7hfy4gtgIgIEREArP9WWy9cO19IQgS/T38MADCUMr/+6vpnfpv9fadWevbTn8zsGYbR1/gaJkniONJYfLRVebjwrvB8uWqTgvI8ceP3fQjPE5cU1PPlqv1w4V1h8dFWxXGkIQJmZo9ZPBHhfadZU0SRjvVYAvj78Y9Xe5svX8gM03bzyeKOtbL0xjYMMnWI4HniGgaZK0tv7CeLOxbTdvPlC5n5/VV9kwgKIBCR8k2+vu9kovQfS4DD/Qiems5OzRUnbHiZNFSjWS7tahGhlXy5tGtBNZrwMun54oRdmM5NtTvddDqVmf7kw60oJ4OWm6C/P49NlDPp+WLevjU7aflEovQZSL6lT11+Rouj8vf8rdlJa76Yt8GtllCNbAm9yPs+Iei3zOxFmbs2T+2T7BQhmk/oh3yYNSmlIt1DtB5V3UXozxLikj8JtF9YgkXY62kJneT3EicPJBQNdoqQDT0dglc+mzh5IOF8QPCq/kfMdeUAAEyTUoM0+1YknhDptq/ninn79uykBQArS1W7XNoZOHlgQBmhIBFIcun73+QrAPD4h90ZofrAyQMDTIm1ivD0x7rl8Z4HObrFkXiGyhpz93IDJX809OBygq4rB6ZJqZ9X31Yef1/9VKQpAECUpvvfXv7ly5uXZvw2g5rT2OcE/1db4M69nH17FLdAbye4MyO0d+x0GJQIiQ/Q/Rg8b39x85IFAI7DdrkkFlSj+bQEi4CBOcNEfUD43f6y5bpy4LpyEBw76EuqhCExAfoJbEyTUqZJqe4BVPIiJCJA1MAmPIpMVgTtApw0sBmWCFoFiBvPdw+lkxNBmwC6khlRQ+m40CKAMFhnJqcfSxBGR1H0JIgtgAgYBFpdrmqN58MsYXW5aoNAIvFF0FIY2Virb5RLjkWG3ng+0BKMRrNccqz1tdoGERSzRMoCt0NLYeSjq5krn9+gCsmF9N0H72m9xbWKcPdB3lZyIX39BlU+vpq9oqMaHTsWOF4cra8XruUSLo4ejtE+9kmhPRhKujyuu29tnYmIMIuXFHngsAJ1VAnWtmhnb4kNewLDxpkAw57AsKGi/MFo1EDGuXjv2I0CzgQAov3PblTgc1btD8YBrVzPtkDrh3GwgnaOHRYwyiIEcQslOypxQtiihvqAUbCGXhwiETwtFhFl4f4BQ7GeTeHRK14AAAAASUVORK5CYII=';
const OG_PNG_B64 = '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';
const ICON_PNG_B64 = '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';

