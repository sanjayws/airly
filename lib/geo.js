import countries from '../data/countries.js';

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [xx, yy] = ring[j];
    if ((y > lat) !== (yy > lat) && lon < (xx - x) * (lat - y) / (yy - y) + x) inside = !inside;
  }
  return inside;
}

// Offline, coordinate-based country resolution. Unknown/offshore positions never
// inherit an ISP country. Generalized boundaries are not a precise border survey.
export function countryAt(lat, lon) {
  if (![lat, lon].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return '';
  for (const [code, [west, south, east, north], polygons] of countries) {
    if (lon < west || lon > east || lat < south || lat > north) continue;
    if (polygons.some(rings => inRing(lon, lat, rings[0]) && !rings.slice(1).some(r => inRing(lon, lat, r)))) return code;
  }
  // Coastlines omit some reclaimed urban land. If no polygon contains the point,
  // use the closest coast within 2 km, never the network country. A land match
  // always wins, including Singapore and countries bordering Malaysia.
  let nearest='',distance=2/111;
  const scale=Math.cos(lat*Math.PI/180);
  for(const [code,[west,south,east,north],polygons] of countries){
    if(lon<west-0.03||lon>east+0.03||lat<south-0.02||lat>north+0.02)continue;
    for(const rings of polygons)for(const ring of rings)for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],dx=(b[0]-a[0])*scale,dy=b[1]-a[1],x=(lon-a[0])*scale,y=lat-a[1],length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,(x*dx+y*dy)/length)):0;
      const d=Math.hypot(x-t*dx,y-t*dy);if(d<distance){distance=d;nearest=code}
    }
  }
  return nearest;
}
