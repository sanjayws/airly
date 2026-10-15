"""Rebuild vendored modules from downloaded public-domain Natural Earth and Leaflet files.
Usage: python3 scripts/vendor-data.py /path/to/countries.geojson /path/to/leaflet.js /path/to/leaflet.css
Downloads are deliberately separate; normal builds use the committed modules.
"""
import json, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
def simplify(points, tolerance=0.005):
    if len(points) <= 4:
        return points
    first, last = points[0], points[-1]
    dx, dy = last[0]-first[0], last[1]-first[1]
    length = dx*dx+dy*dy
    distances = []
    for x, y in points[1:-1]:
        t = max(0, min(1, ((x-first[0])*dx+(y-first[1])*dy)/length)) if length else 0
        distances.append((x-first[0]-t*dx)**2+(y-first[1]-t*dy)**2)
    maximum = max(distances)
    if maximum <= tolerance*tolerance:
        return [first,last]
    index = distances.index(maximum)+1
    return simplify(points[:index+1], tolerance)[:-1]+simplify(points[index:], tolerance)

rows = []
features=json.loads(Path(sys.argv[1]).read_text())['features']
if len(sys.argv)>4:
    detailed=json.loads(Path(sys.argv[4]).read_text())['features']
    replacements={f['properties']['ISO_A2_EH']:f for f in detailed if f['properties']['ISO_A2_EH'] in ('MY','SG')}
    features=[replacements.get(f['properties']['ISO_A2_EH'],f) for f in features]
for f in features:
    code = f['properties']['ISO_A2_EH']
    if not isinstance(code,str) or len(code)!=2:
        continue
    g = f['geometry']
    polygons = g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    reduced=[]
    for rings in polygons:
        out=[]
        for ring in rings:
            small=simplify(ring,0.0005 if code in ('MY','SG') else 0.005)
            if len(small)<4: small=ring
            out.append([[round(x,4),round(y,4)] for x,y in small])
        reduced.append(out)
    rows.append([code, f['bbox'], reduced])
(root/'data').mkdir(exist_ok=True)
(root/'data/countries.js').write_text('// Natural Earth 1:50m Admin-0 countries, public domain; see THIRD_PARTY.md.\nexport default '+json.dumps(rows,separators=(',',':'))+';\n')
js=Path(sys.argv[2]).read_text()
js=js.split('//# sourceMappingURL=')[0]
css=Path(sys.argv[3]).read_text()
(root/'data/leaflet.js').write_text('// Leaflet 1.9.4, BSD-2-Clause; see THIRD_PARTY.md.\nexport const leafletJS = '+json.dumps(js)+';\nexport const leafletCSS = '+json.dumps(css)+';\n')
