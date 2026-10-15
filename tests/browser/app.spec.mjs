import {test,expect} from '@playwright/test';
import worker from '../../worker.js';

test.beforeEach(async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.errors=errors;
 await page.addInitScript(()=>{
  navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:3.0738,longitude:101.5183,accuracy:12}});
 });
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 await page.route('https://airly.test/**',async route=>{
  const r=route.request(),url=r.url(),p=new URL(url);
  if(p.pathname==='/api/air'){
   const station={uid:'my:SHAH',index:'my',name:'Shah Alam, SELANGOR',lat:3.10475,lon:101.556192,aqi:76,time:new Date().toISOString(),dominant:'PM2.5',pollutants:{},attribution:[]};
   const old={...station,uid:'my:OLD',name:'Old nearby station',aqi:120,lat:3.2,time:'2020-01-01T00:00:00Z'};
   await route.fulfill({json:p.searchParams.has('scope')?[station,old]:station});return;
  }
  if(p.pathname==='/api/news'){await route.fulfill({json:[]});return}
  const req=Object.assign(new Request(url,{method:r.method(),headers:r.headers(),...(r.postData()?{body:r.postData()}:{})}),{cf:{country:'SG',city:'George Town',region:'Penang',latitude:'5.4',longitude:'100.3'}});
  const response=await worker.fetch(req,{},{});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
});
test.afterEach(async({page})=>expect(page.errors).toEqual([]));

