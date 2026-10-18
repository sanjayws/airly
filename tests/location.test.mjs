import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import worker from '../worker.js';
const html=await (await worker.fetch(new Request('https://airly.test/'),{},{})).text();
const frontend=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const slice=(start,end)=>frontend.slice(frontend.indexOf(start),frontend.indexOf(end,frontend.indexOf(start)));
function harness(){
 const calls=[],saved=new Map();let position;
 const context=createContext({Promise,Number,Date,Math,console,encodeURIComponent,clearTimeout,
 navigator:{onLine:true,geolocation:{getCurrentPosition(success,failure,options){position={success,failure,options}}},permissions:{query:async()=>({state:'granted'})}},
 document:{hidden:false},innerWidth:1200,
 storage:{get:key=>saved.get(key),set(key,value){saved.set(key,value);return true}},
 t:key=>key,render(){},drawUser(){},centreMap(){},loadViewport(){},
 loadArea(){},loadReading:async query=>{calls.push(query)},
 requestJSON:async path=>path.includes('?lat=')?{country:'MY'}:({lat:5.41123,lon:100.33543,city:'George Town',region:'Penang',country:'MY'})
 });
 runInContext(`let viewportStations=[],viewportHasSnapshot=false,lastAreaTime=0,activeView='now',newsSeq=0,newsController=null,newsCache=null,newsTime=0,newsLocale='';let detailSequence=0,areaSequence=0,detailController=null,refreshTimer=null,loading=false;let locationIntent=0,locationError='',geoBusy=false,locationSequence=0,mapSequence=0,mapController=null,map=null,lastMapKey='',selection=null,requestMode='home',loadError='',current=null,stations=[],userLocation=null,searchLocation=null;let settings={index:'auto'};const validPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;`+slice('const indexQuery=','const mapHint=')+slice('function originPoint(', 'async function loadArea(')+slice('async function useArea(', 'function renderNearby(')+slice('async function refresh(', 'function scheduleRefresh('),context);
 return {context,calls,saved,run:code=>runInContext(code,context),position:()=>position};
}
const gps=(lat=3.0738,lon=101.5183)=>({coords:{latitude:lat,longitude:lon,accuracy:12}});
test('fresh GPS replaces Penang IP coordinates and does not inherit IP country',async()=>{
 const h=harness();await h.run('ipLocate()');assert.match(h.calls[0],/lat=5.41123/);
 const pending=h.run('locate()');assert.equal(h.position().options.maximumAge,0);assert.equal(h.position().options.enableHighAccuracy,true);
 await h.position().success(gps());await pending;
 assert.match(h.calls.at(-1),/lat=3.0738&lon=101.5183&index=auto&country=MY$/);assert.equal(h.run('userLocation.source'),'gps');assert.equal(h.run('userLocation.country'),'MY');
});
test('home refresh reacquires device position instead of pinning the Penang station',async()=>{
 const h=harness();await h.run('ipLocate()');h.run("selection={uid:'my:PENANG'}");
 const pending=h.run('refresh(true)');await h.position().success(gps());await pending;
 assert.match(h.calls.at(-1),/^lat=3.0738/);assert.ok(!h.calls.some(x=>x.includes('uid=')));
});
test('station refresh keeps explicit station; selected city refresh uses its coordinates',async()=>{
 const h=harness();h.run("requestMode='station';selection={uid:'my:PENANG'}");await h.run('refresh(true)');assert.equal(h.calls.at(-1),'uid=my:PENANG');
 await h.run("useArea({lat:3.0738,lon:101.5183,name:'Shah Alam',country:'MY'},'search')");await h.run('refresh(true)');assert.match(h.calls.at(-1),/^lat=3.0738/);assert.equal(h.saved.has('airly-city'),false);assert.equal(h.run('searchLocation.name'),'Shah Alam');
});
test('a delayed IP response cannot overwrite an explicit city selection',async()=>{
 const h=harness();let finish;h.context.requestJSON=()=>new Promise(resolve=>finish=resolve);
 const pending=h.run('ipLocate()');await h.run("useArea({lat:3.0738,lon:101.5183,name:'Shah Alam',country:'MY'},'search')");finish({lat:5.4,lon:100.3,city:'Penang'});await pending;
 assert.equal(h.run('searchLocation.name'),'Shah Alam');assert.equal(h.run('userLocation'),null);
});
test('background location sequence changes cannot discard a requested GPS result',async()=>{
 const h=harness();const pending=h.run('locate()');h.run('locationSequence+=10');await h.position().success(gps());await pending;assert.equal(h.run('userLocation.source'),'gps');
});
test('blocked location produces explicit warning and approximate fallback',async()=>{
 const h=harness();const pending=h.run('locate()');await h.position().failure({code:1});await pending;
 assert.equal(h.run('locationError'),'locBlocked');assert.equal(h.run('userLocation.source'),'ip');assert.equal(h.run('geoBusy'),false);
});
test('startup ignores a saved city and preserves other settings',async()=>{
 const h=harness();h.saved.set('airly-city',{lat:5.4,lon:100.3,name:'Penang',country:'MY'});
 const preferences={lang:'ms',index:'us',delta:50,browser:true,sensitive:true};h.saved.set('airly-settings',preferences);
 const pending=h.run('initializeLocation()');await new Promise(setImmediate);await h.position().success(gps());await pending;
 assert.equal(h.run('searchLocation'),null);assert.equal(h.run('userLocation.lat'),3.0738);assert.equal(h.run('requestMode'),'home');
 assert.equal(h.saved.get('airly-city'),null);assert.deepEqual(h.saved.get('airly-settings'),preferences);
});
test('returning to Airly resets a city selection and reacquires device coordinates',async()=>{
 const h=harness();await h.run("useArea({lat:5.4,lon:100.3,name:'Penang'},'search')");
 const pending=h.run('initializeLocation()');assert.equal(h.run('searchLocation'),null);await new Promise(setImmediate);
 await h.position().success(gps());await pending;assert.match(h.calls.at(-1),/^lat=3.0738/);
});
test('denied device location cannot restore the previous city',async()=>{
 const h=harness();await h.run("useArea({lat:3.1,lon:101.5,name:'Old city'},'search')");
 h.context.navigator.permissions.query=async()=>({state:'denied'});await h.run('initializeLocation()');
 assert.equal(h.run('searchLocation'),null);assert.equal(h.run('userLocation.source'),'ip');assert.equal(h.run('locationError'),'locBlocked');
});
test('duplicate resume events share a pending device request and cannot erase a new selection',async()=>{
 const h=harness();let finish;h.context.navigator.permissions.query=()=>new Promise(r=>finish=r);
 const pending=h.run('initializeLocation()');await h.run('initializeLocation()');
 await h.run("useArea({lat:3.1,lon:101.5,name:'Chosen now'},'search')");finish({state:'granted'});await pending;
 assert.equal(h.run('searchLocation.name'),'Chosen now');assert.equal(h.position(),undefined);
});
test('successful GPS clears saved city; timeout preserves last area with explanation',async()=>{
 const h=harness();h.saved.set('airly-city',{name:'Penang'});const first=h.run('locate()');await h.position().success(gps());await first;assert.equal(h.saved.get('airly-city'),null);
 const second=h.run('locate()');await h.position().failure({code:3});assert.equal(h.position().options.enableHighAccuracy,false);await h.position().failure({code:3});await second;assert.equal(h.run('locationError'),'geoTimeout');assert.equal(h.run('userLocation.lat'),3.0738);
});
test('precise fix timing out falls back to the coarse browser fix before IP',async()=>{
 const h=harness();const first=h.run('locate()');await h.position().failure({code:2});
 assert.equal(h.position().options.enableHighAccuracy,false);await h.position().success(gps());await first;
 assert.equal(h.run('userLocation.source'),'gps');assert.equal(h.run('userLocation.lat'),3.0738);
});
test('denied permission skips the coarse retry',async()=>{
 const h=harness();const first=h.run('locate()');const before=h.position();await before.failure({code:1});await first;
 assert.equal(h.position().options.enableHighAccuracy,true);assert.equal(h.run('locationError'),'locBlocked');
});
