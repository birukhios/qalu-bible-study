#!/usr/bin/env python3
"""Convert a folder of USFM files (one per book) into the app's per-book Bible files.

Used for the Amharic Unlocked Literal Bible from Door43 (CC BY-SA 4.0, https://door43.org/).
The verse text is kept exactly as published; only the USFM markup and footnotes are removed.
A verse range such as "\\v 3-4" is stored under its first verse.

Usage: convert_usfm.py USFM_DIR OUT_DIR ID        (writes OUT_DIR/ID/<book index>.json)
"""
import glob, json, os, re, sys

CODES = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
         "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI "
         "TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()


def parse(text):
    text = re.sub(r"\\f .*?\\f\*", "", text, flags=re.S)          # footnotes
    chapters, chapter, verse = [], None, None
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"\\c\s+(\d+)", line)
        if m:
            number = int(m.group(1))
            while len(chapters) < number:
                chapters.append([])
            chapter, verse = chapters[number - 1], None
            continue
        m = re.match(r"\\v\s+(\d+)(?:-\d+)?\s*(.*)", line)
        if m and chapter is not None:
            verse = int(m.group(1))
            while len(chapter) < verse:
                chapter.append("")
            chapter[verse - 1] = m.group(2)
            continue
        if line.startswith("\\"):
            marker, _, rest = line.partition(" ")
            if marker in ("\\p", "\\q", "\\q1", "\\q2", "\\m", "\\pi") and rest and verse:
                chapter[verse - 1] += " " + rest                   # paragraph continues the verse
            continue
        if line and chapter is not None and verse:
            chapter[verse - 1] += " " + line
    return [[re.sub(r"\s+", " ", re.sub(r"\\\w+\*?", "", v)).strip() for v in ch] for ch in chapters]


def main(src, out, vid):
    os.makedirs(f"{out}/{vid}", exist_ok=True)
    done = 0
    for path in sorted(glob.glob(os.path.join(src, "*.usfm"))):
        text = open(path, encoding="utf-8-sig").read()
        code = re.search(r"\\id\s+(\w+)", text).group(1).upper()
        index = CODES.index(code)
        json.dump(parse(text), open(f"{out}/{vid}/{index}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        done += 1
    print("books written:", done)


if __name__ == "__main__":
    main(*sys.argv[1:4])
