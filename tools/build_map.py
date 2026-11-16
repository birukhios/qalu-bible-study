#!/usr/bin/env python3
"""Build the three outline maps used on the Map screen from Natural Earth data (public domain).

Source files (https://github.com/nvkelso/natural-earth-vector, geojson/): ne_50m_land, ne_10m_land,
ne_10m_lakes, ne_10m_rivers_lake_centerlines. Needs the shapely package.
Output: one JSON file with, for each map, its size, bounding box and SVG path data for land, lakes and rivers.
Usage: build_map.py NATURAL_EARTH_DIR OUT.json
"""
import json, math, sys
from shapely.geometry import shape, box
from shapely.ops import unary_union

MAPS = {
    # name: (west, south, east, north, land file, simplify tolerance in degrees, minimum lake area in square degrees)
    "wide": (9.0, 25.5, 51.5, 44.5, "ne_50m_land", 0.03, 0.02),
    "land": (33.7, 30.8, 36.7, 33.8, "ne_10m_land", 0.003, 0.0),
    "judea": (34.8, 31.5, 35.65, 32.05, "ne_10m_land", 0.001, 0.0),
}
RIVERS = ("Nile", "Euphrates", "Tigris", "Jordan")
WIDTH = 1000


def load(folder, name):
    return json.load(open(f"{folder}/{name}.geojson", encoding="utf-8"))["features"]


def main(folder, out):
    lakes = load(folder, "ne_10m_lakes")
    rivers = load(folder, "ne_10m_rivers_lake_centerlines")
    result = {}
    for name, (w, s, e, n, land_file, tol, min_lake) in MAPS.items():
        frame = box(w, s, e, n)
        k = WIDTH / ((e - w) * math.cos(math.radians((s + n) / 2)))       # pixels per degree of latitude
        kx = k * math.cos(math.radians((s + n) / 2))
        height = round((n - s) * k)

        def pt(lon, lat):
            return f"{(lon - w) * kx:.1f},{(n - lat) * k:.1f}"

        def poly_path(geom):
            parts = []
            for g in getattr(geom, "geoms", [geom]):
                if g.geom_type != "Polygon" or g.is_empty:
                    continue
                for ring in [g.exterior] + list(g.interiors):
                    parts.append("M" + "L".join(pt(x, y) for x, y in ring.coords) + "Z")
            return "".join(parts)

        def line_path(geom):
            parts = []
            for g in getattr(geom, "geoms", [geom]):
                if g.geom_type == "LineString" and not g.is_empty:
                    parts.append("M" + "L".join(pt(x, y) for x, y in g.coords))
            return "".join(parts)

        land = unary_union([shape(f["geometry"]).buffer(0) for f in load(folder, land_file)
                            if shape(f["geometry"]).intersects(frame)]).intersection(frame).simplify(tol)
        lake_geoms = [shape(f["geometry"]).buffer(0) for f in lakes if shape(f["geometry"]).intersects(frame)]
        lake = unary_union([g for g in lake_geoms if g.area >= min_lake]).intersection(frame).simplify(tol / 2)
        river = unary_union([shape(f["geometry"]) for f in rivers
                             if (f["properties"].get("name") or "") in RIVERS and shape(f["geometry"]).intersects(frame)]
                            ).intersection(frame).simplify(tol)
        result[name] = {"w": WIDTH, "h": height, "bbox": [w, s, e, n],
                        "land": poly_path(land), "lakes": poly_path(lake), "rivers": line_path(river)}
        print(name, "height", height, "path sizes", {key: len(result[name][key]) for key in ("land", "lakes", "rivers")})
    json.dump(result, open(out, "w", encoding="utf-8"), separators=(",", ":"))


if __name__ == "__main__":
    main(*sys.argv[1:3])
