// Dashboard source; Wrangler emits it in the worker.js bundle.
export const HTML_SOURCE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#fffefa"><title>Airly by Ordinexis — Air quality near you</title><link rel="preload" as="style" href="/vendor/leaflet.css" onload="this.rel='stylesheet'">
<style>
:root{--ink:#173e33;--muted:#65756e;--paper:#fffefa;--base:#edf1ea;--line:#dce5db;--green:#28664e;--soft:#e8f0e5;--nav:76px;color-scheme:light}
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:var(--ink);background:var(--base);-webkit-text-size-adjust:100%}button,input,select{font:inherit}button,a,input,select{-webkit-tap-highlight-color:transparent}button{cursor:pointer;touch-action:manipulation;color:inherit}button:disabled{cursor:default;opacity:.55}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #257bc2;outline-offset:3px}a{color:var(--green);text-underline-offset:3px}svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.hidden,[hidden]{display:none!important}
.app{height:100vh;height:100dvh;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}.top{display:grid;grid-template-columns:1fr minmax(240px,380px) 1fr;align-items:center;gap:24px;padding:20px 30px;background:var(--paper);border-bottom:1px solid var(--line);z-index:20}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-size:30px;font-weight:750;letter-spacing:-1.4px}.brand img{width:34px;height:34px}.brand small{font-size:11px;font-weight:450;letter-spacing:0;color:var(--muted);border-left:1px solid var(--line);padding-left:12px;margin-left:4px}.actions{grid-column:3;grid-row:1;justify-self:end;display:flex;align-items:center;gap:8px}.icon-button,.round{height:44px;min-width:44px;border:1px solid var(--line);border-radius:12px;background:var(--paper);display:inline-flex;align-items:center;justify-content:center;padding:10px}.icon-button:hover,.round:hover{background:var(--soft)}.actions select{max-width:90px;padding:0 10px;font-size:13px}.locationbar{grid-column:2;grid-row:1;display:flex;gap:12px;align-items:center;min-width:0}.locationbar .place{display:flex;align-items:center;gap:12px;text-align:left;min-width:0;flex:1;background:transparent;border:0;padding:0;min-height:44px}.place>span:first-child{display:grid;place-items:center;background:var(--soft);color:var(--green);border-radius:50%;width:38px;height:38px;flex-shrink:0}.place-copy{display:block;min-width:0}.place-copy b,.place-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.place-copy b{font-size:13px;font-weight:650}.place-copy small{font-size:11px;color:var(--muted);margin-top:1px}.connection{font-size:10px;color:var(--muted);white-space:nowrap;flex-shrink:0}.locationbar .refresh{border:0;background:transparent;min-width:32px;width:32px;height:40px;padding:5px}
.location-notice{margin:16px 24px 0;padding:12px 16px;display:flex;align-items:center;gap:12px;border:1px solid #d6dfc7;border-radius:14px;background:#f8faed;font-size:12px;color:#465636}.location-notice>span{display:flex;flex-shrink:0}.location-notice p{margin:0;flex:1;max-width:780px}.location-notice>div{display:flex;gap:8px;margin-left:auto;flex-shrink:0}.primary,.secondary{min-height:44px;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:650}.primary{background:var(--ink);color:white;border:1px solid var(--ink)}.primary:hover{background:#265e49}.secondary{background:transparent;color:var(--ink);border:1px solid #cbd6bf}.secondary:hover{background:var(--soft)}
.workspace{grid-row:3;min-height:0;display:grid;grid-template-columns:440px minmax(0,1fr);gap:20px;padding:20px 24px 24px;position:relative}.card{grid-column:1;grid-row:1;min-width:0;min-height:0;overflow:auto;background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:84px 24px 24px;scrollbar-width:thin;overscroll-behavior:contain}.tabs{display:flex;position:absolute;top:32px;left:36px;width:416px;gap:4px;padding:5px;background:#edf2e9;border:1px solid #e3eadd;border-radius:12px;z-index:10}.tabs button{flex:1;min-width:0;border:0;border-radius:8px;padding:9px 5px;min-height:42px;background:transparent;font-size:12px;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:5px}.tabs button svg{display:none}.tabs button[aria-selected=true]{background:var(--paper);color:var(--ink);font-weight:700;box-shadow:0 1px 4px #18352212}.tabs [data-tab=map]{display:none}.map-wrap{grid-column:2;grid-row:1;position:relative;min-width:0;min-height:0;background:#dae4d7;border:1px solid #d1ddce;border-radius:20px;overflow:hidden;isolation:isolate}.map{position:absolute;inset:0;z-index:1}.map-title{position:absolute;top:20px;left:20px;z-index:800;background:#fffefaf2;padding:18px 22px;border:1px solid #e2e8db;border-radius:14px;box-shadow:0 4px 16px #1835220a;max-width:calc(100% - 100px);pointer-events:none}.map-title h2{font-size:28px;line-height:1.1;font-weight:600;letter-spacing:-1px;margin:7px 0}.map-title p{font-size:12px;color:var(--muted);margin:0}.map-controls{position:absolute;top:20px;right:20px;z-index:800}.map-controls button{box-shadow:0 4px 16px #1835220a}.map-hint{position:absolute;z-index:800;bottom:32px;left:76px;right:16px;pointer-events:none;font-size:11px}.map-hint span{background:#fffefaf5;padding:9px 13px;display:inline-block;border:1px solid var(--line);border-radius:8px;box-shadow:0 2px 10px #18352208}.map-status{background:var(--paper);padding:20px;color:var(--muted)}
.reading-hero{padding:20px 20px 0;margin:0 -4px 24px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(145deg,#f5f8ef,var(--paper));overflow:hidden}.live{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted);margin:0 0 24px}.status-dot{width:7px;height:7px;border-radius:100%;background:#78877d;flex-shrink:0}.live[data-quality=fresh] .status-dot{background:#327657;box-shadow:0 0 0 4px #32765712}.live[data-quality=stale] .status-dot{background:#b77916}.eyebrow{font-size:10px;font-weight:650;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 6px}.station-name{font-size:23px;line-height:1.25;font-weight:650;letter-spacing:-.7px;margin:0;overflow-wrap:anywhere}.distance{font-size:11px;color:var(--muted);margin:8px 0 20px}.score{display:flex;gap:22px;align-items:center;margin:24px 0 30px}.score strong{font-size:100px;letter-spacing:-6px;line-height:1;font-weight:600;font-variant-numeric:tabular-nums}.score span{font-size:11px;color:var(--muted)}.score b{display:block;font-size:19px;line-height:1.25;max-width:165px;color:var(--ink);font-weight:600;margin-bottom:6px}.aqi-scale{display:grid;gap:4px;margin:0 -20px}.aqi-scale i{height:5px;opacity:.22}.aqi-scale i.active{opacity:1;height:8px;margin-top:-3px}.advice{border-left:3px solid var(--green);padding:2px 0 2px 15px;margin:0 0 24px}.advice h2{font-size:16px;font-weight:650;margin:0 0 6px;letter-spacing:-.3px}.advice p{font-size:13px;line-height:1.65;margin:0;color:#536459}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 18px}.metric{border:1px solid var(--line);background:#f7f8f2;border-radius:12px;padding:13px 12px;min-width:0}.metric span,.metric small{display:block;font-size:10px;color:var(--muted)}.metric b{display:block;font-size:24px;font-weight:600;margin:5px 0 1px;letter-spacing:-.7px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.reading-details{margin:16px 0;font-size:12px;color:var(--muted)}.reading-details summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:6px;color:var(--ink);font-weight:600;list-style:none}.reading-details summary::-webkit-details-marker{display:none}.reading-details summary:after{content:'+';margin-left:auto;font-size:20px;font-weight:400}.reading-details[open] summary:after{content:'−'}.reading-details p{margin:12px 0;line-height:1.65}.pollutants{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px;margin:10px 0}.pollutants span{padding:8px;background:var(--base);border-radius:6px}.credit{border-top:1px solid var(--line);padding-top:18px;margin-top:28px;font-size:10px;line-height:1.8;color:var(--muted)}.credit p{margin:3px 0}.credits{display:flex;gap:4px 12px;flex-wrap:wrap}.credits span{white-space:normal}
.panel h2{font-size:26px;line-height:1.2;letter-spacing:-.8px;font-weight:600;margin:4px 0 10px}.panel>p{margin:0 0 22px;font-size:13px;color:var(--muted)}.row{width:100%;display:flex;align-items:center;gap:12px;border:0;border-bottom:1px solid var(--line);background:transparent;padding:16px 4px;text-align:left;min-height:72px}.row:hover{background:var(--soft)}.row .row-text{flex:1;min-width:0}.row b{display:block;font-size:13px;font-weight:600;overflow-wrap:anywhere}.row small{display:block;color:var(--muted);font-size:11px;margin-top:4px}.badge{min-width:44px;height:42px;display:grid;place-items:center;border-radius:12px;color:white;font-size:14px;font-weight:700;flex-shrink:0}.story{display:block;text-decoration:none;padding:20px 0;border-bottom:1px solid var(--line);color:var(--ink)}.story:hover b{color:var(--green)}.story b{display:block;font-size:16px;line-height:1.45;font-weight:600;margin:7px 0}.story small,.story span{display:block;font-size:10px;color:var(--muted)}.story span{text-transform:uppercase;letter-spacing:.08em}.panelhead{display:flex;justify-content:space-between;align-items:start;gap:10px}.notice{padding:12px 14px;border:1px solid #e1d4aa;border-radius:10px;background:#fff9e9;color:#6b522a;font-size:12px;margin:12px 0 20px}.empty{padding:28px 0;min-height:280px}.empty h1{font-size:30px;letter-spacing:-1px;line-height:1.2;margin:12px 0}.empty p{font-size:14px;color:var(--muted)}.skeleton{height:14px;border-radius:6px;background:#e5ebe0;margin:18px 0;animation:breathe 1.5s ease-in-out infinite alternate}.skeleton.score-load{height:100px;width:55%;margin:30px 0}.forecast-row{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;padding:14px 0;border-bottom:1px solid var(--line);font-size:12px}.forecast-row span{color:var(--muted)}.chart{width:100%;height:auto}.chart text{font-family:inherit}
.overlay{position:fixed;inset:0;background:#10261c70;backdrop-filter:blur(5px);display:flex;justify-content:center;align-items:center;padding:20px;z-index:2000}.modal{background:var(--paper);padding:32px;width:min(480px,100%);max-height:calc(100dvh - 40px);overflow:auto;overscroll-behavior:contain;border:1px solid var(--line);border-radius:22px;position:relative;box-shadow:0 24px 80px #10261c30}.modal h2{font-size:28px;letter-spacing:-.8px;font-weight:600;margin:0 40px 12px 0}.modal>p{font-size:13px;color:var(--muted)}.close{position:absolute;right:14px;top:14px;height:44px;width:44px;border:0;border-radius:50%;background:var(--soft);font-size:26px}.field{display:block;margin:22px 0;font-size:13px}.field input[type=range]{width:100%;height:44px;accent-color:var(--green)}.setting{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 0;border-top:1px solid var(--line)}.setting b{font-size:13px}.setting small{display:block;color:var(--muted);font-size:12px;margin-top:4px}.setting input{width:22px;height:22px;accent-color:var(--green);flex-shrink:0}.field select,.sinput{width:100%;min-height:50px;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--paper);color:var(--ink);font-size:16px}.field select{margin-top:8px;font-size:13px}.save{width:100%;margin-top:12px;min-height:48px}.toast{position:fixed;z-index:3000;bottom:28px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 32px);padding:14px 18px;font-size:13px;border-radius:12px;background:var(--ink);color:#fff;box-shadow:0 6px 24px #10251c20;pointer-events:none}
.leaflet-container{font-family:inherit;background:#dae4d7}.leaflet-control-attribution{font-size:10px!important;background:#fffefaee!important}.leaflet-control-zoom{box-shadow:0 3px 12px #18352210!important;border:1px solid var(--line)!important;border-radius:12px!important;overflow:hidden}.leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important;background:var(--paper)!important;color:var(--ink)!important}.leaflet-bottom.leaflet-left{margin:0 0 20px 10px}.map-bubble{height:38px;min-width:42px;padding:0 6px;display:grid;place-items:center;background:var(--aqi);border:3px solid var(--paper);border-radius:14px;color:#fff;font-size:12px;font-weight:750;font-variant-numeric:tabular-nums;box-shadow:0 3px 10px #17261e25;position:relative}.map-bubble:after{content:'';position:absolute;bottom:-7px;left:13px;border:5px solid transparent;border-top-color:var(--aqi);border-bottom:0}.map-bubble.active{outline:2px solid var(--ink);outline-offset:3px}.user-dot{width:16px;height:16px;background:#257bc2;border:3px solid white;border-radius:100%;box-shadow:0 0 0 6px #257bc230}.user-dot.approximate{background:#78877d;box-shadow:0 0 0 6px #78877d25}.mobile-map-card{display:none}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.spin{animation:rotate 1s linear infinite}.lang-ta .tabs button{font-size:10px}
@keyframes rotate{to{transform:rotate(360deg)}}@keyframes breathe{to{opacity:.5}}
@media(min-width:1500px){.workspace{grid-template-columns:480px minmax(0,1fr);padding:24px 32px 32px;gap:24px}.tabs{left:44px;top:36px;width:456px}.card{padding-right:28px;padding-left:28px}.top{padding:24px 38px}.map-title{top:26px;left:26px}.location-notice{margin-left:32px;margin-right:32px}}
@media(max-width:1050px) and (min-width:821px){.workspace{grid-template-columns:390px minmax(0,1fr);gap:14px;padding:16px}.tabs{left:28px;top:28px;width:366px}.card{padding-right:20px;padding-left:20px}.top{gap:16px;padding:16px 20px;grid-template-columns:1fr minmax(200px,300px) auto}.brand small{display:none}.connection{display:none}.map-title{padding:14px;left:14px;top:14px}.map-title h2{font-size:24px}.map-title p{max-width:150px}.map-controls{right:14px;top:14px}.location-notice{margin-left:16px;margin-right:16px}}
@media(max-width:820px){.top{grid-template-columns:1fr auto;gap:12px 10px;padding:12px max(16px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left))}.brand{font-size:27px;gap:8px}.brand img{width:30px;height:30px}.brand small{font-size:10px;padding-left:9px;margin-left:0}.actions{grid-column:2;gap:4px}.actions .icon-button{width:38px;min-width:38px;height:38px;border:0;background:transparent}.actions select{min-width:56px;height:38px;max-width:72px;border:0;background:transparent;padding:0 4px;font-size:12px}.locationbar{grid-column:1/-1;grid-row:2;gap:8px;border-top:1px solid var(--line);padding-top:10px}.locationbar .place{min-height:34px}.place>span:first-child{height:32px;width:32px}.place-copy b{font-size:12px}.place-copy small{font-size:10px}.locationbar .refresh{height:32px}.connection{font-size:10px;text-align:right}.location-notice{margin:0;padding:10px 16px;border-radius:0;border-inline:0;border-top:0;gap:8px;flex-wrap:wrap;font-size:11px}.location-notice>span{display:none}.location-notice p{flex-basis:100%;font-size:11px}.location-notice>div{margin-left:0}.location-notice button{min-height:36px;padding:6px 12px;font-size:11px}.workspace{display:block;min-height:0;overflow:hidden;padding:0}.card{position:absolute;inset:0 0 calc(var(--nav) + env(safe-area-inset-bottom));border:0;border-radius:0;padding:20px max(20px,env(safe-area-inset-right)) 24px max(20px,env(safe-area-inset-left));background:var(--paper)}.tabs{top:auto;bottom:0;left:0;right:0;width:100%;height:calc(var(--nav) + env(safe-area-inset-bottom));padding:8px max(8px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border:0;border-top:1px solid var(--line);border-radius:0;gap:3px;background:var(--paper)}.tabs button{font-size:10px;min-height:56px;border-radius:12px;gap:5px;flex-direction:column;padding:6px 2px}.tabs button svg{display:block;width:20px;height:20px}.tabs [data-tab=map]{display:flex}.tabs button[aria-selected=true]{background:var(--soft);color:var(--green);box-shadow:none}.tabs button[aria-selected=true] svg{stroke-width:2.2}.map-wrap{position:absolute;inset:0 0 calc(var(--nav) + env(safe-area-inset-bottom));visibility:hidden;pointer-events:none;border:0;border-radius:0}.app[data-view=map] .map-wrap{visibility:visible;pointer-events:auto}.app[data-view=map] .card{display:none}.reading-hero{margin:0 0 22px;padding-top:18px}.station-name{font-size:24px}.live{margin-bottom:20px}.score{margin:24px 0 26px;gap:24px}.score strong{font-size:104px}.credit{margin-top:24px}.map-title{top:14px;left:14px;padding:14px 16px;max-width:calc(100% - 82px)}.map-title h2{font-size:24px}.map-title p{font-size:11px}.map-controls{top:14px;right:14px}.map-hint{bottom:109px;left:72px}.mobile-map-card{position:absolute;z-index:800;left:14px;right:14px;bottom:28px;min-height:64px;padding:12px 16px;display:flex;align-items:center;gap:12px;border:1px solid var(--line);background:var(--paper);border-radius:14px;text-align:left;box-shadow:0 4px 18px #18352215}.mobile-map-card>span{min-width:0;flex:1}.mobile-map-card>span:last-child{flex:none;width:24px}.mobile-map-card b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.mobile-map-card small{font-size:10px;color:var(--muted)}.mobile-map-card strong{font-size:28px}.overlay{align-items:flex-end;padding:0}.modal{max-height:calc(100dvh - 20px);width:100%;border-radius:24px 24px 0 0;padding:30px 22px calc(22px + env(safe-area-inset-bottom));border:0}.toast{bottom:calc(90px + env(safe-area-inset-bottom))}.leaflet-control-zoom{margin-bottom:92px!important}}
@media(max-width:380px){.brand small{display:none}.card{padding-inline:16px}.score strong{font-size:90px}.score b{font-size:17px}.score{gap:16px}.station-name{font-size:21px}.reading-hero{padding-left:16px;padding-right:16px}.aqi-scale{margin-inline:-16px}.tabs button{font-size:9px}.metric{padding:12px 9px}.location-notice{padding-inline:12px}}
@media(max-height:520px) and (max-width:820px){.top{padding-block:7px;gap:4px}.locationbar{padding-top:4px}.location-notice{padding-block:6px}.map-title{display:none}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;scroll-behavior:auto!important;transition:none!important}}

</style>
</head><body><main class="app" data-view="now">
<header class="top">
<a class="brand" href="/" aria-label="Airly by Ordinexis"><img src="/favicon.png" alt="" width="24" height="24">Airly <small>by Ordinexis</small></a>
<div class="actions"><button class="icon-button" id="open-search" aria-label="Search for a city" data-icon="search"></button><select class="round" id="lang" aria-label="Language"><option value="en">EN</option><option value="ms">BM</option><option value="ta">தமிழ்</option><option value="zh">中文</option></select><button class="icon-button" id="open-settings" aria-label="Settings" data-icon="settings"></button></div>
<div class="locationbar"><button class="place" id="location" aria-label="Use my location"><span data-icon="location"></span><span class="place-copy"><b id="place">Finding your area…</b><small id="place-meta">Use my location</small></span></button><span id="connection" class="connection" role="status">Connecting</span><button class="icon-button refresh" id="refresh" aria-label="Refresh current station" data-icon="refresh"></button></div>
</header>
<section id="location-notice" class="location-notice" hidden aria-label="Location accuracy"><span data-icon="location"></span><p id="location-explanation"></p><div><button id="use-location" class="primary" data-i18n="locationAction">Use my location</button><button id="choose-city" class="secondary" data-i18n="chooseCity">Choose a city</button></div></section>
<div class="workspace">
<section class="map-wrap" aria-label="Air quality map"><div id="map" class="map"><p class="map-status">Loading map…</p></div><div class="map-title"><span class="eyebrow" data-i18n="mapEyebrow">THE AIR AROUND YOU</span><h2 data-i18n="mapTitle">A wider view.</h2><p data-i18n="mapSubtitle">Explore readings from nearby stations.</p></div><div class="map-controls"><button id="locate" class="icon-button" aria-label="Centre map on my location" data-icon="location"></button></div><div class="map-hint"><span id="map-hint">US AQI · tap a station</span></div><button class="mobile-map-card" id="map-reading"><span><b id="map-station">Select a station</b><small id="map-reading-label">View air quality</small></span><strong id="map-aqi">—</strong><span data-icon="arrow"></span></button></section>
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
<label class="field"><span data-i18n="localeL">Local news</span><select id="locale"><option value="AUTO" data-i18n="automatic">Automatic</option><option value="MY">Malaysia</option><option value="SG">Singapore</option><option value="ID">Indonesia</option><option value="TH">Thailand</option><option value="VN">Vietnam</option><option value="PH">Philippines</option><option value="BN">Brunei</option><option value="KH">Cambodia</option><option value="LA">Laos</option><option value="MM">Myanmar</option><option value="TL">Timor-Leste</option></select></label><button class="save primary" id="save" data-i18n="save">Save preferences</button></section></div>
<div id="smodal" class="overlay" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="search-title"><button class="close" id="sclose" aria-label="Close search">×</button><h2 id="search-title" data-i18n="searchT">Find a city</h2><label class="sr-only" for="sinput">City name</label><input id="sinput" class="sinput" type="search" autocomplete="off" enterkeyhint="search" placeholder="City name…"><div id="sresults" aria-live="polite"></div></section></div>
<div id="toast" class="toast" role="status" hidden></div>
</main>
<script>
const I18N={
en:{settingsBtn:'Settings',now:'Air Quality',nearby:'Nearby',news:'News',sample:'SAMPLE DATA',live:'LIVE READING',monitor:'NEAREST MONITOR',usaqi:'US AQI',fromyou:'km from you',reading:'current reading',humidity:'Humidity',wind:'Wind',lvl0:'Good',lvl1:'Moderate',lvl2:'Sensitive',lvl3:'Unhealthy',lvl4:'Very unhealthy',lvl5:'Hazardous',adv0T:'Good time to be outside',adv0B:'Enjoy your usual activities.',adv1T:'Generally acceptable',adv1B:'Unusually sensitive people may reduce prolonged exertion.',adv1Bs:'Watch for symptoms during long outdoor activity.',adv2T:'Reduce prolonged activity',adv2B:'Sensitive groups should limit prolonged outdoor exertion.',adv2Bs:'Keep activity light and consider a well-fitted mask.',adv3T:'Limit time outdoors',adv3B:'Everyone should reduce intense outdoor activity.',adv4T:'Stay indoors if possible',adv4B:'Close windows, use filtration, and avoid outdoor exertion.',alertT:'Alert me to meaningful changes',alertS:'Alerts on meaningful AQI changes — even when Airly is closed.',nearbyT:'Monitoring stations near you',nearbyS:'Tap a station to make it your dashboard.',newsT:'What’s shaping the air',newsS:'Recent haze and air-quality coverage for your locale.',nonews:'No recent coverage found.',settingsT:'Alerts that matter',settingsP:'Preferences stay on this device. Alerts can arrive even when Airly is closed.',deltaL:'Notify when AQI changes by',notifT:'Browser notifications',notifS:'Alert me to meaningful AQI changes',sensT:'Sensitive health profile',sensS:'Stricter personal guidance',localeL:'Local news',save:'Save preferences',saved:'Preferences saved on this device.',locA:'Using approximate IP location',locB:'Location unavailable — using Kuala Lumpur.',errA:'Live token is not configured — showing sample readings.',errB:'Live data temporarily unavailable — retrying soon.',noNotif:'Notifications are not supported in this browser.',aiStamp:'The above advisory is generated by AI — check critical information',updated:'Station updated',myapi:'API (MY) approx.',trend:'Trend & Forecast',trendT:'PM2.5 outlook',trendS:'Daily forecast range and average',trendNone:'No forecast available for this station yet.',trendSrc:'Forecast by the World Air Quality Index Project.',reset:'Reset',hsHint:'On iPhone/iPad: Share → Add to Home Screen, then open Airly from that icon to enable alerts.',searchT:'Find a city',searchPh:'City or station name…',noResults:'No stations found.',locBlocked:'Location is blocked. Allow it in the browser\\'s site settings — and on iPhone also Settings → your browser app → Location.',yourloc:'My Location (zoom in)',approx:'Approx. '},
ms:{settingsBtn:'Tetapan',now:'Kualiti Udara',nearby:'Berdekatan',news:'Berita',sample:'DATA CONTOH',live:'BACAAN LANGSUNG',monitor:'STESEN TERDEKAT',usaqi:'AQI AS',fromyou:'km dari anda',reading:'bacaan semasa',humidity:'Kelembapan',wind:'Angin',lvl0:'Baik',lvl1:'Sederhana',lvl2:'Sensitif',lvl3:'Tidak sihat',lvl4:'Sangat tidak sihat',lvl5:'Berbahaya',adv0T:'Sesuai untuk aktiviti luar',adv0B:'Nikmati aktiviti seperti biasa.',adv1T:'Umumnya boleh diterima',adv1B:'Individu yang sangat sensitif boleh kurangkan aktiviti berpanjangan.',adv1Bs:'Perhatikan simptom semasa aktiviti luar yang lama.',adv2T:'Kurangkan aktiviti berpanjangan',adv2B:'Kumpulan sensitif harus hadkan aktiviti luar yang lama.',adv2Bs:'Kekalkan aktiviti ringan dan pertimbangkan pelitup muka.',adv3T:'Hadkan masa di luar',adv3B:'Semua orang harus kurangkan aktiviti luar yang berat.',adv4T:'Kekal di dalam jika boleh',adv4B:'Tutup tingkap, guna penapis udara dan elakkan aktiviti luar.',alertT:'Maklumkan perubahan penting',alertS:'Amaran perubahan AQI ketara — walaupun Airly ditutup.',nearbyT:'Stesen pemantauan berdekatan',nearbyS:'Ketik stesen untuk jadikan papan pemuka anda.',newsT:'Apa yang mempengaruhi udara',newsS:'Liputan jerebu dan kualiti udara terkini untuk lokasi anda.',nonews:'Tiada liputan terkini.',settingsT:'Amaran yang penting',settingsP:'Tetapan disimpan pada peranti ini. Notifikasi boleh tiba walaupun Airly ditutup.',deltaL:'Maklumkan apabila AQI berubah sebanyak',notifT:'Notifikasi pelayar',notifS:'Maklumkan perubahan AQI yang ketara',sensT:'Profil kesihatan sensitif',sensS:'Panduan peribadi lebih ketat',localeL:'Berita tempatan',save:'Simpan tetapan',saved:'Tetapan disimpan pada peranti ini.',locA:'Menggunakan lokasi IP anggaran',locB:'Lokasi tidak tersedia — menggunakan Kuala Lumpur.',errA:'Token langsung belum dikonfigurasi — memaparkan data contoh.',errB:'Data langsung tidak tersedia buat masa ini.',noNotif:'Notifikasi tidak disokong dalam pelayar ini.',aiStamp:'Nasihat di atas dijana oleh AI — semak maklumat penting',updated:'Stesen dikemas kini',myapi:'API (MY) anggaran',trend:'Tren & Ramalan',trendT:'Unjuran PM2.5',trendS:'Julat dan purata ramalan harian',trendNone:'Tiada ramalan untuk stesen ini lagi.',trendSrc:'Ramalan oleh World Air Quality Index Project.',reset:'Set Semula',hsHint:'Di iPhone/iPad: Kongsi → Tambah ke Skrin Utama, kemudian buka Airly dari ikon itu untuk amaran.',searchT:'Cari bandar',searchPh:'Nama bandar atau stesen…',noResults:'Tiada stesen dijumpai.',locBlocked:'Lokasi disekat. Benarkan dalam tetapan laman pelayar — di iPhone, juga Tetapan → aplikasi pelayar → Lokasi.',yourloc:'Lokasi Saya (zum)',approx:'Anggaran '},
ta:{settingsBtn:'அமைப்பு',now:'காற்றுத் தரம்',nearby:'அருகில்',news:'செய்திகள்',sample:'மாதிரி தரவு',live:'நேரடி அளவீடு',monitor:'அருகிலுள்ள நிலையம்',usaqi:'US AQI',fromyou:'கி.மீ தொலைவில்',reading:'தற்போதைய அளவீடு',humidity:'ஈரப்பதம்',wind:'காற்று',lvl0:'நல்லது',lvl1:'மிதமானது',lvl2:'உணர்திறனுக்கு தீங்கு',lvl3:'ஆரோக்கியமற்றது',lvl4:'மிகவும் ஆரோக்கியமற்றது',lvl5:'அபாயகரமானது',adv0T:'வெளியே செல்ல நல்ல நேரம்',adv0B:'வழக்கமான செயல்பாடுகளைத் தொடரலாம்.',adv1T:'பொதுவாக ஏற்கத்தக்கது',adv1B:'மிக உணர்திறன் உள்ளவர்கள் நீண்ட உழைப்பைக் குறைக்கலாம்.',adv1Bs:'நீண்ட வெளிப்புற செயல்பாட்டின்போது அறிகுறிகளைக் கவனியுங்கள்.',adv2T:'நீண்ட செயல்பாட்டைக் குறைக்கவும்',adv2B:'உணர்திறன் குழுக்கள் நீண்ட வெளிப்புற உழைப்பைக் கட்டுப்படுத்த வேண்டும்.',adv2Bs:'இலகுவான செயல்பாடு; பொருத்தமான முகக்கவசம் பரிசீலிக்கவும்.',adv3T:'வெளியே இருக்கும் நேரத்தைக் குறைக்கவும்',adv3B:'அனைவரும் கடும் வெளிப்புற செயல்பாட்டைக் குறைக்க வேண்டும்.',adv4T:'முடிந்தால் உள்ளேயே இருங்கள்',adv4B:'ஜன்னல்களை மூடி, காற்று வடிகட்டியைப் பயன்படுத்தவும்.',alertT:'முக்கிய மாற்றங்களை அறிவிக்கவும்',alertS:'முக்கிய AQI மாற்றங்களுக்கு எச்சரிக்கை — Airly மூடியிருந்தாலும்.',nearbyT:'அருகிலுள்ள கண்காணிப்பு நிலையங்கள்',nearbyS:'நிலையத்தைத் தட்டி உங்கள் டாஷ்போர்டாக்குங்கள்.',newsT:'காற்றை பாதிக்கும் நிகழ்வுகள்',newsS:'உங்கள் பகுதிக்கான சமீபத்திய காற்றுத்தர செய்திகள்.',nonews:'சமீபத்திய செய்திகள் இல்லை.',settingsT:'முக்கியமான எச்சரிக்கைகள்',settingsP:'விருப்பங்கள் இந்தச் சாதனத்திலேயே சேமிக்கப்படும். Airly மூடியிருந்தாலும் அறிவிப்புகள் வரலாம்.',deltaL:'AQI இவ்வளவு மாறினால் அறிவிக்கவும்',notifT:'உலாவி அறிவிப்புகள்',notifS:'குறிப்பிடத்தக்க AQI மாற்றங்களை அறிவிக்கவும்',sensT:'உணர்திறன் சுகாதார விவரம்',sensS:'கடுமையான தனிப்பட்ட வழிகாட்டுதல்',localeL:'உள்ளூர் செய்திகள்',save:'சேமிக்கவும்',saved:'விருப்பங்கள் சேமிக்கப்பட்டன.',locA:'தோராயமான IP இருப்பிடம் பயன்படுத்தப்படுகிறது',locB:'இருப்பிடம் கிடைக்கவில்லை — கோலாலம்பூர் பயன்படுத்தப்படுகிறது.',errA:'நேரடி டோக்கன் அமைக்கப்படவில்லை — மாதிரி தரவு காட்டப்படுகிறது.',errB:'நேரடி தரவு தற்காலிகமாக கிடைக்கவில்லை.',noNotif:'இந்த உலாவியில் அறிவிப்புகள் ஆதரிக்கப்படவில்லை.',aiStamp:'மேலே உள்ள அறிவுரை AI ஆல் உருவாக்கப்பட்டது — முக்கியத் தகவலைச் சரிபார்க்கவும்',updated:'நிலையம் புதுப்பிக்கப்பட்டது',myapi:'API (MY) தோராயம்',trend:'போக்கு & கணிப்பு',trendT:'PM2.5 கணிப்பு',trendS:'தினசரி முன்னறிவிப்பு வரம்பும் சராசரியும்',trendNone:'இந்த நிலையத்திற்கு கணிப்பு இல்லை.',trendSrc:'கணிப்பு: World Air Quality Index Project.',reset:'மீட்டமை',hsHint:'iPhone/iPad-இல்: Share → Add to Home Screen செய்து, அந்த ஐகானில் இருந்து Airly-ஐத் திறக்கவும்.',searchT:'நகரத்தைத் தேடு',searchPh:'நகரம் அல்லது நிலையம்…',noResults:'நிலையங்கள் இல்லை.',locBlocked:'இருப்பிடம் தடுக்கப்பட்டுள்ளது. உலாவியின் தள அமைப்புகளில் அனுமதிக்கவும் — iPhone-இல் Settings → உலாவி ஆப் → Location-ஐயும் சரிபார்க்கவும்.',yourloc:'என் இருப்பிடம் (பெரிதாக்க)',approx:'தோராய '},
zh:{settingsBtn:'设置',now:'空气质量',nearby:'附近',news:'新闻',sample:'示例数据',live:'实时读数',monitor:'最近监测站',usaqi:'美国 AQI',fromyou:'公里外',reading:'当前读数',humidity:'湿度',wind:'风速',lvl0:'良好',lvl1:'中等',lvl2:'敏感人群不健康',lvl3:'不健康',lvl4:'非常不健康',lvl5:'危险',adv0T:'适合户外活动',adv0B:'可照常进行日常活动。',adv1T:'总体可接受',adv1B:'特别敏感者可减少长时间剧烈活动。',adv1Bs:'长时间户外活动时注意身体反应。',adv2T:'减少长时间活动',adv2B:'敏感人群应限制长时间户外活动。',adv2Bs:'保持轻度活动，建议佩戴口罩。',adv3T:'减少外出时间',adv3B:'所有人应减少剧烈户外活动。',adv4T:'尽量留在室内',adv4B:'关闭门窗，使用空气净化器，避免户外活动。',alertT:'重要变化提醒',alertS:'重要 AQI 变化提醒 — 即使 Airly 已关闭。',nearbyT:'附近的监测站',nearbyS:'点按站点设为您的仪表板。',newsT:'影响空气的动态',newsS:'您所在地区最新的雾霾与空气质量报道。',nonews:'暂无最新报道。',settingsT:'重要提醒',settingsP:'偏好仅保存在本设备上。即使 Airly 已关闭也能收到通知。',deltaL:'AQI 变化达到以下值时提醒',notifT:'浏览器通知',notifS:'提醒我显著的 AQI 变化',sensT:'敏感健康档案',sensS:'更严格的个人建议',localeL:'本地新闻',save:'保存设置',saved:'偏好已保存在本设备上。',locA:'正在使用大致的 IP 位置',locB:'无法获取位置 — 使用吉隆坡。',errA:'未配置实时令牌 — 显示示例数据。',errB:'实时数据暂不可用。',noNotif:'此浏览器不支持通知。',aiStamp:'以上建议由 AI 生成 — 请核实重要信息',updated:'监测站更新于',myapi:'API（马来西亚）约',trend:'趋势与预报',trendT:'PM2.5 展望',trendS:'每日预报范围与平均值',trendNone:'该站点暂无预报。',trendSrc:'预报来自 World Air Quality Index Project。',reset:'重置',hsHint:'在 iPhone/iPad 上：分享 → 添加到主屏幕，再从该图标打开 Airly 即可启用通知。',searchT:'搜索城市',searchPh:'城市或监测站名称…',noResults:'未找到监测站。',locBlocked:'位置权限被阻止。请在浏览器的网站设置中允许 — iPhone 上还需检查 设置 → 浏览器应用 → 位置。',yourloc:'我的位置（放大）',approx:'大约 '}};


const $ = q=>document.querySelector(q), $$ = q=>[...document.querySelectorAll(q)];
const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u=>/^https?:\\/\\//i.test(u||'') ? esc(u) : '#';
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
const REVIEW_I18N={"en":{"mapFailed":"Station map could not refresh","unknown":"Measurement time unknown","rose":"rose by","fell":"fell by","date":"Date","dominantLabel":"Dominant pollutant","subindex":"AQI sub-index","searchAction":"Search for a city","languageLabel":"Language","closeSettings":"Close settings","closeSearch":"Close search","locationAccuracy":"Location accuracy","mapLabel":"Air quality map","centreMap":"Centre map on my location","dashboardLabel":"Air quality dashboard","viewsLabel":"Views","refreshAction":"Refresh current reading","refreshNews":"Refresh news","cityName":"City name","forecastLabel":"Daily PM2.5 AQI forecast; values in the table below."},"ms":{"mapFailed":"Peta stesen tidak dapat dikemas kini","unknown":"Masa bacaan tidak diketahui","rose":"meningkat sebanyak","fell":"menurun sebanyak","date":"Tarikh","dominantLabel":"Pencemar dominan","subindex":"Subindeks AQI","searchAction":"Cari bandar","languageLabel":"Bahasa","closeSettings":"Tutup tetapan","closeSearch":"Tutup carian","locationAccuracy":"Ketepatan lokasi","mapLabel":"Peta kualiti udara","centreMap":"Pusatkan peta pada lokasi saya","dashboardLabel":"Papan pemuka kualiti udara","viewsLabel":"Paparan","refreshAction":"Muat semula bacaan semasa","refreshNews":"Muat semula berita","cityName":"Nama bandar","forecastLabel":"Ramalan AQI PM2.5 harian; nilai dalam jadual di bawah."},"ta":{"mapFailed":"நிலைய வரைபடத்தைப் புதுப்பிக்க முடியவில்லை","unknown":"அளவீட்டு நேரம் தெரியவில்லை","rose":"உயர்ந்தது","fell":"குறைந்தது","date":"தேதி","dominantLabel":"முக்கிய மாசுபடுத்தி","subindex":"AQI துணைக் குறியீடு","searchAction":"நகரத்தைத் தேடு","languageLabel":"மொழி","closeSettings":"அமைப்பை மூடு","closeSearch":"தேடலை மூடு","locationAccuracy":"இருப்பிடத் துல்லியம்","mapLabel":"காற்றுத் தர வரைபடம்","centreMap":"என் இருப்பிடத்தில் வரைபடத்தை மையப்படுத்து","dashboardLabel":"காற்றுத் தரப் பலகை","viewsLabel":"காட்சிகள்","refreshAction":"தற்போதைய அளவீட்டைப் புதுப்பி","refreshNews":"செய்திகளைப் புதுப்பி","cityName":"நகரப் பெயர்","forecastLabel":"தினசரி PM2.5 AQI கணிப்பு; கீழே உள்ள அட்டவணையில் மதிப்புகள்.","myNote":"மலேசிய சுற்றுச்சூழல் துறையின் அதிகாரப்பூர்வ API. இது US AQI மாற்றம் அல்ல. கணக்கீட்டு முறைகள் வேறுபடுவதால் மதிப்புகளை நேரடியாக ஒப்பிட முடியாது.","myForecast":"இந்த DOE தரவில் API கணிப்பு இல்லை. US AQI கணிப்பை மாற்றாகக் காட்டவில்லை.","myMetrics":"முக்கிய மாசுபடுத்தி","mySource":"அதிகாரப்பூர்வ மூலம்","myMap":"மலேசிய API · DOE நிலையங்கள்","myGuide":"மலேசிய API சுகாதார வழிகாட்டுதலைப் பின்பற்றவும்."},"zh":{"mapFailed":"无法刷新监测站地图","unknown":"测量时间未知","rose":"上升","fell":"下降","date":"日期","dominantLabel":"主要污染物","subindex":"AQI 分指数","searchAction":"搜索城市","languageLabel":"语言","closeSettings":"关闭设置","closeSearch":"关闭搜索","locationAccuracy":"位置精度","mapLabel":"空气质量地图","centreMap":"将地图定位到我的位置","dashboardLabel":"空气质量面板","viewsLabel":"视图","refreshAction":"刷新当前读数","refreshNews":"刷新新闻","cityName":"城市名称","forecastLabel":"每日 PM2.5 AQI 预报；数值见下表。"}};
for(const l of Object.keys(REVIEW_I18N))Object.assign(I18N[l],REVIEW_I18N[l]);
const COMPLETE_I18N={"ms":{"loadingB":"Mendapatkan bacaan stesen terkini.","failed":"Muat semula gagal · bacaan terakhir dipaparkan","offline":"Luar talian · bacaan terakhir dipaparkan","ago":"lalu","backgroundTitle":"Amaran latar belakang","backgroundNote":"Benarkan penyimpanan stesen dan langganan push pada pelayan untuk semakan berjadual. Matikan untuk memadam langganan.","indexNote":"Nilai PM2.5 dan PM10 ialah subindeks AQI, bukan kepekatan µg/m³. AQI AS bukan API rasmi Malaysia.","spatialNote":"Stesen mengukur udara di lokasinya sendiri. Keadaan berdekatan boleh berbeza.","olderNote":"Bacaan ini berusia lebih 3 jam dan mungkin tidak menggambarkan keadaan semasa.","noTimeNote":"Pembekal tidak memberikan masa pengukuran yang disahkan.","forecastNote":"Ramalan AQI PM2.5, bukan kepekatan terukur. Tarikh mengikut waktu tempatan stesen.","noForecast":"Tiada ramalan semasa. Ramalan lama tidak dipaparkan sebagai keadaan akan datang.","locationPrecision":"Ketepatan lokasi","approxLabel":"Kawasan IP anggaran","newsFailed":"Berita tidak dapat dimuatkan sepenuhnya. Cuba lagi.","nearbyEmpty":"Tiada stesen dimuatkan di kawasan ini. Buka peta atau cari bandar.","checked":"Disemak","unavailableAdvice":"Semak masa bacaan dan panduan semasa agensi alam sekitar tempatan.","stationLoading":"Memuatkan butiran stesen","sampleRemoved":"Tiada bacaan contoh dipaparkan.","mapUnavailable":"Peta tidak dapat dimuatkan. Bacaan stesen masih tersedia.","allClear":"Tiada AQI sah dilaporkan","advisorySource":"Panduan mengikut kategori kesihatan AQI AS.","geoFail":"Lokasi tepat tidak tersedia. Menggunakan kawasan anggaran.","permissionDenied":"Notifikasi disekat. Benarkan dalam tetapan pelayar.","notSaved":"Tetapan digunakan untuk sesi ini; storan pelayar tidak tersedia.","oldForecast":"Ramalan tidak tersedia","reportFrom":"Dilaporkan oleh","noAlertsStale":"Amaran hanya menggunakan bacaan bertarikh dari stesen sama, tidak melebihi 3 jam.","bgFailed":"Tetapan amaran latar belakang tidak dapat disegerakkan. Tetapan sebelumnya dikekalkan.","navForecast":"Ramalan","dataError":"Tidak dapat mendapatkan bacaan stesen yang sah.","myMissing":"Tiada stesen API Malaysia dalam paparan ini.","automatic":"Automatik","scaleLabel":"Skala kategori"},"ta":{"loadingB":"கிடைக்கும் சமீபத்திய நிலைய அளவீட்டைப் பெறுகிறது.","failed":"புதுப்பிப்பு தோல்வி · கடைசி அளவீடு காட்டப்படுகிறது","offline":"இணையம் இல்லை · கடைசி அளவீடு காட்டப்படுகிறது","ago":"முன்பு","backgroundTitle":"பின்னணி எச்சரிக்கைகள்","backgroundNote":"திட்டமிட்ட சரிபார்ப்புகளுக்கு நிலையத்தையும் push சந்தாவையும் சேவையகத்தில் சேமிக்க அனுமதிக்கவும். சந்தாவை நீக்க அணைக்கவும்.","indexNote":"PM2.5 மற்றும் PM10 மதிப்புகள் AQI துணைக் குறியீடுகள்; µg/m³ செறிவு அல்ல. US AQI மலேசியாவின் அதிகாரப்பூர்வ API அல்ல.","spatialNote":"நிலையம் அதன் இருப்பிடத்தில் காற்றை அளவிடுகிறது. அருகிலுள்ள நிலைமைகள் வேறுபடலாம்.","olderNote":"இந்த அளவீடு 3 மணி நேரத்திற்கு மேல் பழையது; தற்போதைய நிலையைப் பிரதிபலிக்காமல் இருக்கலாம்.","noTimeNote":"சரிபார்க்கப்பட்ட அளவீட்டு நேரத்தை வழங்குநர் தரவில்லை.","forecastNote":"PM2.5 AQI கணிப்பு; அளவிடப்பட்ட செறிவு அல்ல. தேதிகள் நிலையத்தின் உள்ளூர் நேரத்தில் உள்ளன.","noForecast":"தற்போதைய கணிப்பு இல்லை. பழைய கணிப்புகள் வரவிருக்கும் நிலையாகக் காட்டப்படுவதில்லை.","locationPrecision":"இருப்பிடத் துல்லியம்","approxLabel":"தோராயமான IP பகுதி","newsFailed":"செய்திகளை முழுமையாக ஏற்ற முடியவில்லை. மீண்டும் முயலவும்.","nearbyEmpty":"இந்தப் பகுதியில் நிலையங்கள் ஏற்றப்படவில்லை. வரைபடத்தைத் திறக்கவும் அல்லது நகரத்தைத் தேடவும்.","checked":"சரிபார்க்கப்பட்டது","unavailableAdvice":"அளவீட்டு நேரத்தையும் உள்ளூர் சுற்றுச்சூழல் துறையின் தற்போதைய வழிகாட்டுதலையும் பார்க்கவும்.","stationLoading":"நிலைய விவரங்களை ஏற்றுகிறது","sampleRemoved":"மாதிரி அளவீடுகள் காட்டப்படுவதில்லை.","mapUnavailable":"வரைபடத்தை ஏற்ற முடியவில்லை. நிலைய அளவீடுகள் இன்னும் கிடைக்கின்றன.","allClear":"செல்லுபடியான AQI அளவீடு இல்லை","advisorySource":"வழிகாட்டுதல் US AQI சுகாதார வகைகளைப் பின்பற்றுகிறது.","geoFail":"துல்லியமான இருப்பிடம் கிடைக்கவில்லை. தோராய பகுதி பயன்படுத்தப்படுகிறது.","permissionDenied":"அறிவிப்புகள் தடுக்கப்பட்டுள்ளன. உலாவி அமைப்புகளில் அனுமதிக்கவும்.","notSaved":"இந்த அமர்வில் அமைப்புகள் செயல்படும்; உலாவி சேமிப்பகம் கிடைக்கவில்லை.","oldForecast":"கணிப்பு கிடைக்கவில்லை","reportFrom":"வழங்கியவர்","noAlertsStale":"அதே நிலையத்தின் தேதியிட்ட, 3 மணி நேரத்திற்குள் உள்ள அளவீடுகளை மட்டும் எச்சரிக்கைகள் பயன்படுத்தும்.","bgFailed":"பின்னணி எச்சரிக்கை அமைப்புகளை ஒத்திசைக்க முடியவில்லை. முந்தைய அமைப்புகள் தொடர்கின்றன.","navForecast":"கணிப்பு","dataError":"செல்லுபடியான நிலைய அளவீட்டைப் பெற முடியவில்லை.","myMissing":"இந்தக் காட்சியில் மலேசிய API நிலையங்கள் இல்லை.","unknownTime":"அளவீட்டு நேரம் கிடைக்கவில்லை","fetching":"புதுப்பிக்கிறது","settingsNote":"விருப்பங்கள் இந்தச் சாதனத்தில் சேமிக்கப்படும்.","alertActive":"எச்சரிக்கைகள் இயக்கப்பட்டுள்ளன","alertDescription":"அமைப்புகளில் குறியீட்டு மாற்ற அளவைத் தேர்ந்தெடுக்கவும்.","mapHint":"US AQI · நிலையத்தைத் தட்டவும்","defaultArea":"கோலாலம்பூர் · இயல்புநிலை பகுதி","automatic":"தானாக","scaleLabel":"வகை அளவுகோல்"},"zh":{"loadingB":"正在获取最新可用的监测站读数。","failed":"刷新失败 · 显示上次读数","offline":"离线 · 显示上次读数","ago":"前","backgroundTitle":"后台提醒","backgroundNote":"同意将此监测站和推送订阅存储在服务器上以定时检查。关闭后删除订阅。","indexNote":"PM2.5 和 PM10 数值是 AQI 分指数，并非 µg/m³ 浓度。美国 AQI 并非马来西亚官方 API。","spatialNote":"监测站测量其所在位置的空气，附近状况可能不同。","olderNote":"此读数已超过三小时，可能无法反映当前状况。","noTimeNote":"数据提供方未提供经过验证的测量时间。","forecastNote":"PM2.5 AQI 预报，并非实测浓度。日期采用监测站当地时间。","noForecast":"暂无当前预报。旧预报不会显示为未来状况。","locationPrecision":"位置精度","approxLabel":"大致 IP 地区","newsFailed":"未能完整加载新闻，请重试。","nearbyEmpty":"此地区未加载监测站。请打开地图或搜索城市。","checked":"已检查","unavailableAdvice":"请查看读数时间，并参考当地环境部门的最新指引。","stationLoading":"正在加载监测站详情","sampleRemoved":"不会显示示例读数。","mapUnavailable":"无法加载地图，监测站读数仍可使用。","allClear":"未报告有效 AQI","advisorySource":"指引遵循美国 AQI 健康类别。","geoFail":"精确位置不可用，正在使用大致地区。","permissionDenied":"通知被阻止，请在浏览器设置中允许。","notSaved":"设置在本次会话中有效，浏览器存储不可用。","oldForecast":"预报不可用","reportFrom":"数据提供方","noAlertsStale":"提醒仅使用同一监测站带日期且不超过三小时的读数。","bgFailed":"无法同步后台提醒设置，之前的设置将保留。","navForecast":"预报","dataError":"无法获取有效的监测站读数。","myMissing":"此视图中没有马来西亚 API 监测站。","automatic":"自动","scaleLabel":"类别刻度"},"en":{"bgFailed":"Background alert settings could not be synced. Previous settings remain active.","automatic":"Automatic","scaleLabel":"Category scale"}};
for(const l of Object.keys(COMPLETE_I18N))Object.assign(I18N[l],COMPLETE_I18N[l]);
const COLORS=['#287750','#94710b','#b86221','#b64436','#81406c','#721f40'];
const MY_COLORS=['#2369b5','#357b28',null,'#8c7100','#b75e16','#b83131'];
const LOCATION_I18N={
 en:{geoCoarse:'Your device reported a broad location area. Choose a city if this reading is in the wrong region.',lastDeviceLocation:'Last device location',findingArea:'Finding your area…',deviceLocation:'Device location',chosenCity:'City you selected',defaultLabel:'Default area · location unknown',locating:'Finding device location…',chooseCity:'Choose a city',fromCity:'from selected city',fromArea:'from approximate area',fromDevice:'from device location',ipNotice:'Your network location may be wrong. Use your device location or choose a city for readings in the right area.',defaultNotice:'Your location is unavailable. Showing the Kuala Lumpur area until you choose a city or allow location.',geoTimeout:'Your device could not get a fresh location in time. Try again outdoors or choose a city.',geoUnavailable:'Device location is unavailable. Check your device location settings or choose a city.',mapEyebrow:'The air around you',mapTitle:'A wider view.',mapSubtitle:'Explore readings from nearby stations.'},
 ms:{geoCoarse:'Peranti melaporkan kawasan yang luas. Pilih bandar jika bacaan ini di kawasan yang salah.',lastDeviceLocation:'Lokasi peranti terakhir',findingArea:'Mencari kawasan anda…',deviceLocation:'Lokasi peranti',chosenCity:'Bandar pilihan anda',defaultLabel:'Kawasan lalai · lokasi tidak diketahui',locating:'Mencari lokasi peranti…',chooseCity:'Pilih bandar',fromCity:'dari bandar pilihan',fromArea:'dari kawasan anggaran',fromDevice:'dari lokasi peranti',ipNotice:'Lokasi rangkaian mungkin salah. Gunakan lokasi peranti atau pilih bandar untuk bacaan di kawasan yang betul.',defaultNotice:'Lokasi tidak tersedia. Kawasan Kuala Lumpur dipaparkan sehingga anda memilih bandar atau membenarkan lokasi.',geoTimeout:'Lokasi baharu tidak diperoleh tepat pada masanya. Cuba lagi di luar atau pilih bandar.',geoUnavailable:'Lokasi peranti tidak tersedia. Semak tetapan lokasi atau pilih bandar.',mapEyebrow:'Udara di sekitar anda',mapTitle:'Pandangan lebih luas.',mapSubtitle:'Terokai bacaan stesen berdekatan.'},
 ta:{geoCoarse:'சாதன இருப்பிடம் துல்லியமாக இல்லை. தவறான பகுதி காட்டப்பட்டால் நகரத்தைத் தேர்ந்தெடுக்கவும்.',lastDeviceLocation:'கடைசி சாதன இருப்பிடம்',findingArea:'உங்கள் பகுதியைக் கண்டறிகிறது…',deviceLocation:'சாதன இருப்பிடம்',chosenCity:'தேர்ந்தெடுத்த நகரம்',defaultLabel:'இயல்புநிலை பகுதி · இருப்பிடம் தெரியவில்லை',locating:'சாதன இருப்பிடத்தைக் கண்டறிகிறது…',chooseCity:'நகரத்தைத் தேர்ந்தெடு',fromCity:'தேர்ந்தெடுத்த நகரத்திலிருந்து',fromArea:'தோராய பகுதியிலிருந்து',fromDevice:'சாதன இருப்பிடத்திலிருந்து',ipNotice:'பிணைய இருப்பிடம் தவறாக இருக்கலாம். சாதன இருப்பிடத்தைப் பயன்படுத்தவும் அல்லது நகரத்தைத் தேர்ந்தெடுக்கவும்.',defaultNotice:'இருப்பிடம் கிடைக்கவில்லை. நகரத்தைத் தேர்ந்தெடுக்கும் வரை கோலாலம்பூர் பகுதி காட்டப்படும்.',geoTimeout:'புதிய இருப்பிடம் கிடைக்க நேரம் கடந்தது. வெளியே மீண்டும் முயலவும் அல்லது நகரத்தைத் தேர்ந்தெடுக்கவும்.',geoUnavailable:'சாதன இருப்பிடம் கிடைக்கவில்லை. இருப்பிட அமைப்புகளைச் சரிபார்க்கவும் அல்லது நகரத்தைத் தேர்ந்தெடுக்கவும்.',mapEyebrow:'உங்களைச் சுற்றியுள்ள காற்று',mapTitle:'விரிவான பார்வை.',mapSubtitle:'அருகிலுள்ள நிலையங்களின் அளவீடுகளைப் பாருங்கள்.'},
 zh:{geoCoarse:'设备提供的位置范围较大。如读数来自错误地区，请选择城市。',lastDeviceLocation:'上次设备位置',findingArea:'正在查找您的地区…',deviceLocation:'设备位置',chosenCity:'您选择的城市',defaultLabel:'默认地区 · 位置未知',locating:'正在查找设备位置…',chooseCity:'选择城市',fromCity:'距所选城市',fromArea:'距大致地区',fromDevice:'距设备位置',ipNotice:'网络位置可能不准确。请使用设备位置或选择城市，以查看正确地区的读数。',defaultNotice:'无法获取位置。选择城市或允许定位前，将显示吉隆坡地区。',geoTimeout:'未能及时获取新位置。请在室外重试或选择城市。',geoUnavailable:'设备位置不可用。请检查定位设置或选择城市。',mapEyebrow:'您周围的空气',mapTitle:'更广阔的视野。',mapSubtitle:'查看附近监测站的读数。'}
};
for(const l of Object.keys(LOCATION_I18N))Object.assign(I18N[l],LOCATION_I18N[l]);
const ACCURACY_I18N={"en": {"usaqi": "US AQI · WAQI", "indexUS": "US AQI · WAQI pollutant indices", "indexNote": "Highest available pollutant AQI sub-index supplied by WAQI. This is not a conversion of Malaysia API. Missing pollutants, averaging periods and the provider’s breakpoint edition can affect comparisons; raw concentrations are unavailable here.", "methodMY": "Official DOE API. This number is not US AQI.", "methodUS": "From WAQI pollutant indices, not converted from Malaysia API.", "mapHint": "Numbers use verified station details. Select a grey pin to check its reading. API and AQI use different scales.", "checkReading": "Select to check reading", "forecastNote": "WAQI model forecast of PM2.5 AQI, not measured air quality or a Malaysia API forecast. The feed does not supply a model update time.", "myAdvice0": "Usual outdoor activities can continue. Follow local health updates.", "myAdvice1": "Usual outdoor activities can continue. Follow local health updates.", "myAdvice3": "People at higher risk, including children, older adults, pregnant people and those with heart or lung conditions, should limit outdoor activity.", "myAdvice4": "Older adults and other people at higher risk should stay indoors and reduce physical activity. Seek medical advice if health problems occur.", "myAdvice5": "Avoid outdoor activities and follow local health advisories."}, "ms": {"usaqi": "AQI AS · WAQI", "indexUS": "AQI AS · subindeks pencemar WAQI", "indexNote": "Subindeks AQI pencemar tertinggi yang tersedia daripada WAQI, bukan penukaran API Malaysia. Pencemar yang tiada, tempoh purata dan versi piawaian penyedia boleh mempengaruhi perbandingan. Kepekatan mentah tidak tersedia di sini.", "methodMY": "API rasmi JAS. Angka ini bukan AQI AS.", "methodUS": "Daripada subindeks pencemar WAQI, bukan penukaran API Malaysia.", "mapHint": "Angka menggunakan butiran stesen yang disemak. Pilih pin kelabu untuk menyemak bacaan. API dan AQI menggunakan skala berbeza.", "checkReading": "Pilih untuk semak bacaan", "forecastNote": "Ramalan model WAQI untuk AQI PM2.5, bukan bacaan terukur atau ramalan API Malaysia. Masa kemas kini model tidak disediakan.", "myAdvice0": "Aktiviti luar biasa boleh diteruskan. Ikuti maklumat kesihatan tempatan.", "myAdvice1": "Aktiviti luar biasa boleh diteruskan. Ikuti maklumat kesihatan tempatan.", "myAdvice3": "Golongan berisiko tinggi termasuk kanak-kanak, warga emas, wanita hamil dan pesakit jantung atau paru-paru perlu mengehadkan aktiviti luar.", "myAdvice4": "Warga emas dan golongan berisiko tinggi perlu berada di dalam dan mengurangkan aktiviti fizikal. Dapatkan nasihat perubatan jika mengalami masalah kesihatan.", "myAdvice5": "Elakkan aktiviti luar dan ikuti nasihat kesihatan tempatan."}, "zh": {"usaqi": "美国 AQI · WAQI", "indexUS": "美国 AQI · WAQI 污染物分指数", "indexNote": "采用 WAQI 提供的可用污染物 AQI 分指数中的最高值，并非由马来西亚 API 换算而来。缺失污染物、平均时段和供应方标准版本会影响比较；此处没有原始浓度数据。", "methodMY": "环境局官方 API，并非美国 AQI。", "methodUS": "来自 WAQI 污染物分指数，并非由马来西亚 API 换算。", "mapHint": "数字来自已核对的监测站详情。选择灰色标记查询读数。API 和 AQI 使用不同标准。", "checkReading": "选择以查询读数", "forecastNote": "WAQI 模型预测的 PM2.5 AQI，非实测值或马来西亚 API 预测。数据未提供模型更新时间。", "myAdvice0": "可继续日常户外活动，并关注当地健康公告。", "myAdvice1": "可继续日常户外活动，并关注当地健康公告。", "myAdvice3": "儿童、老年人、孕妇及心肺疾病患者等高风险人群应减少户外活动。", "myAdvice4": "老年人和其他高风险人群应留在室内并减少体力活动。如出现健康问题，请就医咨询。", "myAdvice5": "避免户外活动，并遵循当地健康建议。"}, "ta": {"usaqi": "அமெரிக்க AQI · WAQI", "indexUS": "அமெரிக்க AQI · WAQI மாசுபாட்டுக் குறியீடுகள்", "indexNote": "WAQI வழங்கும் கிடைக்கக்கூடிய மாசுபாட்டு AQI துணைக் குறியீடுகளில் மிக உயர்ந்த மதிப்பு. இது மலேசிய API மாற்றம் அல்ல. விடுபட்ட மாசுபாடுகள், சராசரிக் காலம் மற்றும் தரநிலை பதிப்பு ஒப்பீட்டைப் பாதிக்கலாம். மூலச் செறிவு கிடைக்கவில்லை.", "methodMY": "DOE அதிகாரப்பூர்வ API. இது அமெரிக்க AQI அல்ல.", "methodUS": "WAQI மாசுபாட்டுக் குறியீடுகள்; மலேசிய API மாற்றம் அல்ல.", "mapHint": "எண்கள் சரிபார்க்கப்பட்ட நிலைய விவரங்களிலிருந்து பெறப்படுகின்றன. சாம்பல் குறியைத் தேர்ந்து அளவீட்டைப் பார்க்கவும். API, AQI அளவுகோல்கள் வேறுபட்டவை.", "checkReading": "அளவீட்டைப் பார்க்கத் தேர்ந்தெடுக்கவும்", "forecastNote": "WAQI மாதிரியின் PM2.5 AQI முன்னறிவிப்பு. இது நேரடி அளவீடோ மலேசிய API முன்னறிவிப்போ அல்ல. மாதிரி புதுப்பிப்பு நேரம் வழங்கப்படவில்லை.", "myAdvice0": "வழக்கமான வெளிப்புறச் செயல்களைத் தொடரலாம். உள்ளூர் சுகாதாரத் தகவல்களைக் கவனிக்கவும்.", "myAdvice1": "வழக்கமான வெளிப்புறச் செயல்களைத் தொடரலாம். உள்ளூர் சுகாதாரத் தகவல்களைக் கவனிக்கவும்.", "myAdvice3": "குழந்தைகள், முதியவர்கள், கர்ப்பிணிகள் மற்றும் இதய அல்லது நுரையீரல் நோயுள்ளவர்கள் வெளிப்புறச் செயல்களைக் குறைக்க வேண்டும்.", "myAdvice4": "முதியவர்களும் அதிக ஆபத்துள்ளவர்களும் உள்ளே இருந்து உடற்பயிற்சியைக் குறைக்க வேண்டும். உடல்நலப் பிரச்சினை ஏற்பட்டால் மருத்துவ ஆலோசனை பெறவும்.", "myAdvice5": "வெளிப்புறச் செயல்களைத் தவிர்த்து உள்ளூர் சுகாதார ஆலோசனைகளைப் பின்பற்றவும்."}};
for(const l of Object.keys(ACCURACY_I18N))Object.assign(I18N[l],ACCURACY_I18N[l]);
const band=(a,index='us')=>!Number.isFinite(a)?-1:a<=50?0:a<=100?1:index!=='my'&&a<=150?2:a<=200?3:a<=300?4:5;
const color=(a,index='us')=>(index==='my'?MY_COLORS:COLORS)[band(a,index)]||'#62746a';
const indexLabel=d=>t(d?.index==='my'?'myapi':'usaqi');
const stationKey=d=>(d.index||'us')+':'+d.uid;
const quality=d=>{
 if(!Number.isFinite(d?.aqi))return 'unknown';
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
const latestForecast=d=>{const offset=/^([+-])(\\d\\d):(\\d\\d)$/.exec(d?.timezone||'');const minutes=offset?(+offset[2]*60 + +offset[3])*(offset[1]==='-'?-1:1):0;const today=new Date(Date.now()+minutes*60000).toISOString().slice(0,10);return (d?.forecast||[]).filter(x=>x.day>=today&&Number.isFinite(x.avg)).sort((a,b)=>a.day.localeCompare(b.day))};
const alertTransition=__ALERT_TRANSITION__;
let viewportStations=[],viewportHasSnapshot=false,lastAreaTime=0;
let current=null,stations=[],userLocation=null,searchLocation=null,map=null,userMarker=null,accuracyCircle=null;
let activeView='now',requestMode='home',selection=null,loading=false,loadError='',lastSuccess=0,lastAttempt=0;
let detailController,detailSequence=0,mapController,mapSequence=0,areaSequence=0,locationSequence=0,searchController,searchSequence=0;
let mapTimer,refreshTimer,lastMapKey='',lastMapTime=0,backgroundReady=false,serviceRegistration=null,geoBusy=false;
// Only an explicit location/city/station action supersedes a pending location request.
let locationIntent=0,locationError='';
const validPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const markers=new Map(),baseline=new Map(),scrollPositions={};
const indexQuery=()=>{const country=searchLocation?.country||userLocation?.country;return '&index='+settings.index+(country?'&country='+encodeURIComponent(country):'')};
const mapHint=()=>{const list=viewportHasSnapshot?viewportStations:stations;return list.length&&list.every(s=>s.index==='my')?t('myMap'):t('mapHint')};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
async function requestJSON(path,signal,timeout=12000){
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();
 const timer=setTimeout(abort,timeout);
 try{const r=await fetch(path,{signal:controller.signal,cache:'no-store'});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||t('dataError')),{status:r.status});if(Array.isArray(data)&&r.headers.get('x-airly-degraded'))data.degraded=true;return data}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
function applyI18n(){
 document.documentElement.lang=lang;document.body.classList.toggle('lang-ta',lang==='ta');
 $$('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('#sinput').placeholder=t('searchPh');
 $('#map-hint').textContent=mapHint();$('#lang').value=lang;
 const labels={'#open-search':'searchAction','#lang':'languageLabel','#open-settings':'settingsBtn','#location':'locationAction','#refresh':'refreshAction','#location-notice':'locationAccuracy','.map-wrap':'mapLabel','#locate':'centreMap','#card':'dashboardLabel','.tabs':'viewsLabel','#close':'closeSettings','#sclose':'closeSearch'};for(const [selector,key]of Object.entries(labels))$(selector).setAttribute('aria-label',t(key));
 $('#smodal label').textContent=t('cityName');
}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4500)}
function advice(a,index='us'){
 const i=band(a,index);if(i<0)return [t('noData'),t('unavailableAdvice')];
 if(index==='my')return [t('lvl'+i),t('myAdvice'+i)];
 if(i===5)return [t('adv4T'),({en:'Everyone should avoid outdoor physical activity. Stay inside with cleaner air and follow local health advisories.',ms:'Semua orang perlu elakkan aktiviti fizikal di luar. Kekal di dalam dengan udara bersih dan ikut nasihat kesihatan tempatan.',ta:'வெளிப்புற உடற்பயிற்சியை அனைவரும் தவிர்க்கவும். சுத்தமான உட்புறக் காற்றில் இருந்து உள்ளூர் சுகாதார ஆலோசனைகளைப் பின்பற்றவும்.',zh:'所有人应避免户外体力活动，留在空气较清洁的室内并遵循当地健康建议。'})[lang]];
 return [t('adv'+Math.min(i,4)+'T'),t('adv'+Math.min(i,4)+((i===1||i===2)&&settings.sensitive?'Bs':'B'))]
}
function connectionText(){
 if(navigator.onLine===false)return t('offline');
 if(loading)return t('fetching')+'…';
 if(loadError)return t('retry');
 return lastSuccess?t('checked')+' '+new Date(lastSuccess).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'}):t('loading')+'…';
}
function render(){
 $('#connection').textContent=connectionText();$('#refresh').classList.toggle('spin',loading);$('#refresh').disabled=loading;
 $('#place').textContent=searchLocation?.name||userLocation?.label||t('findingArea');
 const source=searchLocation?'city':userLocation?.source;
 $('#place-meta').textContent=geoBusy?t('locating'):source==='gps'?t(locationError?'lastDeviceLocation':'deviceLocation')+' · ±'+Math.round(userLocation.accuracy||0)+' m':source==='city'?t('chosenCity'):source==='ip'?t('approxLabel'):source==='default'?t('defaultLabel'):t('locationAction');
 $('#location').disabled=geoBusy;$('#use-location').disabled=geoBusy;
 $('#location-notice').hidden=!locationError&&(!!searchLocation||!userLocation||(source==='gps'&&!userLocation.approx));
 $('#location-explanation').textContent=locationError?t(locationError):source==='default'?t('defaultNotice'):source==='gps'?t('geoCoarse'):t('ipNotice');
 $('#use-location').textContent=t(geoBusy?'locating':'locationAction');
 $('#place').title=searchLocation?.region|| (userLocation?.accuracy?t('locationPrecision')+' ±'+Math.round(userLocation.accuracy)+' m':userLocation?.approx?t('approxLabel'):'');
 const now=$('#now'),scroll=$('#card').scrollTop,open=now.querySelector('details')?.open;
 if(!current){
  now.innerHTML='<div class="empty"><p class="eyebrow">Airly by Ordinexis</p><h1>'+esc(loading?t('loading'):t('noData'))+'</h1><p>'+esc(loading?t('loadingB'):loadError||t('dataError'))+'</p>'+(loading?'<div class="skeleton"></div><div class="skeleton score-load"></div><div class="skeleton"></div>':'<button class="primary" id="retry">'+esc(t('retry'))+'</button>')+'</div>';
  $('#retry')?.addEventListener('click',()=>refresh(true));
 }else{
  const q=quality(current),valid=Number.isFinite(current.aqi),[title,body]=advice(current.aqi,current.index),c=color(current.aqi,current.index),my=current.index==='my',bands=my?[0,1,3,4,5]:[0,1,2,3,4,5];
  const status=current.detail===false?t('stationLoading'):loadError?t(navigator.onLine===false?'offline':'failed'):t(q==='fresh'?'fresh':q==='stale'?'stale':'unknownTime');
  const origin=searchLocation||(userLocation?.source==='default'?null:userLocation),d=haversine(origin,current);
  const attribution=(current.attribution||[]).map(a=>'<a href="'+safeUrl(a.url)+'" target="_blank" rel="noopener noreferrer">'+esc(a.name)+'</a>').join(' · ');
  now.innerHTML='<div class="reading-hero" style="--reading-color:'+c+'"><div class="live" data-quality="'+(loadError?'stale':q)+'"><span class="status-dot"></span><span>'+esc(status)+(current.time?' · '+esc(ageText(current.time)):'')+'</span></div>'+
   '<p class="eyebrow">'+esc(t(requestMode==='home'?'matched':'selected'))+'</p><h1 class="station-name">'+esc(current.name)+'</h1>'+
   '<p class="distance">'+(d===null?esc(t('spatialNote')):esc(origin.approx?(d<1?'<1 km':'≈ '+Math.round(d)+' km'):distanceText(d))+' '+esc(t(searchLocation?'fromCity':origin.approx?'fromArea':'fromDevice')))+'</p>'+
   '<div class="score"><strong style="color:'+c+'">'+(valid?current.aqi:'—')+'</strong><span><b>'+esc(valid?t('lvl'+band(current.aqi,current.index)):t('noData'))+'</b>'+esc(indexLabel(current))+'</span></div>'+
   '<div class="aqi-scale" style="grid-template-columns:repeat('+bands.length+',1fr)" aria-label="'+esc(indexLabel(current))+' '+esc(t('scaleLabel'))+'">'+bands.map(i=>'<i title="'+esc(t('lvl'+i))+'" class="'+(i===band(current.aqi,current.index)?'active':'')+'" style="background:'+(my?MY_COLORS:COLORS)[i]+'"></i>').join('')+'</div></div>'+
   '<p class="notice">'+esc(t(my?'methodMY':'methodUS'))+'</p>'+
   (q!=='fresh'?'<p class="notice">'+esc(t(q==='stale'?'olderNote':'noTimeNote'))+'</p>':'')+
   '<div class="advice" style="border-color:'+c+'"><h2>'+esc(q==='fresh'?title:t('details'))+'</h2><p>'+esc(q==='fresh'?body:t('unavailableAdvice'))+'</p></div>'+
   (my?'<div class="metrics" style="grid-template-columns:1fr 1fr"><div class="metric"><span>'+esc(t('myMetrics'))+'</span><b>'+esc(current.dominant||'—')+'</b></div><div class="metric"><span>'+esc(t('mySource'))+'</span><b>DOE</b><small>'+esc(current.stationCode||'APIMS')+'</small></div></div>':'<div class="metrics"><div class="metric"><span>PM2.5</span><b>'+(current.pm25??'—')+'</b><small>'+esc(t('subindex'))+'</small></div><div class="metric"><span>'+esc(t('humidity'))+'</span><b>'+(current.humidity??'—')+'</b><small>%</small></div><div class="metric"><span>'+esc(t('wind'))+'</span><b>'+(current.wind??'—')+'</b><small>m/s</small></div></div>')+
   '<details class="reading-details"'+(open?' open':'')+'><summary>'+esc(t('details'))+'</summary><p>'+esc(t('updated'))+': '+esc(dateText(current.time))+'</p><p>'+esc(t(my?'myNote':'indexNote'))+'</p><p>'+esc(t('spatialNote'))+'</p>'+
   '<div class="pollutants">'+Object.entries(current.pollutants||{}).filter(([k,v])=>v!==null).map(([k,v])=>'<span>'+esc(({pm25:'PM2.5',pm10:'PM10',o3:'O₃',no2:'NO₂',so2:'SO₂',co:'CO'})[k]||k)+' <b>'+v+'</b></span>').join('')+'</div>'+
   (current.dominant?'<p>'+esc(t('dominantLabel'))+': '+esc(current.dominant.toUpperCase().replace('PM25','PM2.5'))+'</p>':'')+
   (current.temperature!==null&&current.temperature!==undefined?'<p>'+current.temperature+' °C</p>':'')+
   '<p>'+esc(t(my?'myGuide':'advisorySource'))+' <a href="'+(my?'https://www.doe.gov.my/wp-content/uploads/2021/09/API_Calculation.pdf':'https://www.airnow.gov/aqi/aqi-basics/')+'" target="_blank" rel="noopener noreferrer">'+(my?'DOE Malaysia':'AirNow')+'</a></p>'+
   (attribution?'<p>'+esc(t('reportFrom'))+': '+attribution+'</p>':'')+'</details>';
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
  await checkAlert(next);
  // The detail endpoint is authoritative; replace, rather than mixing it with the map summary.
  const i=stations.findIndex(s=>s.uid===next.uid);if(i<0)stations.push(next);else stations[i]=next;
 }catch(e){if(seq!==detailSequence)return;loadError=navigator.onLine===false?t('offline'):e.message||t('dataError')}
 finally{if(seq===detailSequence){loading=false;render();scheduleRefresh()}}
}
function selectStation(s){
 locationSequence++;locationIntent++;locationError='';
 requestMode='station';selection={uid:s.uid,lat:s.lat,lon:s.lon};
 loadReading('uid='+encodeURIComponent(s.uid),s);
 if(activeView!=='map')showTab('now');
}
async function refresh(force=false){
 if(!force&&(document.hidden||loading||navigator.onLine===false))return;
 if(force&&requestMode==='home'){await locate();return}
 if(requestMode==='station'&&selection?.uid)await loadReading('uid='+selection.uid);
 else{const p=searchLocation||userLocation||{lat:3.139,lon:101.687};await loadReading('lat='+p.lat+'&lon='+p.lon+indexQuery())}
 await loadArea(originPoint(),locationSequence);
 if(map&&(activeView==='map'||innerWidth>820))loadViewport(true);
 if(activeView==='news')loadNews();
}
function scheduleRefresh(){clearTimeout(refreshTimer);if(!document.hidden&&navigator.onLine!==false)refreshTimer=setTimeout(()=>refresh(),loadError?60000:300000)}
async function checkAlert(d){
 if(!settings.browser||(settings.background&&settings.backgroundStation===stationKey(d))||quality(d)!=='fresh')return;
 const key=stationKey(d),previous=baseline.get(key),next=alertTransition(previous,d.aqi,Date.parse(d.time),settings.delta);
 if(!next)return;
 if(next.notify&&!await notifyChange(d,previous.aqi)){baseline.set(key,{...previous,seen:next.seen});return}
 baseline.set(key,next);
}
async function notifyChange(d,old){
 if(typeof Notification==='undefined'||Notification.permission!=='granted')return false;
 const dir=d.aqi>old?'rose':'fell',options={body:d.name+': '+indexLabel(d)+' '+t(dir)+' '+Math.abs(d.aqi-old)+' → '+d.aqi+'.',tag:'airly-'+stationKey(d),icon:'/icon-180.png'};
 try{if(serviceRegistration)await serviceRegistration.showNotification('Airly by Ordinexis',options);else new Notification('Airly by Ordinexis',options);return true}catch{return false}
}
let mapLoading=false;
function loadMap(){
 if(mapLoading||map)return;mapLoading=true;
 const script=document.createElement('script');script.src='/vendor/leaflet.js';script.async=true;
 const failed=()=>{mapLoading=false;script.remove();$('#map').innerHTML='<button class="secondary" id="map-retry">'+esc(t('mapUnavailable'))+' · '+esc(t('retry'))+'</button>';$('#map-retry').onclick=loadMap};
 const timer=setTimeout(failed,12000);
 script.onerror=()=>{clearTimeout(timer);failed()};
 script.onload=()=>{clearTimeout(timer);mapLoading=false;initMap();if(map){centreMap(originPoint());drawUser();updateMarkers()}};
 document.head.append(script);
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
 if(!map)return;
 if(userMarker)map.removeLayer(userMarker);if(accuracyCircle)map.removeLayer(accuracyCircle);
 const p=userLocation;if(!p||p.source==='default'){userMarker=null;accuracyCircle=null;return}
 userMarker=L.marker([p.lat,p.lon],{interactive:false,keyboard:false,zIndexOffset:1000,icon:L.divIcon({className:'',html:'<div class="user-dot'+(p.approx?' approximate':'')+'"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
 if(p.accuracy>0)accuracyCircle=L.circle([p.lat,p.lon],{radius:p.accuracy,color:'#257bc2',weight:1,fillOpacity:.07,interactive:false}).addTo(map);
}
function updateMarkers(){
 if(!map)return;
 const center=map.getCenter(),origin={lat:center.lat,lon:center.lng},bounds=map.getBounds().pad(.15);
 const list=(viewportHasSnapshot?viewportStations:stations).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&bounds.contains([s.lat,s.lon])).sort((a,b)=>haversine(origin,a)-haversine(origin,b)).slice(0,120);
 if(current&&Number.isFinite(current.lat)&&Number.isFinite(current.lon)){const i=list.findIndex(s=>s.uid===current.uid);if(i<0)list.push(current);else list[i]=current}
 const seen=new Set();
 for(const s of list){
  const key=s.uid;seen.add(key);const active=key===current?.uid,signature=s.aqi+'|'+s.index+'|'+active+'|'+s.lat+'|'+s.lon+'|'+lang+'|'+quality(s)+'|'+s.time;
  let entry=markers.get(key);
  if(!entry){
   const marker=L.marker([s.lat,s.lon],{title:s.name+' · '+(Number.isFinite(s.aqi)?indexLabel(s)+' '+s.aqi:t('checkReading'))}).addTo(map);
   entry={marker,station:s,signature:''};markers.set(key,entry);marker.on('click',()=>selectStation(entry.station));
  }
  entry.station=s;
  if(signature!==entry.signature){
   entry.marker.setLatLng([s.lat,s.lon]).setIcon(L.divIcon({className:'',html:'<div class="map-bubble'+(active?' active':'')+'" style="--aqi:'+color(s.aqi,s.index)+'">'+(s.aqi??'—')+'</div>',iconSize:[38,34],iconAnchor:[19,43]})).setZIndexOffset(active?500:0);
   entry.marker.unbindTooltip().bindTooltip(esc(s.name)+' · '+(Number.isFinite(s.aqi)?esc(indexLabel(s))+' '+s.aqi+' · '+esc(t(quality(s)))+' · '+esc(ageText(s.time)):esc(t('checkReading'))),{direction:'top'});entry.signature=signature;
  }
 }
 for(const [key,e]of markers)if(!seen.has(key)){map.removeLayer(e.marker);markers.delete(key)}
}
async function loadViewport(force=false){
 if(!map||document.hidden||(innerWidth<=820&&activeView!=='map'))return;
 const b=map.getBounds(),c=map.getCenter(),lat=Math.max(-85,Math.min(85,c.lat)),lon=((c.lng+180)%360+360)%360-180;
 const dy=Math.min(19,(b.getNorth()-b.getSouth())/2),dx=Math.min(29,(b.getEast()-b.getWest())/2);
 const south=Math.max(-85,lat-dy),north=Math.min(85,lat+dy),west=lon-dx,east=lon+dx;
 const ranges=west< -180?[[west+360,180],[-180,east]]:east>180?[[west,180],[-180,east-360]]:[[west,east]];
 const boxes=ranges.map(([w,e])=>[south,w,north,e].map(x=>+x.toFixed(4))).filter(b=>b[0]<b[2]&&b[1]<b[3]);
 const cacheKey=JSON.stringify(boxes)+indexQuery();if(!force&&cacheKey===lastMapKey&&Date.now()-lastMapTime<300000){updateMarkers();return}
 const seq=++mapSequence;mapController?.abort();mapController=new AbortController();
 try{
  const results=await Promise.all(boxes.map(box=>requestJSON('/api/air?scope=area&bbox='+box.join(',')+indexQuery(),mapController.signal)));
  if(seq!==mapSequence||results.some(r=>!Array.isArray(r)))return;
  lastMapKey=cacheKey;lastMapTime=Date.now();viewportHasSnapshot=true;
  viewportStations=[...new Map(results.flat().map(s=>[stationKey(s),s])).values()].slice(0,600);
  $('#map-hint').textContent=mapHint();updateMarkers();
 }catch(e){if(seq===mapSequence)$('#map-hint').textContent=t('mapFailed')}
}

function originPoint(){return searchLocation||userLocation||selection||{lat:3.139,lon:101.687}}
async function loadArea(p,seq){
 const areaSeq=++areaSequence;
 try{const inc=await requestJSON('/api/air?scope=area&lat='+p.lat+'&lon='+p.lon+indexQuery());
 if(seq!==locationSequence||areaSeq!==areaSequence||!Array.isArray(inc))return;lastAreaTime=Date.now();stations=inc;if(current?.detail){const i=stations.findIndex(s=>s.uid===current.uid);if(i<0)stations.push(current);else if(!stations[i].time||Date.parse(current.time)>=Date.parse(stations[i].time))stations[i]=current;}
 updateMarkers();if(activeView==='nearby')renderNearby()}catch{if(seq===locationSequence&&activeView==='nearby')$('#nearby').innerHTML='<div class="panel"><p class="notice">'+esc(t('dataError'))+'</p></div>'}
}
async function useArea(p,mode='home'){
 if(!validPoint(p))return;
 locationIntent++;
 if(mode==='search')locationError='';
 const seq=++locationSequence;selection=null;requestMode=mode;loadError='';current=null;stations=[];viewportStations=[];viewportHasSnapshot=false;lastAreaTime=0;lastMapKey='';mapSequence++;mapController?.abort();
 if(mode==='home'){userLocation=p;searchLocation=null;drawUser()}else searchLocation=p;
 render();if(map){map.setView([p.lat,p.lon],10,{animate:false});}
 loadArea(p,seq);await loadReading('lat='+p.lat+'&lon='+p.lon+indexQuery());
 if(seq===locationSequence){newsSeq++;newsController?.abort();newsCache=null;newsTime=0;newsLocale='';if(activeView==='news')loadNews(true)}
}
async function ipLocate(intent=locationIntent){
 let p;
 try{p=await requestJSON('/api/location');if(!validPoint(p))throw Error('Invalid IP location');p={...p,source:'ip',approx:true,label:[p.city,p.region].filter(Boolean).join(', ')||p.country||t('approxLabel')}}
 catch{p={lat:3.139,lon:101.687,source:'default',approx:true,label:t('defaultArea')}}
 // A delayed IP response must never replace GPS or a city the user selected.
 if(intent!==locationIntent)return;
 await useArea(p);
}
function locate(){
 if(geoBusy)return Promise.resolve();
 const intent=++locationIntent;geoBusy=true;locationError='';render();
 return new Promise(resolve=>{
  const failure=async error=>{
   geoBusy=false;if(intent!==locationIntent){render();resolve();return}
   locationError=error?.code===1?'locBlocked':error?.code===3?'geoTimeout':'geoUnavailable';render();
   if(!userLocation&&!searchLocation)await ipLocate(intent);
   else if(requestMode==='home'){const p=userLocation;await loadReading('lat='+p.lat+'&lon='+p.lon+indexQuery())}
   render();resolve();
  };
  if(!navigator.geolocation){failure({code:2});return}
  navigator.geolocation.getCurrentPosition(async position=>{
   geoBusy=false;if(intent!==locationIntent){render();resolve();return}
   const p={lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy,source:'gps',approx:position.coords.accuracy>10000,label:t('deviceLocation')};
   if(!validPoint(p)){await failure({code:2});return}
   locationError='';storage.set('airly-city',null);
   try{const resolved=await requestJSON('/api/location?lat='+p.lat+'&lon='+p.lon);p.country=resolved.country||''}catch{p.country=''}
   if(intent!==locationIntent){resolve();return}
   await useArea(p);if(requestMode==='home')centreMap(userLocation);resolve();
  },failure,{enableHighAccuracy:true,timeout:20000,maximumAge:0});
 });
}
let locationStarting=false;
async function initializeLocation(){
 // A fresh visit or return to the app always starts at the device. Only the
 // old location selection is discarded; language, alerts and index stay saved.
 if(locationStarting||geoBusy)return;
 locationStarting=true;
 const intent=++locationIntent;
 storage.set('airly-city',null);
 clearTimeout(refreshTimer);
 locationSequence++;detailSequence++;areaSequence++;mapSequence++;
 detailController?.abort();mapController?.abort();newsController?.abort();newsSeq++;
 selection=null;searchLocation=null;userLocation=null;requestMode='home';
 current=null;stations=[];viewportStations=[];viewportHasSnapshot=false;
 lastAreaTime=0;lastMapKey='';loadError='';locationError='';loading=true;
 newsCache=null;newsTime=0;newsLocale='';
 drawUser();render();
 try{
  let permission;
  try{permission=await navigator.permissions?.query({name:'geolocation'})}catch{}
  // A city explicitly chosen during initialization wins for this visit.
  if(intent!==locationIntent)return;
  if(permission?.state==='denied'){locationError='locBlocked';await ipLocate(intent);return}
  await locate();
 }finally{locationStarting=false}
}
function renderNearby(){
 const origin=originPoint(),list=stations.filter(s=>haversine(origin,s)!==null).sort((a,b)=>haversine(origin,a)-haversine(origin,b)).slice(0,30);
 $('#nearby').innerHTML='<div class="panel"><h2>'+esc(t('nearbyT'))+'</h2><p>'+esc(t('nearbyS'))+'</p>'+(!list.length?'<p>'+esc(t('nearbyEmpty'))+'</p>':list.map((s,i)=>'<button class="row" data-station="'+i+'"><span class="badge" style="background:'+color(s.aqi,s.index)+'">'+(s.aqi??'—')+'</span><span class="row-text"><b>'+esc(s.name)+'</b><small>'+(origin.approx?(haversine(origin,s)<1?'<1 km':'≈ '+Math.round(haversine(origin,s))+' km'):distanceText(haversine(origin,s)))+' · '+esc(indexLabel(s))+' · '+esc(t(Number.isFinite(s.aqi)?'lvl'+band(s.aqi,s.index):'checkReading'))+' · '+esc(t(quality(s)))+' · '+esc(ageText(s.time))+'</small></span>'+icon('arrow')+'</button>').join(''))+'</div>';
 $$('#nearby [data-station]').forEach(b=>b.onclick=()=>selectStation(list[+b.dataset.station]));
}
let newsCache=null,newsTime=0,newsLocale='',newsController,newsSeq=0;
function newsQuery(){const point=searchLocation||userLocation,p=new URLSearchParams({locale:settings.locale==='AUTO'?(point?.country||'AUTO'):settings.locale,location:'resolved'});if(settings.locale==='AUTO'&&searchLocation?.name)p.set('city',searchLocation.name);return p.toString()}

async function loadNews(force=false){
 const query=newsQuery();if(!force&&newsCache&&newsLocale===query&&Date.now()-newsTime<900000){renderNews(newsCache);return}
 const seq=++newsSeq;newsController?.abort();newsController=new AbortController();
 if(!newsCache||newsLocale!==query)$('#news').innerHTML='<div class="panel"><h2>'+esc(t('newsT'))+'</h2><div class="skeleton"></div><div class="skeleton"></div></div>';
 try{const items=await requestJSON('/api/news?'+query+(force?'&fresh=1':''),newsController.signal);if(seq!==newsSeq)return;if(!Array.isArray(items))throw Error();newsCache=items;newsTime=Date.now();newsLocale=query;renderNews(items,!!items.degraded)}
 catch{if(seq===newsSeq)renderNews(newsLocale===query?(newsCache||[]):[],true)}
}
function renderNews(items,failed=false){
 $('#news').innerHTML='<div class="panel"><div class="panelhead"><h2>'+esc(t('newsT'))+'</h2><button class="icon-button" id="news-refresh" aria-label="'+esc(t('refreshNews'))+'">'+icon('refresh')+'</button></div><p>'+esc(t('newsS'))+'</p>'+(failed?'<p class="notice">'+esc(t('newsFailed'))+'</p>':'')+(items.length?items.map(x=>'<a class="story" href="'+safeUrl(x.link)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(x.source)+'</span><b>'+esc(x.title)+'</b><small>'+esc(Number.isFinite(Date.parse(x.published))?dateText(x.published):'')+'</small></a>').join(''):'<p>'+esc(t('nonews'))+'</p>')+'</div>';$('#news-refresh').onclick=()=>loadNews(true);
}
function renderTrend(){
 if(current?.index==='my'){$('#trend').innerHTML='<div class="panel"><h2>'+esc(t('forecastTab'))+'</h2><p>'+esc(t('myForecast'))+'</p></div>';return}
 const f=latestForecast(current);
 if(!f.length){$('#trend').innerHTML='<div class="panel"><h2>'+esc(t('trendT'))+'</h2><p>'+esc(t('noForecast'))+'</p></div>';return}
 const max=Math.max(50,...f.map(x=>x.max??x.avg)),w=340,h=155,step=300/f.length,y=v=>125-v/max*100;
 const bars=f.map((x,i)=>{const cx=20+step*(i+.5),min=x.min??x.avg,max=x.max??x.avg;return '<line x1="'+cx+'" x2="'+cx+'" y1="'+y(max)+'" y2="'+y(min)+'" stroke="'+color(x.avg)+'" stroke-width="8" opacity=".3" stroke-linecap="round"/><circle cx="'+cx+'" cy="'+y(x.avg)+'" r="4" fill="'+color(x.avg)+'"/><text x="'+cx+'" y="'+(y(max)-10)+'" text-anchor="middle" font-size="12" fill="'+color(x.avg)+'">'+x.avg+'</text><text x="'+cx+'" y="149" text-anchor="middle" font-size="11" fill="#56665f">'+esc(new Date(x.day+'T12:00:00').toLocaleDateString(lang,{weekday:'short'}))+'</text>'}).join('');
 $('#trend').innerHTML='<div class="panel"><h2>'+esc(t('trendT'))+'</h2><p>'+esc(current.name)+'</p><svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(t('forecastLabel'))+'">'+bars+'</svg><p>'+esc(t('forecastNote'))+'</p><div class="forecast-row"><b>'+esc(t('date'))+'</b><b>'+esc(t('range'))+'</b><b>'+esc(t('average'))+'</b></div>'+f.map(x=>'<div class="forecast-row"><b>'+esc(new Date(x.day+'T12:00:00').toLocaleDateString(lang,{month:'short',day:'numeric'}))+'</b><span>'+(x.min??'—')+'–'+(x.max??'—')+'</span><b style="color:'+color(x.avg)+'">'+x.avg+'</b></div>').join('')+'<p style="margin-top:16px">'+esc(t('trendSrc'))+'</p></div>';
}
function showTab(view){
 scrollPositions[activeView]=$('#card').scrollTop;activeView=view;$('.app').dataset.view=view;
 $$('.tabs button').forEach(b=>{const on=b.dataset.tab===view;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1});
 ['now','nearby','news','trend'].forEach(id=>$('#'+id).hidden=id!==(view==='map'?'now':view));
 if(view==='nearby'){renderNearby();if(Date.now()-lastAreaTime>=300000)loadArea(originPoint(),locationSequence)}if(view==='news')loadNews();if(view==='trend')renderTrend();
 $('#card').scrollTop=scrollPositions[view]||0;
 if(view==='map'){requestAnimationFrame(()=>{map?.invalidateSize({pan:false});loadViewport()})}
}
let focusReturn=null,openOverlay=null;
function openModal(id){
 focusReturn=document.activeElement;openOverlay=$('#'+id);openOverlay.hidden=false;
 for(const child of $('.app').children)if(child!==openOverlay)child.inert=true;
 if(id==='modal'){syncSettings();$('#close').focus()}else{$('#sinput').focus()}
}
function closeModal(){
 if(!openOverlay)return;openOverlay.hidden=true;openOverlay=null;for(const child of $('.app').children)child.inert=false;focusReturn?.focus();
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
   await enablePush(next);next.backgroundStation=stationKey(current);storage.set('airly-push-renewed',Date.now())
  }else if(settings.background){await disablePush()}
  const localeChanged=settings.locale!==next.locale;settings=next;baseline.clear();
  if(current)await checkAlert(current);
  const persisted=storage.set('airly-settings',settings);closeModal();render();if(indexChanged){const p=originPoint(),mode=searchLocation?'search':'home';await useArea(p,mode)}if(localeChanged&&activeView==='news')loadNews(true);if($('#toast').hidden)toast(t(persisted?'saved':'notSaved'));
 }catch{toast(t('bgFailed'))}finally{button.disabled=false}
}
async function enablePush(next){
 await getPushRegistration();if(!current?.uid)throw Error('Select a station first');
 const kj=await requestJSON('/api/push/key');if(!kj.key)throw Error('Unavailable');
 const dec=v=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4)),c=>c.charCodeAt(0));
 let sub=await serviceRegistration.pushManager.getSubscription();if(!sub)sub=await serviceRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:dec(kj.key)});
 const response=await fetch('/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...sub.toJSON(),uid:current.uid,lat:current.lat,lon:current.lon,delta:next.delta,lang})});
 if(!response.ok)throw Error('Could not save');storage.set('airly-push-endpoint',sub.endpoint);
}
async function getPushRegistration(){
 if(serviceRegistration)return serviceRegistration;
 if(!('serviceWorker' in navigator))throw Error('Service worker unavailable');
 let timer;try{serviceRegistration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Registration unavailable')),10000)})]);return serviceRegistration}finally{clearTimeout(timer)}
}
async function disablePush(){
 const registration=await getPushRegistration(),sub=await registration.pushManager.getSubscription();
 // The endpoint is saved as a cleanup receipt; it is never a secret or logged.
 const endpoint=sub?.endpoint||storage.get('airly-push-endpoint');if(!endpoint)return;
 const r=await fetch('/api/push/unsubscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint})});
 const data=await r.json();if(!r.ok||data.ok!==true)throw Error('Could not remove subscription');
 if(sub&&!await sub.unsubscribe())throw Error('Could not remove device subscription');
 storage.set('airly-push-endpoint',null);storage.set('airly-push-renewed',null);
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
$('#locate').onclick=()=>{if(requestMode==='home')locate();else centreMap(searchLocation||selection)};
$('#use-location').onclick=locate;$('#choose-city').onclick=()=>openModal('smodal');$('#map-reading').onclick=()=>showTab('now');
$('#lang').onchange=e=>{lang=e.target.value;settings.lang=lang;storage.set('airly-settings',settings);applyI18n();render();if(activeView==='news'&&newsCache)renderNews(newsCache)};
$$('.tabs button').forEach(b=>{
 b.onclick=()=>showTab(b.dataset.tab);
 b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=$$('.tabs button').filter(el=>el.getClientRects().length);const index=buttons.indexOf(b),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;showTab(buttons[next].dataset.tab);buttons[next].focus()};
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(refreshTimer);return}initializeLocation()});
window.addEventListener('pageshow',event=>{if(event.persisted&&!document.hidden)initializeLocation()});
window.addEventListener('offline',()=>{clearTimeout(refreshTimer);loadError=t('offline');render()});
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
applyI18n();loading=true;render();loadMap();
const locationReady=initializeLocation();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(r=>{serviceRegistration=r}).catch(()=>{});
const configReady=requestJSON('/api/config').then(c=>{backgroundReady=!!c.backgroundPush&&'PushManager' in window;syncSettings()}).catch(()=>syncSettings());
Promise.all([locationReady,configReady]).then(async()=>{
 try{
  if(!settings.background&&storage.get('airly-push-endpoint'))await disablePush();
  else if(settings.background&&backgroundReady&&current&&Date.now()-(storage.get('airly-push-renewed')||0)>86400000){await enablePush(settings);storage.set('airly-push-renewed',Date.now())}
 }catch{toast(t('bgFailed'))}
});

</script></body></html>`;
