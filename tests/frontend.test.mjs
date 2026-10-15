import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import worker from '../worker.js';
const html=await (await worker.fetch(new Request('https://airly.test/'),{},{})).text();
const frontend=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const slice=(start,end)=>{const a=frontend.indexOf(start),b=frontend.indexOf(end,a);assert.ok(a>=0&&b>a);return frontend.slice(a,b)};
const elements=new Map();const el=q=>{if(!elements.has(q))elements.set(q,{textContent:'',hidden:false,disabled:false,style:{},classList:{toggle(){}},scrollTop:0,querySelector(){return null},addEventListener(){}});return elements.get(q)};
test('actual renderer exposes denied location with a selected city',()=>{
 const c=createContext({Number,Math,Date,document:{hidden:false},navigator:{onLine:true},$:el,t:x=>x,esc:String,icon:()=>'',connectionText:()=>'',indexLabel:()=>'',color:()=>'',mapHint:()=>'',updateMarkers(){},renderNearby(){},renderTrend(){}});
 runInContext(`let current=null,searchLocation={name:'Shah Alam',lat:3.1,lon:101.5},userLocation=null,locationError='locBlocked',geoBusy=false,loading=false,loadError='',activeView='now';`+slice('function render(){','async function loadReading('),c);
 runInContext('render()',c);assert.equal(el('#location-notice').hidden,false);
});
test('actual viewport handles northern/southern latitudes and antimeridian and replaces old snapshot',async()=>{
 const calls=[],c=createContext({Number,Math,Date,Map,AbortController,innerWidth:1200,document:{hidden:false},$:el,indexQuery:()=> '&index=us',stationKey:d=>d.uid,requestJSON:async url=>{calls.push(url);return []},updateMarkers(){},mapHint:()=>'',originPoint:()=>({lat:70,lon:20})});
 runInContext(`let latitude=70,longitude=20;let map={getBounds:()=>({getNorth:()=>latitude+.2,getSouth:()=>latitude-.2,getEast:()=>longitude+.2,getWest:()=>longitude-.2}),getCenter:()=>({lat:latitude,lng:longitude})},activeView='map',lastMapKey='',lastMapTime=0,mapSequence=0,mapController=null,current=null,userLocation=null,viewportHasSnapshot=false,viewportStations=[{uid:7}];`+slice('async function loadViewport(','function originPoint('),c);
 for(const lat of [70,-70]){runInContext(`latitude=${lat}`,c);await runInContext('loadViewport(true)',c);const box=new URL('https://airly.test'+calls.at(-1)).searchParams.get('bbox').split(',').map(Number);assert.ok(box[0]<lat&&box[2]>lat)}
 assert.equal(runInContext('viewportStations.length',c),0);
 runInContext('latitude=0;longitude=179.9',c);await runInContext('loadViewport(true)',c);assert.equal(calls.length,4);assert.match(calls.at(-1),/bbox=-0.2,-180,0.2,-179.9/);
});
test('area refresh replaces nearby snapshot without overwriting newer viewport',async()=>{
 let finish;const c=createContext({Number,Math,Date,Promise,$:el,indexQuery:()=>'',requestJSON:()=>new Promise(r=>finish=r),updateMarkers(){},renderNearby(){}});
 runInContext(`let areaSequence=0,locationSequence=1,lastAreaTime=0,stations=[{uid:2}],viewportStations=[{uid:9}],current=null,activeView='map';`+slice('async function loadArea(','async function useArea('),c);
 const pending=runInContext('loadArea({lat:3.1,lon:101.5},1)',c);finish([]);await pending;assert.equal(runInContext('stations.length',c),0);assert.equal(runInContext('viewportStations[0].uid',c),9);
});
test('mobile periodic refresh requests the area without a visible map',async()=>{
 const calls=[],c=createContext({document:{hidden:false},navigator:{onLine:true},innerWidth:375,loadReading:async()=>{},loadArea:async()=>calls.push('area'),originPoint:()=>({lat:3,lon:101}),indexQuery:()=>'',loadViewport:()=>assert.fail('Map not visible')});
 runInContext(`let loading=false,requestMode='search',selection=null,searchLocation={lat:3,lon:101},userLocation=null,map={},activeView='nearby',locationSequence=1;`+slice('async function refresh(','function scheduleRefresh('),c);
 await runInContext('refresh()',c);assert.deepEqual(calls,['area']);
});
test('foreground uses shared alert logic and preserves baseline after delivery failure',async()=>{
 let clock=Date.UTC(2026,9,12),delivered=0,canDeliver=false;
 const c=createContext({Date:{now:()=>clock,parse:Date.parse},settings:{browser:true,background:false,delta:25},baseline:new Map(),quality:()=> 'fresh',stationKey:d=>d.uid,notifyChange:async()=>{if(canDeliver)delivered++;return canDeliver}});
 runInContext(slice('const alertTransition=','let viewportStations=')+slice('async function checkAlert(','async function notifyChange('),c);
 for(const [hour,aqi]of [50,56,62,68,76].entries()){clock=Date.UTC(2026,9,12,hour);c.reading={uid:1,aqi,time:new Date(clock).toISOString()};await runInContext('checkAlert(reading)',c)}
 assert.equal(c.baseline.get(1).aqi,50);canDeliver=true;clock+=3600000;c.reading={uid:1,aqi:77,time:new Date(clock).toISOString()};await runInContext('checkAlert(reading)',c);assert.equal(delivered,1);assert.equal(c.baseline.get(1).aqi,77);
});
test('push opt-out waits for registration and fails if remote cleanup is unconfirmed',async()=>{
 let removed=0,unsubscribed=0,finish;const c=createContext({JSON,Promise,setTimeout,clearTimeout,storage:{get:()=>null,set(){}},navigator:{serviceWorker:{ready:new Promise(r=>finish=r)}},fetch:async()=>{removed++;return Response.json({ok:true})}});
 runInContext(`let serviceRegistration=null;`+slice('async function getPushRegistration(','let searchTimer;'),c);
 const pending=runInContext('disablePush()',c);assert.equal(removed,0);finish({pushManager:{getSubscription:async()=>({endpoint:'https://fcm.googleapis.com/test',unsubscribe:async()=>{unsubscribed++;return true}})}});await pending;assert.equal(removed,1);assert.equal(unsubscribed,1);
 c.fetch=async()=>Response.json({fallback:true});await assert.rejects(runInContext('disablePush()',c),/Could not remove subscription/);assert.equal(unsubscribed,1);
});
test('GPS news uses country-wide coverage and no guessed IP city',()=>{
 const c=createContext({URLSearchParams,settings:{locale:'AUTO'},searchLocation:null,userLocation:{source:'gps',country:'MY'}});
 runInContext(slice('function newsQuery(','async function loadNews('),c);assert.equal(runInContext('newsQuery()',c),'locale=MY&location=resolved');
});
test('HTML starts dashboard independently of map loading',()=>{
 assert.doesNotMatch(html,/<script src="\/vendor\/leaflet.js"/);assert.match(frontend,/script.async=true/);assert.match(frontend,/loading=true;render\(\);loadMap\(\)/);
});
