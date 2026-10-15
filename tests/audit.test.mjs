import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {countryAt} from '../lib/geo.js';
import {alertTransition} from '../lib/alerts.js';

const request=(path,cf={})=>Object.assign(new Request('https://airly.test'+path),{cf});
const station={attributes:{STATION_ID:'SHAH',STATION_LOCATION:'Shah Alam, SELANGOR',API:76,LATITUDE:3.10475,LONGITUDE:101.556192,DATETIME:Date.now()+8*3600000}};
const waqi={status:'ok',data:{idx:1,aqi:60,city:{name:'Test station',geo:[1.3521,103.8198]},time:{iso:new Date().toISOString()},iaqi:{pm25:{v:60}}}};
const withFetch=async(fn,body)=>{const original=globalThis.fetch;globalThis.fetch=fn;try{await body()}finally{globalThis.fetch=original}};
const env={AQICN_TOKEN:'test'};

test('GPS country controls provider even when IP country disagrees',async()=>withFetch(async url=>{const match=String(url).match(/geo:([^;]+);([^/]+)/);return Response.json(String(url).includes('eqms.doe')?{features:[station]}:{...waqi,data:{...waqi.data,city:{...waqi.data.city,geo:match?[+match[1],+match[2]]:waqi.data.city.geo}}})},async()=>{
 for(const [lat,lon,ip,expected] of [[3.0738,101.5183,'SG','my'],[1.3521,103.8198,'MY','us'],[51.5,-.12,'MY','us']]){
  const r=await worker.fetch(request(`/api/air?lat=${lat}&lon=${lon}&index=auto`,{country:ip}),env,{});
  assert.equal(r.status,200);assert.equal((await r.json()).index,expected);
 }
 assert.equal((await worker.fetch(request('/api/air?lat=51.5&lon=-.12&index=my'),env,{})).status,422);
}));
test('offline country resolver covers Malaysia regions and Singapore',()=>{
 for(const [lat,lon,code]of [[3.0738,101.5183,'MY'],[5.41123,100.33543,'MY'],[1.55,110.35,'MY'],[5.98,116.08,'MY'],[1.3521,103.8198,'SG'],[59.91,10.75,'NO']])assert.equal(countryAt(lat,lon),code);
 assert.equal(countryAt(0,-140),'');assert.equal(countryAt(91,0),'');
});
test('coordinate location metadata cannot inherit IP city',async()=>{
 const r=await worker.fetch(request('/api/location?lat=3.0738&lon=101.5183',{country:'SG',city:'George Town'}),{},{});
 const d=await r.json();assert.equal(d.country,'MY');assert.equal(d.city,undefined);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('retired advice never calls AI or upstream for missing/stale inputs',async()=>withFetch(()=>{throw Error('Must not fetch')},async()=>{
 let calls=0;const r=await worker.fetch(request('/api/advice?lat=3.1&lon=101.5'),{...env,AI:{run(){calls++}}},{});assert.equal(r.status,410);assert.equal(calls,0);
}));
test('continuous slow rises and falls cross the alert baseline',()=>{
 for(const values of [[50,56,62,68,76],[100,94,88,82,74]]){
  let baseline;let notices=0;const start=Date.UTC(2026,9,12);
  for(const [hour,aqi]of values.entries()){const now=start+hour*3600000,next=alertTransition(baseline,aqi,now,25,now);assert.ok(next);if(next.notify)notices++;baseline=next}
  assert.equal(notices,1);assert.equal(baseline.aqi,values.at(-1));
 }
});
test('alert transitions reject invalid/repeated/stale times and reset real gaps',()=>{
 const now=Date.now(),old={aqi:50,time:now-5*3600000,seen:now-3600000};
 assert.equal(alertTransition(old,80,now,25,now).notify,true);
 assert.equal(alertTransition({...old,seen:now-4*3600000},80,now,25,now).notify,false);
 for(const [aqi,stamp]of [[null,now],[-1,now],[80,now-4*3600000],[80,now+3600000],[80,old.seen]])assert.equal(alertTransition(old,aqi,stamp,25,now),null);
});
test('search and news expose total upstream failure without successful-result caching',async()=>withFetch(async()=>{throw Error('outage')},async()=>{
 const before=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>assert.fail('Must not cache outage')}};
 try{for(const path of ['/api/search?q=Shah','/api/news?locale=MY&location=resolved']){const r=await worker.fetch(request(path),{},{waitUntil(){}});assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).code,'UPSTREAM_UNAVAILABLE')}}finally{globalThis.caches=before}
}));
test('resolved news omits IP locality and marks partial failures',async()=>{
 const before=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>assert.fail('Do not cache degraded feeds')}};const queries=[];
 try{await withFetch(async url=>{const q=new URL(url).searchParams.get('q');queries.push(q);if(q.includes('Southeast Asia'))throw Error('partial');return new Response('<rss><channel></channel></rss>')},async()=>{
  const r=await worker.fetch(request('/api/news?locale=MY&location=resolved',{country:'MY',city:'George Town'}),{},{waitUntil(){}});
  assert.equal(r.status,200);assert.equal(r.headers.get('x-airly-degraded'),'1');assert.ok(queries.every(q=>!q.includes('George Town')));
 })}finally{globalThis.caches=before}
});
test('Leaflet assets are served without any upstream request',async()=>withFetch(()=>assert.fail('Must be packaged'),async()=>{
 for(const path of ['/vendor/leaflet.js','/vendor/leaflet.css'])assert.equal((await worker.fetch(request(path),{},{})).status,200);
}));

