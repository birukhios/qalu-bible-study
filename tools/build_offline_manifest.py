#!/usr/bin/env python3
"""List the data the app can save for offline use, in packs, with the files and total size of each.

Writes data/offline.json: { "<pack>": { "files": [paths], "bytes": n } }. Packs: each Bible version folder that has
the 66 book files, "fathers" (church fathers' commentary), "context" (book introductions and chapter notes) and
"interlinear" (the Hebrew and Greek words, with their dictionary). Run it again whenever data files are added.
Usage: build_offline_manifest.py   (from the repository root)
"""
import json, os

packs = {}


def add(name, paths):
    paths = [p for p in paths if os.path.exists(p)]
    packs[name] = {'files': paths, 'bytes': sum(os.path.getsize(p) for p in paths)}


for name in sorted(os.listdir('data')):
    folder = os.path.join('data', name)
    if os.path.isdir(folder) and all(os.path.exists(os.path.join(folder, f'{b}.json')) for b in range(66)):
        add(name, [f'data/{name}/{b}.json' for b in range(66)])   # a Bible version, or "context" (one file per book)

index = json.load(open('data/fathers/index.json', encoding='utf-8'))
add('fathers', ['data/fathers/index.json'] + [f'data/fathers/{b}/{c}.json' for b, chapters in index.items() for c in chapters])
add('interlinear', ['data/interlinear/lexicon.json'] + sorted(
    f'data/interlinear/{b}/{f}' for b in os.listdir('data/interlinear') if b.isdigit() for f in os.listdir(f'data/interlinear/{b}')))
add('obs', ['data/obs/am.json', 'data/obs/en.json'] + sorted(f'data/obs/img/{f}' for f in os.listdir('data/obs/img')))
json.dump(packs, open('data/offline.json', 'w', encoding='utf-8'), separators=(',', ':'))
for name, p in packs.items():
    print(f'{name:12} {len(p["files"]):5} files {p["bytes"] / 1e6:6.1f} MB')
