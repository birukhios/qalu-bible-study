#!/usr/bin/env python3
"""Convert more Bible versions into the app's per-book files (OUT_DIR/<id>/<book index>.json, [chapter][verse] -> text).

Sources:
  bsb    Berean Standard Bible, CC0 (public domain). scrollmapper/bible_databases, formats/json/BSB.json
  darby  Darby Bible 1889, public domain.          scrollmapper/bible_databases, formats/json/Darby.json
  geneva, nheb, webster  Geneva Bible 1599, New Heart English Bible, Webster Bible: public domain, same collection.
  acv, ukjv, rotherham, twenty  A Conservative Version, Updated King James Version, Rotherham's Emphasised Bible,
         Twentieth Century New Testament: public domain, same collection.
  orig   Hebrew Old Testament and Greek New Testament, built from this app's own interlinear files
         (data/interlinear, from STEPBible TAHOT/TAGNT, CC BY 4.0) so the verses match the word-by-word view.
Usage: convert_more.py SCROLLMAPPER_JSON_DIR INTERLINEAR_DIR OUT_DIR [ids]
The verse text is kept as published, except that in the Darby file the word "God", which the source joins to the
word before it ("beginningGod"), is given back its space.
"""
import glob, json, os, re, sys

CODES = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
         "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI "
         "TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()
sm_dir, il_dir, out = sys.argv[1:4]


def write(vid, books):
    os.makedirs(os.path.join(out, vid), exist_ok=True)
    for b, chapters in enumerate(books):
        with open(os.path.join(out, vid, f'{b}.json'), 'w', encoding='utf-8') as fh:
            json.dump(chapters, fh, ensure_ascii=False, separators=(',', ':'))


def place(books, b, c, v, text):
    chapters = books[b]
    while len(chapters) < c:
        chapters.append([])
    verses = chapters[c - 1]
    while len(verses) < v:
        verses.append('')
    verses[v - 1] = text


def from_scrollmapper(name, fix=None):
    data = json.load(open(os.path.join(sm_dir, name + '.json'), encoding='utf-8'))['books']
    assert len(data) == 66, (name, len(data))
    books = [[] for _ in range(66)]
    for b, book in enumerate(data):
        for ch in book['chapters']:
            for v in ch['verses']:
                text = re.sub(r'\s+', ' ', v['text']).strip()
                if text:  # the Twentieth Century file has empty Old Testament verses
                    place(books, b, ch['chapter'], v['verse'], fix(text) if fix else text)
    return books


def from_interlinear():
    books = [[] for _ in range(66)]
    for b in range(66):
        for path in glob.glob(os.path.join(il_dir, str(b), '*.json')):
            c = int(os.path.basename(path)[:-5])
            for v, words in json.load(open(path, encoding='utf-8')).items():
                text = ''
                for w in words:
                    word = w[0]
                    text += word if (not text or text.endswith('־')) else ' ' + word  # a maqaf joins two Hebrew words
                text = re.sub(r'\s+[פס]$', '', text)  # paragraph markers at the end of a Hebrew verse
                place(books, b, c, int(v), text)
    return books


darby_fix = lambda t: re.sub(r'(?<=[a-z\]\)])(?=God)', ' ', t)
for vid, make in [('bsb', lambda: from_scrollmapper('BSB')), ('darby', lambda: from_scrollmapper('Darby', darby_fix)),
                  ('geneva', lambda: from_scrollmapper('Geneva1599')), ('nheb', lambda: from_scrollmapper('NHEB')),
                  ('webster', lambda: from_scrollmapper('Webster')),
                  ('acv', lambda: from_scrollmapper('ACV')), ('ukjv', lambda: from_scrollmapper('UKJV')),
                  ('rotherham', lambda: from_scrollmapper('Rotherham')),
                  ('orig', from_interlinear)]:
    if len(sys.argv) > 4 and vid not in sys.argv[4].split(','):
        continue  # an optional fifth argument limits the run to some versions, e.g. "wal,som"
    books = make()
    write(vid, books)
    print(vid, sum(len(c) for b in books for c in b), 'verse slots,', sum(1 for b in books for c in b for v in c if v), 'with text')
