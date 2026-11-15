#!/usr/bin/env python3
"""Build the church fathers data from the HistoricalChristianFaith Commentaries-Database.

Source: https://github.com/HistoricalChristianFaith/Commentaries-Database
Only entries whose translation is clearly public domain are kept:
  - the Catena Aurea (Aquinas's compilation of the fathers on the Gospels, English translation of 1841), and
  - entries whose source is hosted on newadvent.org or ccel.org (the ANF/NPNF series).
Only authors up to AD 750 are kept (the early church fathers).

Output: OUT/index.json  -> {"<book>": [chapters that have entries]}
        OUT/<book>/<chapter>.json -> [{"a": author, "y": year, "f": from verse, "t": to verse, "q": quote, "s": source}]
Usage: build_fathers.py DATABASE_DIR CONTENT_JSON OUT_DIR
"""
import json, os, re, sys, tomllib, collections

MAX_YEAR = 750
ALIASES = {"Song of Solomon": "Song of Songs", "Psalm": "Psalms", "Canticles": "Song of Songs", "Apocalypse": "Revelation"}

def public_domain(entry):
    title = entry.get("source_title", "")
    url = entry.get("source_url", "")
    return title == "Catena Aurea by Aquinas" or "newadvent.org" in url or "ccel.org" in url

def main(db, content_path, out):
    names = [b["n"][1] for b in json.load(open(content_path, encoding="utf-8"))["books"]]
    index_of = {n: i for i, n in enumerate(names)}
    data = collections.defaultdict(list)
    skipped = collections.Counter()
    for author in sorted(os.listdir(db)):
        folder = os.path.join(db, author)
        meta_path = os.path.join(folder, "metadata.toml")
        if not os.path.isfile(meta_path):
            continue
        year = tomllib.load(open(meta_path, "rb")).get("default_year")
        if not isinstance(year, int) or year > MAX_YEAR:
            skipped["late author"] += 1
            continue
        for name in os.listdir(folder):
            m = re.match(r"^(.+) (\d+)_(\d+)(?:-(?:(\d+)_)?(\d+))?\.toml$", name)
            if not m:
                continue
            book = ALIASES.get(m.group(1), m.group(1))
            if book not in index_of:
                skipped["book not in the 66"] += 1
                continue
            chapter, start = int(m.group(2)), int(m.group(3))
            end = 999 if m.group(4) else int(m.group(5) or start)
            for entry in tomllib.load(open(os.path.join(folder, name), "rb")).get("commentary", []):
                quote = re.sub(r"\s+", " ", entry.get("quote", "")).strip()
                if not quote:
                    continue
                if not public_domain(entry):
                    skipped["source not clearly public domain"] += 1
                    continue
                source = entry.get("source_title", "")
                if source == "Catena Aurea by Aquinas":
                    source = "Catena Aurea"
                data[(index_of[book], chapter)].append({"a": author, "y": year, "f": start, "t": end, "q": quote, "s": source})
    index = collections.defaultdict(list)
    total = 0
    for (book, chapter), entries in sorted(data.items()):
        entries.sort(key=lambda e: (e["f"], e["y"], e["a"]))
        os.makedirs(f"{out}/{book}", exist_ok=True)
        json.dump(entries, open(f"{out}/{book}/{chapter}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        index[str(book)].append(chapter)
        total += len(entries)
    json.dump(index, open(f"{out}/index.json", "w", encoding="utf-8"), separators=(",", ":"))
    print("kept", total, "entries in", len(data), "chapters of", len(index), "books")
    print("skipped", dict(skipped))
    per_book = collections.Counter()
    for (book, _), entries in data.items():
        per_book[names[book]] += len(entries)
    print(per_book.most_common(70))

if __name__ == "__main__":
    main(*sys.argv[1:4])
