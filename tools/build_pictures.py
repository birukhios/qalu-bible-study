#!/usr/bin/env python3
"""Build data/pictures.json from Bible Image Library (https://bibleimagelibrary.org) collections whose images name
Bible passages: Scripture Scenes, Spoken English Bible and Paratext Enhanced Resources (CC BY-SA 4.0 / CC0; © SIL
International and others). Book covers ("Genesis 0") are left out.

Output: [[file, title, description, [[book, first ch, last ch], ...], credit index], ...] plus a list of credits.
The picture is at https://d12do9t5rj179j.cloudfront.net/thumb/<320|640>/<file>.jpg.
Usage: build_pictures.py RECORDS_JSON   ({collection id: [image records]})
"""
import json, re, sys
sys.argv, src = sys.argv[:1], sys.argv[1]
exec(open('tools/build_maps.py').read().split('rows, missed')[0])   # the book names and the refs() parser

seen, rows, credits = set(), [], []
for col in ('1', '11', '3'):
    for r in json.load(open(src, encoding='utf-8')).get(col, []):
        if r['id'] in seen:
            continue
        if re.search(r'Book Cover|Movement \d|^Psalms Book|^Book \d', r['title']):
            continue   # icons and book covers, not scenes
        rs = [x for s in (r.get('scriptures') or []) if not s.strip().endswith(' 0') for x in refs(s)]
        if not rs:
            continue
        seen.add(r['id'])
        file = r['thumb_url_small'].rsplit('/', 1)[1].rsplit('.', 1)[0]
        cr = r.get('copyright_attribution') or r.get('copyright') or ''
        if cr not in credits:
            credits.append(cr)
        desc = re.sub(r'\s+', ' ', r.get('description') or '').strip()
        rows.append([file, r['title'], desc[:240], rs, credits.index(cr)])
rows.sort(key=lambda x: (x[3][0][0], x[3][0][1]))
# Photographs and drawings of places, plants, animals and objects (UBS collections 8 and 9) have no passages; the app
# shows one when its English name appears in the chapter (KJV wording). Only plain English names are kept.
things = []
for col in ('9', '8'):
    for r in json.load(open(src, encoding='utf-8')).get(col, []):
        title = r['title'].strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z' -]{2,30}", title) or r['id'] in seen:
            continue
        seen.add(r['id'])
        file = r['thumb_url_small'].rsplit('/', 1)[1].rsplit('.', 1)[0]
        cr = r.get('copyright_attribution') or r.get('copyright') or ''
        if cr not in credits:
            credits.append(cr)
        desc = re.sub(r'\s+', ' ', r.get('description') or '').strip()
        things.append([file, title, desc[:240], credits.index(cr)])
json.dump({'pics': rows, 'things': things, 'credits': credits}, open('data/pictures.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'scene pictures,', len(things), 'photos and drawings,', len(credits), 'credit lines')
