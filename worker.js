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
 *            KV binding PUSH_SUBS + VAPID_* secrets
 *              + [triggers] crons = ["0,30 * * * *"]  -> background push (else in-page alerts)
 *
 * Frontend HTML is a template string so Wrangler preserves it when bundling.
 * Audited edition: official Malaysia API auto-selection, strict US AQI units elsewhere.
 * Malaysia uses the public DOE APIMS feed; no extra token or binding is needed.
 * Health guidance is deterministic; the former AI endpoint is retired.
 * Required secret remains AQICN_TOKEN. Supports Wrangler bundling.
 */

import {HTML_SOURCE} from './ui/app.js';
import {countryAt} from './lib/geo.js';
import {normalizeWaqi, measurementTime, WAQI_METHOD} from './lib/air-quality.js';
import {alertTransition} from './lib/alerts.js';
import alertSource from './data/alert-source.js';
import release from './data/release.js';
import {leafletJS, leafletCSS} from './data/leaflet.js';
const logFailure = (route, code) => console.warn(JSON.stringify({event:'request_failure',route,code}));

const SEA_BOUNDS = '-11,92,29,141';
const SW_JS = "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(c=>c[0]?c[0].focus():self.clients.openWindow('/')))});self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title||'Airly',{body:d.body||''}))});";
const UPSTREAM_TIMEOUT = 8000;
const FRESH_MS = 3 * 3600000; // matches the dashboard's fresh/stale boundary
const COVERAGE_KM = 100; // beyond this a station does not describe the user's air

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
    if (url.pathname === '/api/config') return json({ backgroundPush: pushReady(env), release });
    if (url.pathname === '/api/air') return air(request, env);
    if (url.pathname === '/api/search') return searchStations(request);
    if (url.pathname === '/api/advice') return json({error:'AI advice has been retired. Use the dashboard category guidance.',code:'RETIRED'},410);
    if (url.pathname === '/api/location') return location(request);
    if (url.pathname === '/api/news') return news(request, ctx);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML.replaceAll('__ORIGIN__', url.origin), { headers: {
        'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-cache', 'x-airly-release':release,
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
  const p = new URL(request.url).searchParams;
  if (p.has('lat') || p.has('lon')) {
    const lat=number(p.get('lat')),lon=number(p.get('lon'));
    if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)return json({error:'Invalid coordinates'},400);
    return json({lat,lon,country:countryAt(lat,lon),source:'coordinates'});
  }
  const cf = request.cf || {};
  const lat = number(cf.latitude), lon = number(cf.longitude);
  if (lat === null || lon === null || Math.abs(lat)>90 || Math.abs(lon)>180) return json({ error: 'IP location unavailable' }, 404);
  return json({ lat, lon, city: cf.city || '', region: cf.region || '', country: cf.country || '', source: 'ip', approximate: true });
}

