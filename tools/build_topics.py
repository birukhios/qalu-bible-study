"""Build data/topics.json from Nave's Topical Bible (Orville J. Nave, 1896, public domain; CSV by Brady Stephenson,
github.com/BradyStephenson/bible-data, CC BY 4.0).

Output: {"TOPIC": [[label, ref, ref, ...], ...]} where each inner list is one sub-topic and a ref is
"b.c" (a whole chapter), "b.c.v" or "b.c.v-w" (books numbered 0-65); a sub-topic that only points elsewhere is
["@OTHER TOPIC"]. Usage: python3 tools/build_topics.py NavesTopicalDictionary.csv data/topics.json
"""
import csv, json, re, sys

CODES = ('GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN '
         'HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI '
         '2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV').split()
IDX = {c: i for i, c in enumerate(CODES)}
IDX.update({'1JHN': IDX['1JN'], 'SO': IDX['SNG'], 'JDE': IDX['JUD']})
BOOK = re.compile(r'(?<![A-Za-z0-9])([1-3]?[A-Z][A-Za-z]{1,3}) (?=\d)')

def refs(text):
    out, book = [], None
    # Split into "BOOK numbers" runs, keeping the book for the following runs separated by ";".
    pos = [(m.start(), m.group(1)) for m in BOOK.finditer(text) if m.group(1).upper() in IDX]
    if not pos:
        return out
    for i, (start, code) in enumerate(pos):
        end = pos[i + 1][0] if i + 1 < len(pos) else len(text)
        book = IDX[code.upper()]
        chunk = text[start + len(code):end]
        for part in chunk.split(';'):
            part = part.strip().rstrip('.')
            m = re.match(r'^(\d+)(?::([\d,\- ]+))?', part)
            if not m:
                continue
            c = int(m.group(1))
            if not m.group(2):
                out.append(f'{book}.{c}')
                continue
            for piece in m.group(2).split(','):
                piece = piece.strip()
                r = re.match(r'^(\d+)(?:-(\d+))?$', piece)
                if r:
                    out.append(f'{book}.{c}.{r.group(1)}' + (f'-{r.group(2)}' if r.group(2) else ''))
    return out

def main(src, dst):
    topics = {}
    for row in csv.DictReader(open(src, encoding='utf-8-sig')):
        subject = row['subject'].strip()
        groups = []
        for line in row['entry'].split('\n'):
            line = line.strip().lstrip('-').strip()
            if not line:
                continue
            see = re.match(r'^(?:Also )?[Ss]ee (?:\[\d+\])?([A-Z][A-Z \',\-]+?)(?:,.*)?$', line)
            if see:
                groups.append(['@' + see.group(1).strip()])
                continue
            r = refs(line)
            if not r:
                continue
            m = BOOK.search(line)
            label = line[:m.start()].strip(' ,;:') if m else line
            groups.append([label] + r)
        if groups:
            topics.setdefault(subject, []).extend(groups)
    json.dump(topics, open(dst, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print(len(topics), 'topics,', sum(len(g) - 1 for gs in topics.values() for g in gs), 'references')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
