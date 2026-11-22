#!/usr/bin/env python3
"""Build data/maps.json from the Biblica Open Bible Maps collection on Bible Image Library
(https://bibleimagelibrary.org/collections?id=2), CC BY-SA 4.0, © Biblica, Inc.

Input: the collection's image records as JSON (a list; saved from the collection page). Output, one entry per map:
  [id, title, [[book index, first chapter, last chapter], ...]]   (chapters 0, 0 = the whole book)
Pictures are read from the library's CDN by id: thumb/320/<id>.jpg, thumb/640/<id>.jpg, orig/<id>.pdf.
Usage: build_maps.py RECORDS_JSON
"""
import json, re, sys

books = [b['n'][1] for b in json.load(open('data/content.json', encoding='utf-8'))['books']]
alias = {b.lower(): i for i, b in enumerate(books)}
alias.update({'psalm': 18, 'song of songs': 21, 'song of solomon': 21, 'canticles': 21})


def refs(text):
    out = []
    for part in re.split(r'[;,]\s*(?=[1-3]?\s?[A-Z])', text):
        m = re.match(r'\s*((?:[1-3] )?[A-Za-z ]+?)\s*(\d+)?(?::(\d+)[ab]?)?(?:\s*[-–]\s*(\d+)[ab]?(?::(\d+)[ab]?)?)?\s*$', part)
        if not m or m.group(1).lower() not in alias:
            continue
        b = alias[m.group(1).lower()]
        if not m.group(2):
            out.append([b, 0, 0]); continue
        c1 = int(m.group(2))
        c2 = int(m.group(4)) if m.group(4) and (m.group(5) or not m.group(3)) else c1
        out.append([b, c1, c2])
    return out


rows, missed = [], 0
for r in sorted(json.load(open(sys.argv[1], encoding='utf-8')), key=lambda r: r.get('sort_order') or 0):
    rs = [x for s in (r.get('scriptures') or []) for x in refs(s)]
    if not rs:
        rs = refs(r['title'])
    if not rs:  # general maps: those of Jesus' time go with the Gospels, those of Paul and the early church with Acts
        t = r['title']
        rs = [[b, 0, 0] for b in (39, 40, 41, 42)] if re.search(r'Jesus|Herod|Galilee|Judea', t) else \
             [[43, 0, 0]] if re.search(r'Paul|Christianity|Apostle', t) else []
        missed += not rs
    rows.append([r['id'], r['title'], rs])
json.dump(rows, open('data/maps.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'maps,', missed, 'without a Bible reference')
