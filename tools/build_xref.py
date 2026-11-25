"""Build data/xref/<book>.json from OpenBible.info's cross references (CC BY, www.openbible.info).

Input: cross_references.txt (tab-separated: From Verse, To Verse, Votes; OSIS references such as Gen.1.1 or
Prov.8.22-Prov.8.30). Output per book: {"<chapter>.<verse>": ["b.c.v" or "b.c.v-c.v", ...]}, books numbered 0-65,
at most 12 links per verse, best voted first, links with fewer than 2 votes left out.
Usage: python3 tools/build_xref.py path/to/cross_references.txt data/xref
"""
import json, os, sys
from collections import defaultdict

OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer '
        'Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal '
        'Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
IDX = {c: i for i, c in enumerate(OSIS)}

def ref(r):
    b, c, v = r.split('.')
    return IDX[b], int(c), int(v)

def main(src, out):
    links = defaultdict(list)
    with open(src, encoding='utf-8') as f:
        next(f)
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) < 3:
                continue
            frm, to, votes = parts[0], parts[1], int(parts[2])
            if votes < 2:
                continue
            fb, fc, fv = ref(frm)
            ends = to.split('-')
            tb, tc, tv = ref(ends[0])
            s = f'{tb}.{tc}.{tv}'
            if len(ends) == 2:
                eb, ec, ev = ref(ends[1])
                if eb == tb and (ec, ev) != (tc, tv):
                    s += f'-{ec}.{ev}'
            links[(fb, fc, fv)].append((votes, s))
    os.makedirs(out, exist_ok=True)
    books = defaultdict(dict)
    for (b, c, v), lst in links.items():
        lst.sort(key=lambda x: -x[0])
        books[b][f'{c}.{v}'] = [s for _, s in lst[:12]]
    total = 0
    for b in range(66):
        with open(os.path.join(out, f'{b}.json'), 'w', encoding='utf-8') as f:
            json.dump(books.get(b, {}), f, separators=(',', ':'))
        total += sum(len(x) for x in books.get(b, {}).values())
    print('links kept', total)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
