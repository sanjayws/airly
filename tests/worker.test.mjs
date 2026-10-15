import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
const request = (path, cf) => Object.assign(new Request('https://airly.test'+path), cf ? {cf} : {});
const station = (id, name, lat, lon) => ({attributes:{STATION_ID:id,STATION_LOCATION:name,LATITUDE:lat,LONGITUDE:lon,API:76,DATETIME:Date.UTC(2026,9,12,15),PARAM_SELECTED:'PM2.5'}});
const feed = {features:[station('CA20B','Shah Alam, SELANGOR',3.10475,101.556192),station('CA02','George Town, PENANG',5.41123,100.33543)]};
const mockUpstream = async (fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {assert.match(String(url),/^https:\/\/eqms\.doe\.gov\.my\//);return Response.json(feed)};
  try {await fn()} finally {globalThis.fetch=original}
};
test('IP location is labeled approximate, private, and validated',async()=>{
 const r=await worker.fetch(request('/api/location',{latitude:'5.41123',longitude:'100.33543',city:'George Town',region:'Penang',country:'MY'}),{},{});
 const p=await r.json();assert.equal(p.source,'ip');assert.equal(p.approximate,true);assert.equal(p.city,'George Town');assert.equal(r.headers.get('cache-control'),'no-store');
 for(const cf of [{},{latitude:'',longitude:'0'},{latitude:'91',longitude:'0'}]) assert.equal((await worker.fetch(request('/api/location',cf),{},{})).status,404);
});
test('Selangor device coordinates select Shah Alam even with Penang IP metadata',async()=>mockUpstream(async()=>{
 const r=await worker.fetch(request('/api/air?lat=3.0738&lon=101.5183&index=auto',{country:'MY',city:'George Town',latitude:'5.41123',longitude:'100.33543'}),{},{});
 const p=await r.json();assert.equal(p.uid,'my:CA20B');assert.equal(p.name,'Shah Alam, SELANGOR');assert.equal(p.index,'my');assert.equal(p.time,'2026-10-12T15:00:00.000+08:00');
}));
test('explicit station refresh preserves station identity',async()=>mockUpstream(async()=>{
 const r=await worker.fetch(request('/api/air?uid=my:CA02',{country:'SG'}),{},{});
 assert.equal((await r.json()).uid,'my:CA02');
}));
test('area bounds exclude Penang from the Selangor viewport',async()=>mockUpstream(async()=>{
 const r=await worker.fetch(request('/api/air?scope=area&bbox=2.8,101.2,3.4,101.9&index=my'),{},{});
 assert.deepEqual((await r.json()).map(s=>s.uid),['my:CA20B']);
}));
test('invalid coordinates and identities are rejected before upstream I/O',async()=>{
 for(const path of ['/api/air?lat=91&lon=0&index=my','/api/air?lat=3&index=my','/api/air?uid=my:../foo','/api/air?index=no','/api/air?country=Malaysia'])assert.equal((await worker.fetch(request(path),{},{})).status,400);
});
test('app serves location controls, security headers, and valid embedded JS',async()=>{
 const r=await worker.fetch(request('/'),{},{}),h=await r.text();
 assert.match(h,/id="use-location"/);assert.match(h,/id="location-notice"/);assert.match(h,/maximumAge:0/);assert.match(r.headers.get('permissions-policy'),/geolocation=\(self\)/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(m[1]);
});
