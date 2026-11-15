#!/usr/bin/env python3
"""Convert public-domain English Bibles into the app's per-book files.

Output: OUT_DIR/<id>/<book index>.json, each holding [chapter][verse] -> text
Sources:
  KJV: https://github.com/thiagobodruk/bible (json/en_kjv.json)
  WEB, ASV, YLT, BBE: https://github.com/scrollmapper/bible_databases (branch 2024, json/t_<id>.json)
Usage: convert_english.py SOURCE_DIR OUT_DIR   (SOURCE_DIR holds kjv.json and the t_<id>.json files)
"""
import json, os, re, sys

def clean(t):
    t = re.sub(r"\{[^{}]*\}", "", t)          # footnotes in braces
    t = t.replace('\\"', '"').replace("\\'", "'")
    t = t.replace("&gt;", "").replace("&lt;", "").replace("&amp;", "&")  # stray markup in the sources
    t = re.sub(r"\s+([.,;:!?])", r"\1", t)     # stray space before punctuation
    return re.sub(r"\s+", " ", t).strip()

def write(out, vid, books):
    """One file per book so the app only downloads the book being read."""
    os.makedirs(f"{out}/{vid}", exist_ok=True)
    for i, chapters in enumerate(books):
        json.dump(chapters, open(f"{out}/{vid}/{i}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(vid, len(books), sum(len(b) for b in books), sum(len(c) for b in books for c in b), "| Luke 15:20:", books[41][14][19][:70])

def from_rows(path):
    rows = json.load(open(path, encoding="utf-8-sig"))["resultset"]["row"]
    books = [[] for _ in range(66)]
    for r in rows:
        _, b, c, v, text = r["field"]
        if not 1 <= b <= 66:
            continue
        chapters = books[b - 1]
        while len(chapters) < c:
            chapters.append([])
        verses = chapters[c - 1]
        while len(verses) < v:
            verses.append("")
        verses[v - 1] = clean(text)
    return books

def main(src, out):
    kjv = json.load(open(f"{src}/kjv.json", encoding="utf-8-sig"))
    write(out, "kjv", [[[clean(v) for v in ch] for ch in b["chapters"]] for b in kjv])
    for vid in ("web", "asv", "ylt", "bbe"):
        write(out, vid, from_rows(f"{src}/t_{vid}.json"))

if __name__ == "__main__":
    main(*sys.argv[1:3])
