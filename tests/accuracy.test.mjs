import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import worker from '../worker.js';
import {normalizeWaqi,waqiIndex,measurementTime} from '../lib/air-quality.js';

// Observed Shah Alam mismatch, 2026-10-14 21:00 MYT. The provider headline
// matched DOE API 175 while the documented PM2.5 AQI sub-index was 235.
const feed=()=>({idx:2621,aqi:175,city:{name:'Shah Alam',geo:[3.104717,101.556222]},
 time:{iso:'2026-10-14T21:00:00+08:00'},iaqi:{pm25:{v:235},pm10:{v:125},o3:{v:9.3},no2:{v:20.8},so2:{v:4.1},co:{v:0.1},p:{v:1010},h:{v:74},w:{v:0.5},t:{v:29}}});
const req=path=>new Request('https://airly.test'+path);
const withFetch=async(fn,body)=>{const original=globalThis.fetch;globalThis.fetch=fn;try{await body()}finally{globalThis.fetch=original}};
test('Shah Alam headline API is never relabeled or scalar-converted to US AQI',()=>{
 const r=normalizeWaqi(feed());assert.equal(r.aqi,235);assert.equal(r.reportedIndex,175);assert.equal(r.dominant,'pm25');assert.equal(r.index,'us');
 assert.equal(r.pm25,235);assert.equal(r.units.pollutants,'US AQI sub-index');assert.equal(r.humidity,74);assert.equal(r.wind,.5);
 const d=feed();d.aqi=160;assert.equal(normalizeWaqi(d).aqi,235);
 d.aqi=999;assert.equal(normalizeWaqi(d).aqi,235);
});
test('maximum uses only measured pollutant sub-indices; missing data is not zero',()=>{
 const d=feed();d.iaqi.o3.v=260;assert.equal(waqiIndex(d).aqi,260);assert.equal(waqiIndex(d).dominant,'o3');
 for(const value of [null,undefined,'',' ','-',false,-1,Infinity,NaN]){
  assert.equal(waqiIndex({aqi:160,iaqi:{pm25:{v:value},h:{v:90}}}).aqi,null);
 }
 assert.equal(waqiIndex({iaqi:{pm25:{v:'0'}}}).aqi,0);
 assert.equal(waqiIndex({iaqi:{co:{v:50.6}}}).aqi,51);
 assert.throws(()=>normalizeWaqi({...feed(),iaqi:{h:{v:80}}}),/No pollutant/);
 assert.equal(waqiIndex({aqi:160,iaqi:{co:{v:0}}}).aqi,null);
 assert.equal(waqiIndex({aqi:60,dominentpol:'pm25',iaqi:{pm10:{v:70}}}).aqi,null);
});
test('station identity and position are required and explicit UID must match',()=>{
 for(const change of [{idx:2620},{idx:0},{city:{geo:[null,101]}},{city:{geo:[91,101]}},{city:{geo:[3,181]}}])assert.throws(()=>normalizeWaqi({...feed(),...change},2621),/identity/);
});
test('measurement times require an explicit timezone and real calendar date',()=>{
 assert.equal(measurementTime({s:'2026-10-14 21:00:00',tz:'+08:00'}),'2026-10-14T21:00:00+08:00');
 for(const iso of ['2026-10-14 21:00:00','2026-10-14T21:00:00','2026-02-30T12:00:00Z','garbage'])assert.equal(measurementTime({iso}),null);
});
test('forecast rejects impossible dates and ranges, deduplicates and preserves AQI units',()=>{
 const d=feed();d.forecast={daily:{pm25:[{day:'2026-10-15',avg:50,min:40,max:60},{day:'2026-10-15',avg:55,min:40,max:60},{day:'2026-02-30',avg:50},{day:'2026-10-16',avg:50,min:70,max:40},{day:'2026-10-17',avg:null}]}};
 const r=normalizeWaqi(d);assert.equal(r.forecast.length,1);assert.equal(r.forecast[0].avg,55);assert.equal(r.units.forecast,'PM2.5 AQI');
});
test('detail route uses pollutant maximum and fails closed without usable sub-indices',async()=>withFetch(async()=>Response.json({status:'ok',data:feed()}),async()=>{
 let r=await worker.fetch(req('/api/air?uid=2621'),{AQICN_TOKEN:'test'},{});assert.equal(r.status,200);assert.equal((await r.json()).aqi,235);
 globalThis.fetch=async()=>Response.json({status:'ok',data:{...feed(),iaqi:{}}});
 r=await worker.fetch(req('/api/air?uid=2621'),{AQICN_TOKEN:'test'},{});assert.equal(r.status,502);
}));
test('bounds readings use bounded detail lookup; ambiguous or failed summaries remain neutral',async()=>{
 let details=0;
 await withFetch(async url=>{
  if(String(url).includes('/map/bounds'))return Response.json({status:'ok',data:Array.from({length:20},(_,i)=>({uid:2621+i,aqi:175,lat:3.104717+i*.001,lon:101.556222,station:{name:'Station',time:'2026-10-14 21:00:00'}}))});
  details++;const uid=+String(url).match(/@(\d+)/)[1];if(uid===2622)throw Error('outage');return Response.json({status:'ok',data:{...feed(),idx:uid}});
 },async()=>{
  const r=await worker.fetch(req('/api/air?index=us&scope=area&bbox=3,101.4,3.2,101.7'),{AQICN_TOKEN:'test'},{}),list=await r.json();
  assert.equal(r.status,200);assert.equal(details,12);assert.equal(list.length,20);
  assert.equal(list.find(s=>s.uid===2621).aqi,235);assert.equal(list.find(s=>s.uid===2622).aqi,null);
  for(const s of list){assert.notEqual(s.aqi,175);if(s.aqi===null)assert.equal(s.time,null)}
 });
});
test('DOE API 160 remains official API 160, with local observation time',async()=>withFetch(async()=>Response.json({features:[{attributes:{STATION_ID:'CA20B',STATION_LOCATION:'Shah Alam',API:160,LATITUDE:3.10475,LONGITUDE:101.556192,PARAM_SELECTED:'PM2.5',DATETIME:Date.UTC(2026,9,14,21)}}]}),async()=>{
 const r=await worker.fetch(req('/api/air?lat=3.0738&lon=101.5183&index=auto'),{},{}),d=await r.json();
 assert.equal(d.aqi,160);assert.equal(d.index,'my');assert.equal(d.calculation,'doe-official-api');assert.equal(d.time,'2026-10-14T21:00:00.000+08:00');assert.equal(d.pm25,null);assert.deepEqual(d.forecast,[]);
}));
const html=await(await worker.fetch(req('/'),{},{})).text();
const js=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
test('actual frontend distinguishes every Malaysia/US health category boundary',()=>{
 const c=createContext({});runInContext(js.slice(js.indexOf('const band='),js.indexOf('const color=')),c);
 for(const [value,my,us]of [[0,0,0],[50,0,0],[51,1,1],[100,1,1],[101,3,2],[150,3,2],[151,3,3],[160,3,3],[200,3,3],[201,4,4],[300,4,4],[301,5,5],[500,5,5]]){
  assert.equal(runInContext(`band(${value},'my')`,c),my);assert.equal(runInContext(`band(${value},'us')`,c),us);
 }
 assert.equal(runInContext('band(null)',c),-1);
});
test('actual frontend treats missing, future and old measurement timestamps honestly',()=>{
 const c=createContext({});runInContext(js.slice(js.indexOf('const quality='),js.indexOf('const haversine=')),c);
 c.d={aqi:null,time:new Date().toISOString()};assert.equal(runInContext('quality(d)',c),'unknown');
 for(const [offset,expected]of [[0,'fresh'],[-4*3600000,'stale'],[3600000,'unknown']]){c.d={aqi:160,time:new Date(Date.now()+offset).toISOString()};assert.equal(runInContext('quality(d)',c),expected)}
 assert.match(html,/not converted from Malaysia API/);
});
test('Malaysia guidance uses DOE categories rather than US activity advice',()=>{
 const c=createContext({t:x=>x,settings:{sensitive:false},lang:'en'});
 runInContext(js.slice(js.indexOf('const band='),js.indexOf('const color='))+js.slice(js.indexOf('function advice('),js.indexOf('function connectionText(')),c);
 assert.equal(runInContext("advice(101,'my')[1]",c),'myAdvice3');
 assert.equal(runInContext("advice(101,'us')[1]",c),'adv2B');
 assert.equal(runInContext("advice(75,'my')[1]",c),'myAdvice1');
});
test('neutral map pins remain selectable and selected detail replaces a summary',()=>{
 const icons=[];const c=createContext({Number,Set,Map,esc:String,t:x=>x,indexLabel:()=> 'US AQI',haversine:()=>0,quality:()=> 'unknown',ageText:()=>'',color:a=>a===null?'grey':'red',selectStation(){},lang:'en',
 L:{divIcon:x=>x,marker:()=>({addTo(){return this},on(){},setLatLng(){return this},setIcon(x){icons.push(x.html);return this},setZIndexOffset(){return this},unbindTooltip(){return this},bindTooltip(){return this}})}});
 runInContext(`let map={getCenter:()=>({lat:3,lng:101}),getBounds:()=>({pad:()=>({contains:()=>true})}),removeLayer(){}},markers=new Map(),viewportHasSnapshot=true,viewportStations=[{uid:1,lat:3,lon:101,aqi:null},{uid:2,lat:3,lon:101,aqi:null}],stations=[],current={uid:1,lat:3,lon:101,aqi:235,index:'us'};`+js.slice(js.indexOf('function updateMarkers(){'),js.indexOf('async function loadViewport(')),c);
 runInContext('updateMarkers()',c);assert.equal(runInContext('markers.size',c),2);assert.ok(icons.some(x=>x.includes('235')));assert.ok(icons.some(x=>x.includes('grey')&&x.includes('—')));
});
test('nearby renders unknown summary as a dash, not zero or a health category',()=>{
 const element={innerHTML:''},c=createContext({Number,originPoint:()=>({}),haversine:()=>1,distanceText:()=> '1 km',color:()=> 'grey',esc:String,t:x=>x,indexLabel:()=> 'US AQI',icon:()=>'',quality:()=> 'unknown',ageText:()=>'',band:()=>-1,$:()=>element,$$:()=>[]});
 runInContext(`let stations=[{uid:1,lat:3,lon:101,aqi:null,name:'Station'}];`+js.slice(js.indexOf('function renderNearby(){'),js.indexOf('let newsCache=')),c);
 runInContext('renderNearby()',c);assert.match(element.innerHTML,/—/);assert.match(element.innerHTML,/checkReading/);assert.doesNotMatch(element.innerHTML,/null|lvl-1/);
});
