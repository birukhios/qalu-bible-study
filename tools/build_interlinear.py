#!/usr/bin/env python3
"""Build the word-by-word (interlinear) Hebrew and Greek data from STEPBible.

Source: STEPBible-Data, "Translators Amalgamated OT+NT" (TAHOT and TAGNT), by Tyndale House Cambridge,
CC BY 4.0: https://github.com/STEPBible/STEPBible-Data
Usage: build_interlinear.py SOURCE_DIR OUT_DIR

Writes OUT_DIR/<book>/<chapter>.json, books numbered 0-65 in the traditional order. Each file maps a verse
number to its words in reading order; each word is [original, transliteration, English gloss, Strong's number,
grammar code]. OUT_DIR/lexicon.json maps each Strong's number to [dictionary form, dictionary meaning], so the
dictionary entry is stored once rather than with every word. Verse numbers follow the English versification.
For the Greek, the words of the Nestle-Aland text are used; a verse found only in other editions (such as
the text behind the KJV) uses the words of those editions.
"""
import glob, json, os, re, sys

BOOKS = ('Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk '
         'Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th '
         '2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev').split()
REF = re.compile(r'^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)=(\S+)')

src, out = sys.argv[1], sys.argv[2]
chapters = {}  # (book, chapter) -> {verse: {"main": [...], "other": [...]}}
lexicon = {}  # Strong's number -> [dictionary form, dictionary meaning]


def add(book, ch, vs, main, word):
    v = chapters.setdefault((book, ch), {}).setdefault(vs, {'main': [], 'other': []})
    v['main' if main else 'other'].append(word)


def clean_translit(s):
    return s.replace('/', '').replace('.', '').replace('\\', '').lower()


for path in sorted(glob.glob(os.path.join(src, 'TAHOT *.txt'))):
    for line in open(path, encoding='utf-8'):
        m = REF.match(line)
        if not m or m.group(1) not in BOOKS:
            continue
        f = line.rstrip('\n').split('\t')
        if len(f) < 12:
            continue
        b, c, v = BOOKS.index(m.group(1)), int(m.group(2)), int(m.group(3))
        # The main word of the expanded tags is the one in braces: {H7225G=רֵאשִׁית=: beginning»first:1_beginning}
        lemma = gloss = ''
        strong = ''
        mm = re.search(r'\{(H\d+[A-Z]?)=([^=]*)=([^}]*)\}', f[11])
        if mm:
            strong, lemma, gloss = mm.group(1), mm.group(2), mm.group(3)
            gloss = re.sub(r'^:\s*', '', gloss).split('»')[0].strip()
        else:
            sm = re.search(r'\{(H\d+[A-Z]?)\}', f[4])
            strong = sm.group(1) if sm else ''
        if strong and lemma:
            lexicon.setdefault(strong, [lemma, gloss])
        add(b, c, v, True, [f[1].replace('/', '').replace('\\', ''), clean_translit(f[2]), ' '.join(f[3].replace('/', ' ').split()),
                            strong, f[5]])

for path in sorted(glob.glob(os.path.join(src, 'TAGNT *.txt'))):
    for line in open(path, encoding='utf-8'):
        m = REF.match(line)
        if not m or m.group(1) not in BOOKS:
            continue
        f = line.rstrip('\n').split('\t')
        if len(f) < 5:
            continue
        b, c, v, kind = BOOKS.index(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(5)
        wm = re.match(r'^(.*?)\s*\((.*)\)\s*$', f[1])
        word, translit = (wm.group(1), wm.group(2)) if wm else (f[1].strip(), '')
        strong, _, grammar = f[3].partition('=')
        lemma, _, gloss = f[4].partition('=')
        strong = re.sub(r'[A-Z]$', '', strong)
        if strong and lemma:
            lexicon.setdefault(strong, [lemma, gloss])
        add(b, c, v, 'N' in kind, [word, translit.lower(), ' '.join(f[2].split()), strong, grammar])

count = 0
for (b, c), verses in chapters.items():
    os.makedirs(os.path.join(out, str(b)), exist_ok=True)
    data = {str(v): (w['main'] or w['other']) for v, w in sorted(verses.items())}
    with open(os.path.join(out, str(b), f'{c}.json'), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    count += 1
with open(os.path.join(out, 'lexicon.json'), 'w', encoding='utf-8') as fh:
    json.dump(lexicon, fh, ensure_ascii=False, separators=(',', ':'))
print(count, 'chapters written;', len({b for b, _ in chapters}), 'books;', len(lexicon), 'dictionary entries')