test('GPS resolves country and renders dashboard despite wrong IP',async({page})=>{
 const queries=[];page.on('request',r=>{if(r.url().includes('/api/air?'))queries.push(r.url())});
 await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toHaveText('Shah Alam, SELANGOR');
 expect(await page.evaluate(()=>userLocation.country)).toBe('MY');expect(queries.some(q=>q.includes('lat=3.0738')&&q.includes('country=MY'))).toBe(true);
 await expect(page.locator('#location-notice')).toBeHidden();
});
test('dashboard works while map asset is unavailable',async({page})=>{
 await page.route('**/vendor/leaflet.js',route=>route.abort());await page.goto('https://airly.test/');
 await expect(page.locator('.station-name')).toBeVisible();await expect(page.locator('#map-retry')).toBeAttached();
 await page.locator('#open-settings').click();await expect(page.locator('#modal')).toBeVisible();
});
test('saved city is ignored and denied GPS is clearly explained',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('airly-city',JSON.stringify({name:'Shah Alam',country:'MY',lat:3.0738,lon:101.5183}));
  navigator.geolocation.getCurrentPosition=(_success,failure)=>failure({code:1});
 });
 await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toBeVisible();expect(await page.evaluate(()=>searchLocation)).toBeNull();await page.locator('#location').click();
 await expect(page.locator('#location-notice')).toBeVisible();await expect(page.locator('#location-explanation')).toContainText('blocked');
 await page.locator('#open-settings').click();expect(await page.locator('#location-notice').evaluate(e=>e.inert)).toBe(true);
 await page.locator('#close').click();expect(await page.locator('#location-notice').evaluate(e=>e.inert)).toBe(false);
});
test('mobile Nearby refresh replaces removed stations and labels stale readings',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toBeVisible();
 await page.locator('#tab-nearby').click();await expect(page.locator('#nearby .row')).toHaveCount(2);
 await expect(page.locator('#nearby')).toContainText('Older station reading');
 await page.route('**/api/air?scope=area&lat=*',route=>route.fulfill({json:[]}));
 await page.evaluate(()=>refresh());await expect(page.locator('#nearby .row')).toHaveCount(1); // authoritative current station survives
 expect(await page.evaluate(()=>stations.length)).toBe(1);
});
test('independent map snapshots cannot be overwritten by delayed area responses',async({page})=>{
 await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>!!map)).toBe(true);
 await page.evaluate(async()=>{
  let finish;const original=requestJSON;requestJSON=()=>new Promise(resolve=>finish=resolve);
  const pending=loadArea(originPoint(),locationSequence);
  viewportStations=[{uid:999,index:'us',name:'New viewport',aqi:90,lat:3.1,lon:101.5}];viewportHasSnapshot=true;
  finish([{uid:1,index:'us',name:'Old area',aqi:50,lat:3.2,lon:101.6}]);await pending;requestJSON=original;
 });
 expect(await page.evaluate(()=>viewportStations[0].name)).toBe('New viewport');
});
test('high latitude and antimeridian viewport requests cover the visible map',async({page})=>{
 // Finish the initial GPS centering before deliberately moving the map.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('https://airly.test/');await expect.poll(()=>page.evaluate(()=>!!map&&!locationStarting&&!!current?.detail)).toBe(true);
 const urls=await page.evaluate(async()=>{
  const calls=[],original=requestJSON;requestJSON=async path=>{calls.push(path);return []};
  map.setView([70,20],10,{animate:false});await loadViewport(true);
  map.setView([0,179.9],5,{animate:false});await loadViewport(true);requestJSON=original;return calls;
 });
 const boxes=urls.map(u=>new URL('https://airly.test'+u).searchParams.get('bbox').split(',').map(Number));
 expect(boxes.some(b=>b[0]<70&&b[2]>70)).toBe(true);
 expect(boxes.some(b=>b[1]===-180)).toBe(true);expect(boxes.some(b=>b[3]===180)).toBe(true);
});
test('GPS news avoids IP city and reloads when accepted location changes',async({page})=>{
 const calls=[];page.on('request',r=>{if(r.url().includes('/api/news?'))calls.push(r.url())});
 await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toBeVisible();await page.locator('#tab-news').click();
 await expect.poll(()=>calls.length).toBe(1);expect(calls[0]).toContain('locale=MY');expect(calls[0]).toContain('location=resolved');expect(calls[0]).not.toContain('George');
 await page.evaluate(()=>useArea({lat:1.3521,lon:103.8198,country:'SG',name:'Singapore'},'search'));
 await expect.poll(()=>calls.length).toBe(2);expect(calls[1]).toContain('locale=SG');
});
test('push opt-out waits for registration and confirms remote deletion',async({page})=>{
 await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toBeVisible();
 await page.route('**/api/push/unsubscribe',route=>route.fulfill({json:{ok:true}}));
 const result=await page.evaluate(async()=>{
  let unsubscribed=false;const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',unsubscribe:async()=>{unsubscribed=true;return true}};
  serviceRegistration=null;Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:new Promise(resolve=>setTimeout(()=>resolve({pushManager:{getSubscription:async()=>subscription}}),100))}});
  await disablePush();return unsubscribed;
 });expect(result).toBe(true);
});
test('push update failure preserves existing enabled setting',async({page})=>{
 await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toBeVisible();
 await page.evaluate(()=>{
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted'}});
  settings.background=true;settings.browser=true;backgroundReady=true;serviceRegistration={pushManager:{getSubscription:async()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test'})})}};
 });
 await page.route('**/api/push/key',route=>route.fulfill({json:{key:'BA'}}));await page.route('**/api/push/subscribe',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
 await page.locator('#open-settings').click();await page.locator('#save').click();await expect(page.locator('#toast')).toBeVisible();
 expect(await page.evaluate(()=>settings.background)).toBe(true);await expect(page.locator('#modal')).toBeVisible();
});
test('mobile settings and measurement time stay readable in all languages',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('https://airly.test/');await expect(page.locator('.station-name')).toBeVisible();
 for(const lang of ['ms','ta','zh','en']){await page.locator('#lang').selectOption(lang);await expect(page.locator('html')).toHaveAttribute('lang',lang);expect(await page.locator('#open-settings').getAttribute('aria-label')).toBeTruthy()}
 expect(await page.locator('#connection').evaluate(e=>getComputedStyle(e).whiteSpace)).toBe('nowrap');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('reload and return to app reset location but retain other preferences',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('airly-city',JSON.stringify({name:'Penang',country:'MY',lat:5.4,lon:100.3}));
  localStorage.setItem('airly-settings',JSON.stringify({lang:'zh',index:'us',delta:50,sensitive:true}));
 });
 await page.goto('https://airly.test/');await expect.poll(()=>page.evaluate(()=>locationStarting)).toBe(false);
 expect(await page.evaluate(()=>searchLocation)).toBeNull();
 const city={name:'Penang',country:'MY',lat:5.4,lon:100.3};
 await page.evaluate(p=>useArea(p,'search'),city);expect(await page.evaluate(()=>requestMode)).toBe('search');
 expect(await page.evaluate(()=>storage.get('airly-city'))).toBeNull();
 await page.reload();await expect.poll(()=>page.evaluate(()=>userLocation?.source)).toBe('gps');
 expect(await page.evaluate(()=>searchLocation)).toBeNull();
 await expect.poll(()=>page.evaluate(()=>locationStarting)).toBe(false);
 await page.evaluate(p=>useArea(p,'search'),city);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await expect.poll(()=>page.evaluate(()=>userLocation?.source)).toBe('gps');
 expect(await page.evaluate(()=>searchLocation)).toBeNull();
 expect(await page.evaluate(()=>({lang:settings.lang,index:settings.index,delta:settings.delta,sensitive:settings.sensitive}))).toEqual({lang:'zh',index:'us',delta:50,sensitive:true});
});