const pushEnv=()=>({PUSH_LIMIT:{limit:async()=>({success:true})},PUSH_BUDGET:{limit:async()=>({success:true})},VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test',PUSH_SUBS:{get:async()=>null,put:async()=>assert.fail('Invalid record stored'),delete:async()=>{}}});
const pushRequest=body=>new Request('https://airly.test/api/push/subscribe',{method:'POST',headers:{origin:'https://airly.test'},body:JSON.stringify(body)});
test('push rejects malformed keys, wrong curve points and quotas',async()=>{
 const body={endpoint:'https://fcm.googleapis.com/fcm/send/test',uid:1,lat:3,lon:101,keys:{p256dh:'invalid',auth:'invalid'}};
 assert.equal((await worker.fetch(pushRequest(body),pushEnv(),{})).status,400);
 body.keys={p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),auth:Buffer.alloc(16).toString('base64url')};
 assert.equal((await worker.fetch(pushRequest(body),pushEnv(),{})).status,400);
 const e=pushEnv();e.PUSH_LIMIT.limit=async()=>({success:false});assert.equal((await worker.fetch(pushRequest(body),e,{})).status,429);
});
test('push byte limit stops chunked input before buffering entire request',async()=>{
 let bytes=0,cancelled=false;const body=new ReadableStream({pull(c){bytes+=1024;c.enqueue(new Uint8Array(1024));},cancel(){cancelled=true}});
 const r=await worker.fetch(new Request('https://airly.test/api/push/subscribe',{method:'POST',headers:{origin:'https://airly.test'},body,duplex:'half'}),pushEnv(),{});
 assert.equal(r.status,413);assert.ok(bytes<=6144);assert.equal(cancelled,true);
 const multibyte=new TextEncoder().encode('界'.repeat(1500));const rr=await worker.fetch(new Request('https://airly.test/api/push/subscribe',{method:'POST',headers:{origin:'https://airly.test'},body:multibyte}),pushEnv(),{});assert.equal(rr.status,413);
});
test('cron follows empty incomplete KV pages and later pages',async()=>{
 let calls=0;const got=[],e=pushEnv();e.PUSH_SUBS={get:async key=>{got.push(key);return null},put:async()=>{},delete:async()=>{},list:async({cursor})=>{calls++;return cursor==='last'?{keys:[{name:'second'}],list_complete:true}:cursor==='empty'?{keys:[],list_complete:false,cursor:'last'}:{keys:[{name:'first'}],list_complete:false,cursor:'empty'}}};
 const jobs=[];await worker.scheduled({},e,{waitUntil:p=>jobs.push(p)});await Promise.all(jobs);assert.equal(calls,3);assert.ok(got.includes('second'));
});

test('valid subscriptions expire and renewing them preserves alert baseline',async()=>{
 const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const pub=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('base64url');
 const body={endpoint:'https://fcm.googleapis.com/fcm/send/test',uid:1,lat:3,lon:101,keys:{p256dh:pub,auth:Buffer.alloc(16,1).toString('base64url')}};
 const e=pushEnv();let saved,ttl;e.PUSH_SUBS.put=async(_key,value,options)=>{saved=JSON.parse(value);ttl=options.expirationTtl};
 assert.equal((await worker.fetch(pushRequest(body),e,{})).status,200);assert.equal(ttl,30*86400);assert.ok(saved.expiresAt>Date.now());
 saved.lastAqi=50;saved.lastSeen=Date.now()-3600000;saved.lastTime=saved.lastSeen;e.PUSH_SUBS.get=async()=>JSON.stringify(saved);
 assert.equal((await worker.fetch(pushRequest(body),e,{})).status,200);assert.equal(saved.lastAqi,50);assert.equal(ttl,30*86400);
});
test('scheduler detects slow change, retries rejected delivery, and does not extend consent',async()=>{
 const originalNow=Date.now,originalFetch=globalThis.fetch;let clock=Date.UTC(2026,9,12),aqi=50,attempts=0;
 const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',vapid.privateKey);
 const client=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 let rec={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:Buffer.from(await crypto.subtle.exportKey('raw',client.publicKey)).toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')},uid:1,index:'us',delta:25,lastAqi:160,lastTime:clock-3600000,lastSeen:clock-3600000,ts:clock,expiresAt:clock+30*86400000};
 const expires=rec.expiresAt,e={AQICN_TOKEN:'test',VAPID_PUBLIC_KEY:Buffer.from(await crypto.subtle.exportKey('raw',vapid.publicKey)).toString('base64url'),VAPID_PRIVATE_KEY:jwk.d,
  PUSH_SUBS:{list:async()=>({keys:[{name:'sub'}],list_complete:true}),get:async key=>key.startsWith('_meta:')?null:JSON.stringify(rec),put:async(_key,value)=>{rec=JSON.parse(value)},delete:async()=>{}}};
 Date.now=()=>clock;globalThis.fetch=async url=>{
  if(String(url).includes('api.waqi.info'))return Response.json({status:'ok',data:{idx:1,aqi,iaqi:{pm25:{v:aqi}},city:{name:'Test',geo:[3,101]},time:{iso:new Date(clock).toISOString()}}});
  attempts++;return new Response('',{status:attempts===1?503:201});
 };
 const cron=async()=>{const jobs=[];await worker.scheduled({},e,{waitUntil:p=>jobs.push(p)});await Promise.all(jobs)};
 try{
  for(const [hour,value]of [50,56,62,68,76].entries()){clock=Date.UTC(2026,9,12,hour);aqi=value;await cron()}
  assert.equal(attempts,1);assert.equal(rec.lastAqi,50);assert.equal(rec.lastSeen,clock);
  clock+=3600000;aqi=77;await cron();assert.equal(attempts,2);assert.equal(rec.lastAqi,77);assert.equal(rec.expiresAt,expires);
 }finally{Date.now=originalNow;globalThis.fetch=originalFetch}
});
