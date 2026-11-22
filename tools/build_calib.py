#!/usr/bin/env python3
"""Line up Biblica maps with the real map, from hand-read control points (tools/calib_points.json).

The pictures are north-up, so x is fitted as a straight line in longitude and y as a straight line in Mercator latitude
(least squares). The fit gives the latitude and longitude of the picture's corners, which the app uses to lay the picture
on its map. Writes data/geo/calib.json: { map id: [south, west, north, east] } and prints each fit's error in pixels.
"""
import json, math

def merc(lat): return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
def unmerc(y): return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)
def fit(xs, ys):
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    a = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    return a, my - a * mx

out = {}
for mid, c in json.load(open('tools/calib_points.json')).items():
    if mid.startswith('_'): continue
    W, H = c['size']
    px = [p[0][0] for p in c['pts']]; py = [p[0][1] for p in c['pts']]
    lon = [p[1][1] for p in c['pts']]; my = [merc(p[1][0]) for p in c['pts']]
    ax, bx = fit(lon, px); ay, by = fit(my, py)            # pixel = a * coordinate + b
    err = max(math.hypot(ax * lo + bx - x, ay * m + by - y) for lo, m, x, y in zip(lon, my, px, py))
    west, east = (0 - bx) / ax, (W - bx) / ax
    north, south = unmerc((0 - by) / ay), unmerc((H - by) / ay)
    out[mid] = [round(south, 4), round(west, 4), round(north, 4), round(east, 4)]
    print(mid, 'largest error %.1f px' % err, out[mid])
json.dump(out, open('data/geo/calib.json', 'w'), separators=(',', ':'))