async function air(request, env) {
  const p = new URL(request.url).searchParams, uid = p.get('uid');
  if (p.has('index') && !['auto','my','us'].includes(p.get('index'))) return json({ error: 'Invalid index' }, 400);
  if (p.has('country') && !/^[A-Z]{2}$/.test(p.get('country'))) return json({ error: 'Invalid country' }, 400);
  // Station identity pins the provider: never change scales mid-refresh or alert.
  const lat=number(p.get('lat')),lon=number(p.get('lon')),bounds=p.get('bbox')?.split(',').map(number);
  if((p.has('lat')||p.has('lon'))&&(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180))return json({error:'Invalid coordinates'},400);
  const coordinateCountry=lat!==null&&lon!==null?countryAt(lat,lon):bounds?.length===4&&bounds.every(x=>x!==null)?countryAt((bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2):null;
  const country=coordinateCountry??p.get('country')??request.cf?.country;
  const malaysia = uid ? /^my:/.test(uid) : p.get('index') === 'my' || (p.get('index') !== 'us' && country === 'MY');
  return malaysia ? malaysiaAir(request, env) : waqiAir(request, env);
}

const MY_FEED = 'https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query?where=1%3D1&outFields=STATION_ID,DATETIME,API,PARAM_SELECTED,STATION_LOCATION,LONGITUDE,LATITUDE&returnGeometry=false&f=json';
async function malaysiaStations() {
  // Cache public station data at the edge; each request owns its upstream promise.
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
        provider: 'doe', index: 'my', calculation: 'doe-official-api', name: String(a.STATION_LOCATION || 'DOE monitoring station'),
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
    const byDistance = (list) => list.slice().sort((a,b)=>stationDistance(lat??3.139,lon??101.687,a)-stationDistance(lat??3.139,lon??101.687,b));
    // A station that stopped reporting must not outrank a working neighbour: prefer the
    // nearest reading from the last 3 hours (the client's freshness limit), and only fall back to a stale one.
    const recent = stations.filter(s=>Date.parse(s.time)>Date.now()-FRESH_MS);
    const station = uid ? stations.find(s=>s.uid===uid) : byDistance(recent.length?recent:stations)[0];
    if (!station) return json({ error: 'This DOE station has no available API reading', code: 'NO_READING' }, 502);
    // IP country can be wrong (e.g. a VPN). Never imply a distant Malaysian station
    // measures air at a GPS position on another continent.
    if (!uid && lat !== null && stationDistance(lat,lon,station)>COVERAGE_KM) return json({error:'No Malaysia API station covers this area. Select US AQI for worldwide stations.',code:'NO_COVERAGE'},422);
    return json(station);
  } catch { logFailure('air','DOE_UNAVAILABLE'); return json({ error: 'Malaysia DOE API readings are temporarily unavailable. Try again or select US AQI in settings.', code: 'DOE_UNAVAILABLE' }, 502); }
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
      // Bounds feeds have no pollutant sub-indices or reliable timezone. They
      // locate stations; their headline numbers cannot be trusted as US AQI.
      const bb=bounds.split(',').map(Number),center=[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2];
      const stations=result.data.map(s=>({uid:number(s.uid),provider:'waqi',index:'us',name:String(s.station?.name||'Monitoring station'),
        aqi:null,lat:number(s.lat),lon:number(s.lon),time:null,detail:false,calculation:'unverified-summary'}))
        .filter(s=>Number.isSafeInteger(s.uid)&&s.uid>0&&s.lat!==null&&s.lon!==null&&Math.abs(s.lat)<=90&&Math.abs(s.lon)<=180)
        .sort((a,b)=>stationDistance(...center,a)-stationDistance(...center,b));
      // Bounded fan-out: 1 bounds + at most 12 detail requests, including failures.
      // Other stations remain selectable neutral pins; never invent their AQI.
      await Promise.all(stations.slice(0,12).map(async(s,i)=>{
        try{stations[i]=await waqiStation('@'+s.uid,env,s.uid)}catch{/* keep neutral station */}
      }));
      return json(stations);
    }
    // Preserve coordinates for station matching. No artificial kilometre rounding.
    const target = uid ? '@'+uid : lat !== null ? 'geo:'+lat+';'+lon : 'geo:3.139;101.687';
    // WAQI's geo feed picks its own "nearest" station, which can be silent or distant.
    // For coordinates, rank real stations by distance and prefer a fresh reading.
    const station=(!uid&&lat!==null&&await nearestWaqi(lat,lon,env))||await waqiStation(target,env,uid);
    if(!uid&&lat!==null&&stationDistance(lat,lon,station)>COVERAGE_KM)return json({error:'No nearby station reading is available for these coordinates',code:'NO_COVERAGE'},422);
    return json(station);
  } catch { logFailure('air','UPSTREAM_UNAVAILABLE'); return json({ error: 'Air quality data is temporarily unavailable', code: 'UPSTREAM_UNAVAILABLE' }, 502); }
}
async function nearestWaqi(lat, lon, env) {
  try {
    for (const span of [0.3, 1.2]) {
      const box = [Math.max(-90,lat-span), Math.max(-180,lon-span), Math.min(90,lat+span), Math.min(180,lon+span)].map(x=>x.toFixed(4)).join(',');
      const result = await fetchJson('https://api.waqi.info/v2/map/bounds?latlng='+box+'&networks=all&token='+encodeURIComponent(env.AQICN_TOKEN));
      if (result.status !== 'ok' || !Array.isArray(result.data)) return null;
      const near = result.data.map(s=>({uid:number(s.uid),lat:number(s.lat),lon:number(s.lon)}))
        .filter(s=>Number.isSafeInteger(s.uid)&&s.uid>0&&s.lat!==null&&s.lon!==null&&Math.abs(s.lat)<=90&&Math.abs(s.lon)<=180)
        .map(s=>({...s,km:stationDistance(lat,lon,s)})).filter(s=>s.km<=COVERAGE_KM).sort((a,b)=>a.km-b.km).slice(0,6);
      if (!near.length) continue;
      const details = (await Promise.all(near.map(s=>waqiStation('@'+s.uid,env,s.uid).catch(()=>null)))).filter(Boolean);
      const fresh = details.filter(d=>Date.parse(d.time)>Date.now()-FRESH_MS&&Date.parse(d.time)<Date.now()+600000);
      const pick = (fresh.length?fresh:details).sort((a,b)=>stationDistance(lat,lon,a)-stationDistance(lat,lon,b))[0];
      if (pick) return pick;
    }
  } catch { /* fall back to WAQI's own geo lookup */ }
  return null;
}
async function waqiStation(target,env,uid=null) {
  const result=await fetchJson('https://api.waqi.info/feed/'+target+'/?token='+encodeURIComponent(env.AQICN_TOKEN));
  if(result.status!=='ok'||!result.data)throw Error('Unavailable station');
  return normalizeWaqi(result.data,uid);
}
const validAqi = value => { const n = number(value); return n !== null && n >= 0 ? n : null; };



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
  } catch { logFailure('search','UPSTREAM_UNAVAILABLE'); return json({error:'City search is temporarily unavailable',code:'UPSTREAM_UNAVAILABLE'},503); }
}

