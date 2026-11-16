#!/usr/bin/env python3
"""Build a simple land outline for the map's offline background from Natural Earth (public domain).

Source: ne_50m_land.geojson from https://github.com/nvkelso/natural-earth-vector. Needs shapely.
Usage: build_land.py ne_50m_land.geojson OUT.json
"""
import json, sys
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union

frame = box(5, 20, 56, 48)
land = unary_union([shape(f["geometry"]).buffer(0) for f in json.load(open(sys.argv[1], encoding="utf-8"))["features"]
                    if shape(f["geometry"]).intersects(frame)]).intersection(frame).simplify(0.03)
geo = mapping(land)
def rnd(x):
    return [rnd(v) for v in x] if isinstance(x, (list, tuple)) else round(x, 2)
json.dump({"type": geo["type"], "coordinates": rnd(geo["coordinates"])}, open(sys.argv[2], "w"), separators=(",", ":"))
