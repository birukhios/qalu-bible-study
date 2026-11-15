#!/usr/bin/env python3
"""Build book and chapter background for the Context tab from the unfoldingWord Translation Notes.

Source: https://git.door43.org/unfoldingWord/en_tn (CC BY-SA 4.0). The original work by unfoldingWord
is available from unfoldingword.org/utn.
Changes made here: only the book introductions ("front:intro") and chapter introductions ("N:intro")
are used; sections written for translators (headings containing "Translation") are left out; internal
links are turned into plain text. The wording of what is kept is unchanged.

Output: OUT/<book index>.json -> {"intro": markdown, "chapters": {"<n>": markdown}}
Usage: build_context.py EN_TN_DIR OUT_DIR
"""
import csv, glob, json, os, re, sys

CODES = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
         "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI "
         "TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()


def clean(note):
    text = note.replace("\\n", "\n").replace("<br>", "\n")
    text = re.sub(r"\(See:[^)]*\)", "", text)                         # pointers into the translators' manuals
    text = re.sub(r"\[\[rc://[^\]]*\]\]", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)               # [label](link) -> label
    # Split into sections at level-2 headings and drop the ones meant for translators.
    parts = re.split(r"(?m)^(?=## )", text)
    kept = [p for p in parts if not re.match(r"## .*(Translation|Translating)", p.splitlines()[0] if p.strip() else "")]
    text = "".join(kept)
    text = re.sub(r"(?m)^# .*\n", "", text, count=1)                   # the app supplies its own title
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def main(src, out):
    os.makedirs(out, exist_ok=True)
    csv.field_size_limit(10 ** 9)
    books = chapters = 0
    for path in sorted(glob.glob(os.path.join(src, "tn_*.tsv"))):
        code = os.path.basename(path)[3:6]
        if code not in CODES:
            continue
        data = {"intro": "", "chapters": {}}
        with open(path, encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
                ref = row.get("Reference", "")
                if ref == "front:intro":
                    data["intro"] = clean(row["Note"])
                elif ref.endswith(":intro"):
                    text = clean(row["Note"])
                    if text:
                        data["chapters"][ref.split(":")[0]] = text
        json.dump(data, open(f"{out}/{CODES.index(code)}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        books += 1
        chapters += len(data["chapters"])
    print("books", books, "chapter notes", chapters)


if __name__ == "__main__":
    main(*sys.argv[1:3])