function vendor(pathname) {
  const js=pathname.endsWith('.js');
  return new Response(js?leafletJS:leafletCSS,{headers:{'content-type':js?'text/javascript; charset=UTF-8':'text/css; charset=UTF-8','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
}

async function news(request, ctx) {
  const reqUrl = new URL(request.url);
  const fresh = reqUrl.searchParams.get('fresh') === '1';
  const cf = request.cf || {};
  const requested = reqUrl.searchParams.get('locale');
  const resolved=reqUrl.searchParams.get('location')==='resolved';
  const country = requested && requested !== 'AUTO' && /^[A-Z]{2}$/.test(requested) ? requested : resolved?'':(/^[A-Z]{2}$/.test(cf.country || '') ? cf.country : '');
  let countryName = country; try { countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || country } catch {}
  const isSea = { MY:1, SG:1, ID:1, TH:1, VN:1, PH:1, BN:1, KH:1, LA:1, MM:1, TL:1 }[country];
  const city = (reqUrl.searchParams.get('city') || '').replace(/[\u0000-\u001f]/g,'').trim().slice(0,80);
  const localArea = city || (!resolved&&(!requested || requested === 'AUTO' || country === cf.country) ? (cf.city || cf.region || '') : '');
  const cache = caches.default;
  const key = new Request(`https://airly-cache.local/news/v6/${country}/${encodeURIComponent(localArea || 'all')}`);
  if (!fresh) { const cached = await cache.match(key); if (cached) { const response=new Response(cached.body,cached); response.headers.set('cache-control','private, max-age=900'); return response; } }
  try {
    // Decode &amp; LAST so "&amp;lt;" doesn't become "<"; strip tags before entity decode.
    const decode = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
    const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);
    const scopes = [
      localArea ? { label:'Near you', query:`air quality haze PM2.5 ${localArea} ${countryName}` } : null,
      country ? { label:countryName, query:`air quality haze PM2.5 ${countryName}` } : null,
      isSea ? { label:'Southeast Asia', query:'air quality haze PM2.5 Southeast Asia' } : null,
      { label:'Global', query:'air quality pollution wildfire smoke global' }
    ].filter(Boolean);
    const market = ({ MY:'en-MY', SG:'en-SG', ID:'id-ID', TH:'th-TH', VN:'vi-VN', PH:'en-PH', US:'en-US', GB:'en-GB', IN:'en-IN', AU:'en-AU', CN:'zh-CN', TW:'zh-TW', HK:'zh-HK', JP:'ja-JP', KR:'ko-KR', DE:'de-DE', FR:'fr-FR' })[country] || 'en-US';
    const results = await Promise.allSettled(scopes.map(async scope => {
      const rssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(scope.query)}&format=rss&mkt=${market}&qft=${encodeURIComponent('sortbydate="1"')}`;
      const response = await fetch(rssUrl, { headers:{ 'user-agent':'Airly/1.0 (+https://www.ordinexis.com) RSS reader' }, cf:{ cacheTtl:900, cacheEverything:true }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) });
      if (!response.ok) throw Error('news source unavailable');
      const rss = await response.text();
      if(!/<rss[\s>]|<channel[\s>]/i.test(rss))throw Error('invalid RSS');
      return [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => ({ title:tag(m[1],'title'), link:tag(m[1],'link'), source:`${scope.label} · ${tag(m[1],'News:Source') || tag(m[1],'source') || 'News'}`, published:tag(m[1],'pubDate') })).filter(x => x.title && /^https?:\/\//i.test(x.link || '')).sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0)).slice(0,4);
    }));
    const successes=results.filter(r=>r.status==='fulfilled');
    if(!successes.length)throw Error('all news sources unavailable');
    const degraded=successes.length!==results.length;
    if(degraded)logFailure('news','PARTIAL_UPSTREAM_FAILURE');
    const feeds=results.map(r=>r.status==='fulfilled'?r.value:[]);
    const seen = new Set();
    // Keep local → country → region → global priority, newest first within each group.
    const stories = feeds.flat().filter(story => { const id = story.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'').slice(0,120); if(seen.has(id)) return false; seen.add(id); return true; })
      .slice(0,16);
    const response=json(stories,200,fresh||degraded?'no-store':'private, max-age=900');
    if(degraded)response.headers.set('x-airly-degraded','1');
    else ctx.waitUntil(cache.put(key,json(stories,200,'public, max-age=900')));
    return response;
  } catch { logFailure('news','UPSTREAM_UNAVAILABLE'); return json({error:'News sources are temporarily unavailable',code:'UPSTREAM_UNAVAILABLE'},503); }
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

const SUBSCRIPTION_TTL = 30 * 86400;
const CURSOR_KEY = '_meta:alert-cursor';

async function boundedBody(request, limit=4096) {
  if(Number(request.headers.get('content-length')||0)>limit)throw Object.assign(Error('Body too large'),{status:413});
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Object.assign(Error('Body too large'),{status:413})}chunks.push(value)}
  }finally{reader.releaseLock()}
  const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(all);
}
async function validPushKeys(keys) {
  try {
    if(!/^[A-Za-z0-9_-]{87}$/.test(keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(keys?.auth||''))return false;
    const pub=b64uToBytes(keys.p256dh),auth=b64uToBytes(keys.auth);
    if(pub.length!==65||pub[0]!==4||auth.length!==16||bytesToB64u(pub)!==keys.p256dh||bytesToB64u(auth)!==keys.auth)return false;
    await crypto.subtle.importKey('raw',pub,{name:'ECDH',namedCurve:'P-256'},false,[]);return true;
  }catch{return false}
}
async function pushApi(request, env) {
  if (!pushReady(env)) return json({ fallback: true }, 200, 'no-store');
  const url = new URL(request.url);
  if (url.pathname === '/api/push/key' && request.method === 'GET') return json({ key: env.VAPID_PUBLIC_KEY }, 200, 'public, max-age=86400');
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if(!['/api/push/subscribe','/api/push/unsubscribe'].includes(url.pathname))return json({error:'not found'},404);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Origin not allowed' }, 403);
  let body;try{body=JSON.parse(await boundedBody(request))}catch(e){return json({error:e.status===413?'Body too large':'invalid body'},e.status||400)}
  const endpoint = validPushEndpoint(body?.endpoint);
  if (!endpoint) return json({ error: 'invalid subscription' }, 400);
  const id = await subKeyOf(endpoint);
  try {
    if (url.pathname === '/api/push/unsubscribe') { await env.PUSH_SUBS.delete(id); return json({ ok: true }); }
    if(!env.PUSH_LIMIT||!env.PUSH_BUDGET)return json({error:'Registration limits are not configured'},503);
    const actor=await subKeyOf('airly:'+(request.headers.get('cf-connecting-ip')||'unknown'));
    const limits=await Promise.all([env.PUSH_LIMIT.limit({key:actor}),env.PUSH_BUDGET.limit({key:'airly:subscribe'})]);
    if(limits.some(r=>!r.success))return json({error:'Too many registration requests. Try again later.'},429);
    if (!await validPushKeys(body.keys)) return json({ error: 'invalid subscription keys' }, 400);
    const lat = number(body.lat), lon = number(body.lon), my = typeof body.uid === 'string' && /^my:[A-Z0-9_-]{1,20}$/.test(body.uid), uid = my ? body.uid : number(body.uid);
    if (lat === null || lon === null || Math.abs(lat)>90 || Math.abs(lon)>180 || (!my && (!Number.isSafeInteger(uid) || uid<=0 || uid>999999999))) return json({ error: 'Invalid station' }, 400);
    const old=JSON.parse(await env.PUSH_SUBS.get(id)||'null');
    const method=my?'doe-official-api':WAQI_METHOD;
    const same=old?.uid===uid&&old?.index===(my?'my':'us')&&old?.calculation===method;
    const rec = { endpoint, keys:{p256dh:body.keys.p256dh,auth:body.keys.auth}, uid, index: my ? 'my' : 'us', calculation:method, lat, lon,
      delta: Math.min(100, Math.max(10, Number(body.delta) || 25)),
      lang: ['en', 'ms', 'ta', 'zh'].includes(body.lang) ? body.lang : 'en',
      lastAqi:same?old.lastAqi:null,lastTime:same?old.lastTime:null,lastSeen:same?old.lastSeen:null,
      ts:Date.now(),expiresAt:Date.now()+SUBSCRIPTION_TTL*1000 };
    await env.PUSH_SUBS.put(id, JSON.stringify(rec),{expirationTtl:SUBSCRIPTION_TTL});
    return json({ ok: true });
  }catch{logFailure('push','STORAGE_UNAVAILABLE');return json({error:'Subscription storage is unavailable'},503)}
}

const PUSH_I18N = {
  en: (n, d, dir, a) => [`Airly — air quality ${dir > 0 ? 'worsened' : 'improved'}`, `${n}: AQI ${dir > 0 ? 'rose' : 'fell'} ${d} to ${a}.`],
  ms: (n, d, dir, a) => [`Airly — kualiti udara ${dir > 0 ? 'merosot' : 'bertambah baik'}`, `${n}: AQI ${dir > 0 ? 'naik' : 'turun'} ${d} kepada ${a}.`],
  ta: (n, d, dir, a) => [`Airly — காற்றுத் தரம் ${dir > 0 ? 'மோசமடைந்தது' : 'மேம்பட்டது'}`, `${n}: AQI ${d} ${dir > 0 ? 'உயர்ந்து' : 'குறைந்து'} ${a} ஆனது.`],
  zh: (n, d, dir, a) => [`Airly — 空气质量${dir > 0 ? '恶化' : '改善'}`, `${n}：AQI ${dir > 0 ? '上升' : '下降'} ${d}，现为 ${a}。`]
};

async function checkSubscriptions(env) {
  if (!pushReady(env)) return;
  const started=Date.now(),feedMemo=new Map();let processed=0,pages=0;
  const memo=(key,fn)=>{if(!feedMemo.has(key))feedMemo.set(key,Promise.resolve().then(fn));return feedMemo.get(key)};
  let state;
  try{state=JSON.parse(await env.PUSH_SUBS.get(CURSOR_KEY)||'null')||{cursor:undefined,offset:0}}
  catch{logFailure('push-cron','CURSOR_UNAVAILABLE');return}
  const process=async k=>{
    if(k.name===CURSOR_KEY)return;
    try {
      const rec=JSON.parse(await env.PUSH_SUBS.get(k.name)||'null');if(!rec?.endpoint)return;
      if(!validPushEndpoint(rec.endpoint)||!await validPushKeys(rec.keys)||!Number.isFinite(rec.expiresAt)&&(!Number.isFinite(rec.ts)||Date.now()-rec.ts>SUBSCRIPTION_TTL*1000)||Number.isFinite(rec.expiresAt)&&rec.expiresAt<Date.now()){await env.PUSH_SUBS.delete(k.name);return}
      const my=typeof rec.uid==='string'&&/^my:[A-Z0-9_-]{1,20}$/.test(rec.uid);
      if(!my&&!env.AQICN_TOKEN)return;
      const bucket=my?rec.uid:'@'+rec.uid;
      const feed=await memo(bucket,async()=>{
        if(my){const stations=await memo('doe',malaysiaStations),d=stations.find(s=>s.uid===rec.uid);return d?{status:'ok',data:{aqi:d.aqi,city:{name:d.name},time:{iso:d.time}}}:null}
        return fetchJson('https://api.waqi.info/feed/'+bucket+'/?token='+encodeURIComponent(env.AQICN_TOKEN));
      });
      if(feed?.status!=='ok')return;
      const method=my?'doe-official-api':WAQI_METHOD;
      const aqi=my?validAqi(feed.data?.aqi):normalizeWaqi(feed.data,rec.uid).aqi,stamp=Date.parse(measurementTime(feed.data?.time)||'');
      if(aqi===null||!Number.isFinite(stamp))return;
      if(rec.calculation!==method){rec.lastAqi=null;rec.lastTime=null;rec.lastSeen=null;rec.calculation=method}
      const next=alertTransition({aqi:rec.lastAqi,time:rec.lastTime,seen:rec.lastSeen??rec.lastTime},aqi,stamp,rec.delta);
      if(!next)return;
      rec.lastSeen=next.seen;
      if(next.notify){
        const dir=aqi>rec.lastAqi?1:-1;
        const [title,msg]=(PUSH_I18N[rec.lang]||PUSH_I18N.en)(feed.data.city?.name||'Your area',Math.abs(aqi-rec.lastAqi),dir,aqi);
        const response=await sendPush(env,rec,JSON.stringify({title,body:msg.replace('AQI',my?'Malaysia API':'US AQI (WAQI)')}));
        if(response.status===404||response.status===410){await env.PUSH_SUBS.delete(k.name);return}
        if(response.ok){rec.lastAqi=next.aqi;rec.lastTime=next.time}else logFailure('push-cron','DELIVERY_REJECTED');
      }else{rec.lastAqi=next.aqi;rec.lastTime=next.time}
      // Legacy records acquire a finite expiry; processing never renews consent.
      rec.expiresAt??=rec.ts+SUBSCRIPTION_TTL*1000;
      await env.PUSH_SUBS.put(k.name,JSON.stringify(rec),{expirationTtl:Math.max(60,Math.ceil((rec.expiresAt-Date.now())/1000))});
    }catch{logFailure('push-cron','SUBSCRIBER_CHECK_FAILED')}
  };
  try {
    while(pages++<32){
      const list=await env.PUSH_SUBS.list({limit:64,...(state.cursor?{cursor:state.cursor}:{})});
      for(let offset=state.offset||0;offset<list.keys.length;offset+=4){
        if(Date.now()-started>180000){state.offset=offset;await env.PUSH_SUBS.put(CURSOR_KEY,JSON.stringify(state));return}
        const batch=list.keys.slice(offset,offset+4);await Promise.all(batch.map(process));processed+=batch.length;
      }
      if(list.list_complete){await env.PUSH_SUBS.delete(CURSOR_KEY);break}
      if(!list.cursor)throw Error('incomplete listing without cursor');
      state={cursor:list.cursor,offset:0};await env.PUSH_SUBS.put(CURSOR_KEY,JSON.stringify(state));
    }
    console.log(JSON.stringify({event:'push_check',processed,pages,durationMs:Date.now()-started}));
  }catch{logFailure('push-cron','LIST_FAILED');await env.PUSH_SUBS.delete(CURSOR_KEY)}
}

const HTML = HTML_SOURCE
  .replace('__ALERT_TRANSITION__',alertSource)
  .replace('<title>', [
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
    '<title>'
  ].join(''));

const LOGO_PNG_B64 = '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';
const FAVICON_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEl0lEQVR4nO1bQW8bRRT+3uzaqe0aVW3DmRsVFClOj6DsnQoqVS1SJE5NKtXtAaTc6I8oHFIj1e01ikgjFak/YC0hTiQ5FJQTl0rhUFekiR1nnd33OCQLjr1ee7OzNrHz3bwez8z3zZs3895bEyJAvH2J0n5YIOMc9d22V4PTQrobeomhwr487eSB3hwC1RkF4kEIsoYOCxhV8kAwN9WrwaihnWOoDxgH/CvAOKy+j1auqv3BuMDnfLYFhj2BYYPG0fxbMfYWYA57AnEhItz+jIj6XthTL0AUskHQJoCIiAhYKTJ09RkEZvGIoIiIBJDXr//a9Dx2BQIiQi6byb8/efGDfvvTJgAREREMYTCpZHyL8KHAIiIAwMxe5de1t7W6MwFhYebU39u77ncLd7hfy4gtgIgIEREArP9WWy9cO19IQgS/T38MADCUMr/+6vpnfpv9fadWevbTn8zsGYbR1/gaJkniONJYfLRVebjwrvB8uWqTgvI8ceP3fQjPE5cU1PPlqv1w4V1h8dFWxXGkIQJmZo9ZPBHhfadZU0SRjvVYAvj78Y9Xe5svX8gM03bzyeKOtbL0xjYMMnWI4HniGgaZK0tv7CeLOxbTdvPlC5n5/VV9kwgKIBCR8k2+vu9kovQfS4DD/Qiems5OzRUnbHiZNFSjWS7tahGhlXy5tGtBNZrwMun54oRdmM5NtTvddDqVmf7kw60oJ4OWm6C/P49NlDPp+WLevjU7aflEovQZSL6lT11+Rouj8vf8rdlJa76Yt8GtllCNbAm9yPs+Iei3zOxFmbs2T+2T7BQhmk/oh3yYNSmlIt1DtB5V3UXozxLikj8JtF9YgkXY62kJneT3EicPJBQNdoqQDT0dglc+mzh5IOF8QPCq/kfMdeUAAEyTUoM0+1YknhDptq/ninn79uykBQArS1W7XNoZOHlgQBmhIBFIcun73+QrAPD4h90ZofrAyQMDTIm1ivD0x7rl8Z4HObrFkXiGyhpz93IDJX809OBygq4rB6ZJqZ9X31Yef1/9VKQpAECUpvvfXv7ly5uXZvw2g5rT2OcE/1db4M69nH17FLdAbye4MyO0d+x0GJQIiQ/Q/Rg8b39x85IFAI7DdrkkFlSj+bQEi4CBOcNEfUD43f6y5bpy4LpyEBw76EuqhCExAfoJbEyTUqZJqe4BVPIiJCJA1MAmPIpMVgTtApw0sBmWCFoFiBvPdw+lkxNBmwC6khlRQ+m40CKAMFhnJqcfSxBGR1H0JIgtgAgYBFpdrmqN58MsYXW5aoNAIvFF0FIY2Virb5RLjkWG3ng+0BKMRrNccqz1tdoGERSzRMoCt0NLYeSjq5krn9+gCsmF9N0H72m9xbWKcPdB3lZyIX39BlU+vpq9oqMaHTsWOF4cra8XruUSLo4ejtE+9kmhPRhKujyuu29tnYmIMIuXFHngsAJ1VAnWtmhnb4kNewLDxpkAw57AsKGi/MFo1EDGuXjv2I0CzgQAov3PblTgc1btD8YBrVzPtkDrh3GwgnaOHRYwyiIEcQslOypxQtiihvqAUbCGXhwiETwtFhFl4f4BQ7GeTeHRK14AAAAASUVORK5CYII=';
const OG_PNG_B64 = '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';
const ICON_PNG_B64 = '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';

