#!/usr/bin/env python3
"""Convert Bible versions from Beblia/Holy-Bible-XML-Format (https://github.com/Beblia/Holy-Bible-XML-Format) into the
app's per-book files (OUT_DIR/<id>/<book index>.json, [chapter][verse] -> text).

Beblia files look like <bible><testament><book number="1"><chapter number="1"><verse number="1">text</verse>…, with
books numbered 1–66 in the Protestant order. Zero-width spaces (which the Amharic 2000 file puts inside words) and
runs of white space are removed; the text is otherwise kept as published. Verses a file joins into one (an empty
verse after a long one) stay empty, and the app marks them as missing.
Only versions with every chapter and nearly every verse are kept (checked against the KJV versification; the 1954,
2000, 2005 and Catholic Amharic files, GNT and EasyEnglish leave hundreds of verses empty and were removed).
Usage: convert_beblia.py BEBLIA_DIR OUT_DIR [ids]
To add another version: put a line in VERSIONS, run this, then tools/build_offline_manifest.py, and add the id to
`versions` and VERSION_GROUPS in app.js.
"""
import json, os, re, sys
import xml.etree.ElementTree as ET

VERSIONS = {  # app id: Beblia file
    'amnasv': 'AmharicNASVBible.xml',    # Addisu Medebegna Tirgum (New Amharic Standard Version), Biblica 2001
    # English versions under copyright (by their publishers), for personal study use:
    'niv': 'EnglishNIVBible.xml', 'esv': 'EnglishESVBible.xml', 'nlt': 'EnglishNLTBible.xml', 'nkjv': 'EnglishNKJBible.xml',
    'nasb': 'EnglishNASBBible.xml', 'csb': 'EnglishCSBBible.xml', 'nrsv': 'EnglishNRSVBible.xml', 'rsv': 'EnglishRSVBible.xml',
    'amp': 'EnglishAmplifiedBible.xml', 'ampc': 'EnglishAmplifiedClassicBible.xml', 'net': 'EnglishNETBible.xml',
    'mev': 'EnglishMEVBible.xml', 'lsb': 'EnglishLSBBible.xml', 'erv': 'EnglishERVBible.xml',
    'gw': 'EnglishGWBible.xml', 'nirv': 'EnglishNIRVBible.xml', 'tlb': 'EnglishTLBible.xml',
    'hcsb': 'EnglishHCSBBible.xml',
}
src, out = sys.argv[1:3]
only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
for vid, name in VERSIONS.items():
    if only and vid not in only:
        continue
    books = [[] for _ in range(66)]
    for book in ET.parse(os.path.join(src, name)).getroot().iter('book'):
        b = int(book.get('number')) - 1
        if not 0 <= b < 66:
            continue  # deuterocanonical books, which the app has no place for yet
        for ch in book.iter('chapter'):
            c = int(ch.get('number'))
            while len(books[b]) < c:
                books[b].append([])
            verses = books[b][c - 1]
            for v in ch.iter('verse'):
                n = int(v.get('number'))
                text = re.sub(r'\s+', ' ', (v.text or '').replace('​', '').replace('﻿', '')).strip()
                while len(verses) < n:
                    verses.append('')
                verses[n - 1] = text
    os.makedirs(os.path.join(out, vid), exist_ok=True)
    for b, chapters in enumerate(books):
        with open(os.path.join(out, vid, f'{b}.json'), 'w', encoding='utf-8') as fh:
            json.dump(chapters, fh, ensure_ascii=False, separators=(',', ':'))
    print(vid, sum(1 for b in books for c in b for v in c if v), 'verses,', sum(1 for b in books if b), 'books')
