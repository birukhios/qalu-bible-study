#!/usr/bin/env python3
"""Convert public-domain KJV and WEB source files into the app's Bible JSON format.

Output: OUT_DIR/<id>/<book index>.json, each holding [chapter][verse] -> text
Sources:
  KJV: https://github.com/thiagobodruk/bible (json/en_kjv.json)
  WEB: https://github.com/scrollmapper/bible_databases (branch 2024, json/t_web.json)
Usage: convert_english.py en_kjv.json t_web.json OUT_DIR
"""
import json, os, re, sys

def clean(t):
    t = re.sub(r"\{[^{}]*\}", "", t)          # footnotes in braces
    t = t.replace('\\"', '"').replace("\\'", "'")
    t = t.replace("&gt;", "").replace("&lt;", "").replace("&amp;", "&")  # stray markup in the WEB source
    t = re.sub(r"\s+([.,;:!?])", r"\1", t)     # stray space before punctuation
    return re.sub(r"\s+", " ", t).strip()

def write(out, vid, books):
    """One file per book (OUT/<id>/<book index>.json) so the app only downloads the book being read."""
    os.makedirs(f"{out}/{vid}", exist_ok=True)
    for i, chapters in enumerate(books):
        json.dump(chapters, open(f"{out}/{vid}/{i}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

def main(kjv_path, web_path, out):
    kjv = json.load(open(kjv_path, encoding="utf-8-sig"))
    books = [[[clean(v) for v in ch] for ch in b["chapters"]] for b in kjv]
    write(out, "kjv", books)
    rows = json.load(open(web_path, encoding="utf-8-sig"))["resultset"]["row"]
    web = [[] for _ in range(66)]
    for r in rows:
        _, b, c, v, text = r["field"]
        if not 1 <= b <= 66:
            continue
        chs = web[b - 1]
        while len(chs) < c:
            chs.append([])
        vs = chs[c - 1]
        while len(vs) < v:
            vs.append("")
        vs[v - 1] = clean(text)
    write(out, "web", web)
    for name, bk in (("kjv", books), ("web", web)):
        print(name, len(bk), sum(len(b) for b in bk), sum(len(c) for b in bk for c in b))
    print("KJV Luke 15:20:", books[41][14][19])
    print("WEB Luke 15:20:", web[41][14][19])
    print("WEB Psalm 23:1:", web[18][22][0])

if __name__ == "__main__":
    main(*sys.argv[1:4])
