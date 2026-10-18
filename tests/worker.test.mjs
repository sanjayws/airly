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
test('a stalled nearby DOE station does not outrank a recently reporting one',async()=>{
 const fresh=(id,name,lat,lon,time)=>({attributes:{STATION_ID:id,STATION_LOCATION:name,LATITUDE:lat,LONGITUDE:lon,API:60,DATETIME:time,PARAM_SELECTED:'PM2.5'}});
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({features:[fresh('NEAR','Stalled',3.0738,101.5183,Date.now()-3*86400000+8*3600000),fresh('FAR','Working',3.2,101.7,Date.now()+8*3600000-600000)]});
 try{const p=await (await worker.fetch(request('/api/air?lat=3.0738&lon=101.5183&index=my'),{},{})).json();assert.equal(p.uid,'my:FAR')}
 finally{globalThis.fetch=original}
});
test('worldwide lookup skips a silent nearest WAQI station for a fresh one nearby',async()=>{
 const original=globalThis.fetch,detail=(idx,lat,time)=>({status:'ok',data:{idx,aqi:50,iaqi:{pm25:{v:50}},city:{name:'S'+idx,geo:[lat,101]},time:{iso:new Date(time).toISOString()}}});
 globalThis.fetch=async url=>{url=String(url);
  if(url.includes('map/bounds'))return Response.json({status:'ok',data:[{uid:1,lat:1.01,lon:101},{uid:2,lat:1.1,lon:101},{uid:3,lat:4,lon:101}]});
  if(url.includes('/@1/'))return Response.json(detail(1,1.01,Date.now()-86400000));
  if(url.includes('/@2/'))return Response.json(detail(2,1.1,Date.now()-600000));
  return Response.json({status:'error'})};
 try{
  const r=await worker.fetch(request('/api/air?lat=1&lon=101&index=us'),{AQICN_TOKEN:'t'},{});assert.equal((await r.json()).uid,2);
 }finally{globalThis.fetch=original}
});
test('stations beyond the coverage radius are refused',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>String(url).includes('map/bounds')?Response.json({status:'ok',data:[]}):Response.json({status:'ok',data:{idx:9,aqi:50,iaqi:{pm25:{v:50}},city:{name:'Far',geo:[3,101]},time:{iso:new Date().toISOString()}}});
 try{const r=await worker.fetch(request('/api/air?lat=1&lon=101&index=us'),{AQICN_TOKEN:'t'},{});assert.equal(r.status,422)}
 finally{globalThis.fetch=original}
});
