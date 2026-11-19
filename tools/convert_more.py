#!/usr/bin/env python3
"""Convert more Bible versions into the app's per-book files (OUT_DIR/<id>/<book index>.json, [chapter][verse] -> text).

Sources:
  bsb    Berean Standard Bible, CC0 (public domain). scrollmapper/bible_databases, formats/json/BSB.json
  darby  Darby Bible 1889, public domain.          scrollmapper/bible_databases, formats/json/Darby.json
  gaz    Biblica® Open New Oromo Contemporary Version™, Western (Afaan Oromoo), © 2022 Biblica, Inc., CC BY-SA 4.0.
         BibleNLP/ebible corpus/gaz-gaz.txt with metadata/vref.txt (one verse per line, eBible.org text). The verses
         carry the English numbering; the corpus leaves out the few verses whose numbers do not exist in the
         original numbering (Joel 2:28-32, Malachi 4 and some others), so those are missing here.
  orig   Hebrew Old Testament and Greek New Testament, built from this app's own interlinear files
         (data/interlinear, from STEPBible TAHOT/TAGNT, CC BY 4.0) so the verses match the word-by-word view.
Usage: convert_more.py SCROLLMAPPER_JSON_DIR EBIBLE_DIR INTERLINEAR_DIR OUT_DIR
The verse text is kept as published, except that in the Darby file the word "God", which the source joins to the
word before it ("beginningGod"), is given back its space.
"""
import glob, json, os, re, sys

CODES = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
         "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI "
         "TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()
sm_dir, eb_dir, il_dir, out = sys.argv[1:5]


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
                place(books, b, ch['chapter'], v['verse'], fix(text) if fix else text)
    return books


def from_ebible(code):
    """The corpus lines follow metadata/vref.txt. For this text the verses already carry the English numbering,
    but verses that do not exist in the original numbering (such as Joel 2:28-32 and Malachi 4) were left out
    of the corpus, so those few verses are missing."""
    books = [[] for _ in range(66)]
    refs = open(os.path.join(eb_dir, 'metadata', 'vref.txt'), encoding='utf-8').read().splitlines()
    lines = open(os.path.join(eb_dir, 'corpus', code + '.txt'), encoding='utf-8').read().splitlines()
    for ref, text in zip(refs, lines):
        m = re.match(r'(\w+) (\d+):(\d+)$', ref)
        text = text.strip()
        if not m or m.group(1) not in CODES or not text or text == '<range>':
            continue  # empty slots and verses joined to the one before them
        place(books, CODES.index(m.group(1)), int(m.group(2)), int(m.group(3)), text)
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
for vid, books in [('bsb', from_scrollmapper('BSB')), ('darby', from_scrollmapper('Darby', darby_fix)),
                   ('gaz', from_ebible('gaz-gaz')), ('orig', from_interlinear())]:
    write(vid, books)
    print(vid, sum(len(c) for b in books for c in b), 'verse slots,', sum(1 for b in books for c in b for v in c if v), 'with text')
