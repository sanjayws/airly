import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'airly',modules:true,scriptPath:'dist/worker.js',compatibilityDate:'2026-08-01',
  kvNamespaces:['PUSH_SUBS'],bindings:{VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test'},
  ratelimits:{PUSH_LIMIT:{namespace_id:'912632601',simple:{limit:10,period:60}},PUSH_BUDGET:{namespace_id:'912632602',simple:{limit:100,period:60}}}
}]}));
try{
 const r=await mf.dispatchFetch('https://airly.test/api/location?lat=3.0738&lon=101.5183');assert.equal((await r.json()).country,'MY');
 assert.equal((await mf.dispatchFetch('https://airly.test/api/advice')).status,410);
 assert.equal((await mf.dispatchFetch('https://airly.test/vendor/leaflet.js')).status,200);
 const kv=await mf.getKVNamespace('PUSH_SUBS');await kv.put('audit-check','value',{expirationTtl:60});assert.equal(await kv.get('audit-check'),'value');await kv.delete('audit-check');
 const p=await mf.dispatchFetch('https://airly.test/api/push/subscribe',{method:'POST',headers:{origin:'https://airly.test'},body:JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'invalid',auth:'invalid'},uid:1,lat:3,lon:101})});assert.equal(p.status,400);
 console.log('Worker runtime: coordinate resolution, retired AI, vendor assets, KV and push validation passed.');
}finally{await mf.dispose()}
