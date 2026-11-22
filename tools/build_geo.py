#!/usr/bin/env python3
"""Build the app's own Bible map data from OpenBible.info's Bible Geocoding Data
(https://github.com/openbibleinfo/Bible-Geocoding-Data, CC BY 4.0).

Writes:
  data/geo/places.json   [[name, lat, lon, kind, confidence], ...]   confidence 0-1000 (OpenBible's vote total for its
                         best identification; under 500 the app marks the place as uncertain)
  data/geo/<book>.json   {chapter: [[place index, [verses]], ...]}   the places each chapter mentions, in order of first mention
Usage: build_geo.py ANCIENT_JSONL
"""
import json, os, sys

OSIS = ("Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer "
        "Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph "
        "Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev").split()
BOOK = {o: i for i, o in enumerate(OSIS)}

places, books = [], [dict() for _ in range(66)]
for line in open(sys.argv[1], encoding='utf-8'):
    r = json.loads(line)
    ident = (r.get('identifications') or [None])[0]
    res = ident and (ident.get('resolutions') or [None])[0]
    if not res or not res.get('lonlat'):
        continue
    lon, lat = map(float, res['lonlat'].split(','))
    name = r['friendly_id'].rstrip(' 0123456789')   # "Bethel 1" -> "Bethel"
    conf = (ident.get('score') or {}).get('vote_total', 0)
    kind = (r.get('types') or ['place'])[0]
    idx = len(places)
    places.append([name, round(lat, 4), round(lon, 4), kind, conf])
    for v in r.get('verses', []):
        b, c, n = v['osis'].split('.')
        if b not in BOOK:
            continue
        ch = books[BOOK[b]].setdefault(int(c), {})
        ch.setdefault(idx, []).append(int(n))

os.makedirs('data/geo', exist_ok=True)
json.dump(places, open('data/geo/places.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
for b, chapters in enumerate(books):
    out = {c: sorted(([i, sorted(set(vs))] for i, vs in ch.items()), key=lambda x: x[1][0]) for c, ch in sorted(chapters.items())}
    json.dump(out, open(f'data/geo/{b}.json', 'w', encoding='utf-8'), separators=(',', ':'))
# Journeys traced from the Biblica Open Bible Maps (used as the reference): each stop is a place name, resolved to
# OpenBible's coordinates (preferring a place the route's own chapters mention), or [name, lat, lon] where the name is
# ambiguous or not in the data.
routes = json.load(open('tools/routes.json', encoding='utf-8'))
key = lambda n: n.lower().replace('-', ' ').replace(' ', '')
for rt in routes:
    near = {i for b, c1, c2 in rt['ch'] for c in range(c1, c2 + 1) for i in books[b].get(c, {})}
    pts = []
    for stop in rt['pts']:
        if isinstance(stop, list):
            pts.append([stop[1], stop[2], stop[0]]); continue
        cands = [i for i, pl in enumerate(places) if key(pl[0]) == key(stop)]
        if not cands:
            sys.exit(f'{rt["id"]}: no place named {stop}')
        best = max(cands, key=lambda i: (i in near, places[i][4]))
        pts.append([places[best][1], places[best][2], places[best][0]])
    rt['pts'] = pts
json.dump(routes, open('data/geo/routes.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
for rt in routes:
    print(rt['id'], ' > '.join(f'{p[2]}({p[0]:.1f},{p[1]:.1f})' for p in rt['pts']))
# The atlas: where each Biblica map belongs on our map (the middle of the places its passages name, regions left out),
# with up to eight of those places for its explanation. Written as [[map id, lat, lon, [place indexes]], ...].
import statistics
atlas = []
for mid, title, refs in json.load(open('data/maps.json', encoding='utf-8')):
    found = []
    for b, c1, c2 in refs:
        chs = range(c1, c2 + 1) if c1 else books[b].keys()
        for c in chs:
            for i in books[b].get(c, {}):
                if i not in found:
                    found.append(i)
    pts = [i for i in found if not any(k in places[i][3] for k in ('region', 'country', 'people', 'nation', 'kingdom'))] or found
    if not pts:
        continue
    lat = statistics.median(places[i][1] for i in pts); lon = statistics.median(places[i][2] for i in pts)
    atlas.append([mid, round(lat, 3), round(lon, 3), found[:8]])
json.dump(atlas, open('data/geo/atlas.json', 'w', encoding='utf-8'), separators=(',', ':'))
print(len(atlas), 'maps placed on the atlas')
print(len(places), 'places;', sum(len(ch) for bk in books for ch in bk.values()), 'chapter mentions')
