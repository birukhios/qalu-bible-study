#!/usr/bin/env python3
"""Turn a folder of per-book Amharic Bible PDFs set in the old Visual Ge'ez (VG2) fonts into the
app's Bible import file.

The PDFs are expected as 01_Genesis.pdf ... 66_Revelation.pdf. Each page has two text columns with a
narrow cross-reference column between them. The script:
  1. reads every character with its font size, in the page's own reading order;
  2. keeps body text, superscript verse numbers and the large chapter numbers; drops cross-references,
     footnotes and section headings;
  3. rejoins words that were split across lines, using the vocabulary of the whole Bible;
  4. converts the VG2 font encoding to Unicode Ethiopic.

Usage: convert_amharic_pdf.py PDF_DIR VisualGeez.txt OUT.json [--id ID] [--name NAME] [--only N[,N...]]
The output is for personal use on your own computer. Do not publish a copyrighted translation.
"""
import argparse, collections, glob, json, multiprocessing, os, re, statistics, sys
import pdfplumber

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vg2 import Converter

SENTENCE_END = ("ÝÝ", "”", "’", ")", "!")       # ። and closing quotes in the VG2 encoding
PUNCT = set("ÝÝ¿½¼´()”“’‘!?")


class Line:
    __slots__ = ("page", "col", "y", "items", "gap", "col_start", "header", "x1")

    def __init__(self, page, col, y):
        self.page, self.col, self.y = page, col, y
        self.items = []                # ("t", is_vg, text) | ("v", number) | ("c", number)
        self.gap = None
        self.col_start = False
        self.header = False            # running page header ("ዘፀአት 3:8")
        self.x1 = None                 # right edge of the last character added

    def text(self):
        return "".join(i[2] for i in self.items if i[0] == "t")

    def has_marker(self):
        return any(i[0] != "t" for i in self.items)

    def first_kind(self):
        for i in self.items:
            if i[0] != "t" or i[2].strip():
                return i[0]
        return None


def read_lines(path):
    """All body lines of one book, in reading order, with verse and chapter markers attached."""
    lines = []
    with pdfplumber.open(path) as pdf:
        sizes = collections.Counter()
        for page in pdf.pages[:6]:
            sizes.update(round(c["size"], 1) for c in page.chars if c["text"].strip() and 8 <= c["size"] <= 13)
        body = sizes.most_common(1)[0][0]
        sample = [c for page in pdf.pages[:12] for c in page.chars if abs(c["size"] - body) < 1.05 and c["text"].strip()]
        columns = text_columns(sample, pdf.pages[0].width)
        for pno, page in enumerate(pdf.pages):
            mid = page.width / 2
            # Edges of the two text columns; the cross-reference column lies between them, and
            # footnotes lie below the last body line of each column.
            body_chars = [c for c in page.chars if abs(c["size"] - body) < 1.05 and c["text"].strip() and "VG2" in c["fontname"]]
            left = [c for c in body_chars if c["x0"] <= mid]
            right = [c for c in body_chars if c["x0"] > mid]
            floor = (max((c["bottom"] for c in left), default=0) + 2, max((c["bottom"] for c in right), default=0) + 2)
            baselines = (sorted({round(c["bottom"], 1) for c in left}), sorted({round(c["bottom"], 1) for c in right}))
            cur, pending = None, []      # pending: markers seen since the last body character
            for c in page.chars:
                size, ch = c["size"], c["text"]
                is_body = abs(size - body) < 1.05      # a few lines are set one point larger
                in_text = any(a <= c["x0"] <= b for a, b in columns) and c["bottom"] <= floor[1 if c["x0"] > mid else 0]
                small = 0.5 * body <= size <= 0.72 * body and in_text
                if small and ch != " ":
                    # A verse number is a superscript: it sits just above the baseline of a body line.
                    # Small reference lines printed under section headings do not.
                    small = any(c["bottom"] + 1.5 <= y <= c["bottom"] + 0.8 * body for y in baselines[1 if c["x0"] > mid else 0])
                big = size >= 2 * body
                if is_body and ch.strip():
                    y = c["bottom"]
                    if cur is None or abs(y - cur.y) > 0.45 * body or (c["x0"] > mid) != (cur.col == 1):
                        new = Line(pno, 1 if c["x0"] > mid else 0, y)
                        moved = cur is None or cur.col != new.col      # first line of a column or page
                        # A marker drawn lower than the previous line belongs to the new line.
                        for kind, digit, bottom, _x in pending:
                            target = new if (moved or bottom > cur.y + 1 or kind == "c") else cur
                            _add_marker(target, kind, digit)
                        pending = []
                        lines.append(new)
                        cur = new
                    else:
                        for kind, digit, _b, _x in pending:
                            _add_marker(cur, kind, digit)
                        pending = []
                    if ch.startswith("(cid:"):
                        cur.header = True               # only the page header uses this font at body size
                    # Some words are separated by position alone, with no space character between them.
                    if cur.x1 is not None and c["x0"] - cur.x1 > 0.3 * body and not cur.text().endswith(" "):
                        _add_text(cur, True, " ")
                    cur.x1 = c["x1"]
                    _add_text(cur, "VG2" in c["fontname"], ch)
                elif ch == " ":
                    # Spaces come in several sizes; keep any that sits on the current line.
                    if cur is not None and not pending and abs(c["bottom"] - cur.y) < body and any(a <= c["x0"] <= b for a, b in columns):
                        _add_text(cur, True, " ")
                elif (small or big) and ch in "0123456789":
                    kind = "v" if small else "c"
                    # Some digits are printed twice on top of each other in the source; keep one.
                    if pending and pending[-1][:2] == (kind, ch) and abs(pending[-1][3] - c["x0"]) < 0.3 * size:
                        continue
                    pending.append((kind, ch, c["bottom"], c["x0"]))
            if cur is not None:
                for kind, digit, _b, _x in pending:
                    _add_marker(cur, kind, digit)
    # Footnotes can contain a stray body-size bracket; a real line has Ethiopic text in it.
    lines = [l for l in lines if not l.header and any(i[0] == "t" and i[1] and i[2].strip() for i in l.items)]
    # Line spacing: mark column starts and unusually large gaps (used to spot section headings).
    gaps = []
    for prev, line in zip(lines, lines[1:]):
        if (prev.page, prev.col) == (line.page, line.col):
            line.gap = line.y - prev.y
            if line.gap > 0:
                gaps.append(line.gap)
        else:
            line.col_start = True
    if lines:
        lines[0].col_start = True
    normal = statistics.median(gaps) if gaps else 10
    for line in lines:
        line.gap = bool(line.gap and line.gap > 1.18 * normal)   # True = extra space above this line
    return lines


def text_columns(body_chars, width):
    """Horizontal extents of the text columns on a page, from where body-size characters actually sit.
    Cross-references (beside or between the columns) fall outside these extents."""
    bins = [0] * (int(width) + 3)
    for c in body_chars:
        for x in range(int(c["x0"]), int(c["x1"]) + 1):
            bins[x] += 1
    limit = 0.04 * max(bins, default=0)
    spans, start = [], None
    for x, n in enumerate(bins):
        if n > limit:
            if start is None:
                start = x
        elif start is not None:
            if spans and start - spans[-1][1] <= 4:      # bridge hairline gaps inside a column
                spans[-1][1] = x
            else:
                spans.append([start, x])
            start = None
    # Verse numbers may hang a little to the left of indented poetry, so allow some room on that side.
    return [(a - 6.5, b + 1.5) for a, b in spans if b - a > 0.15 * width]


def _add_text(line, is_vg, ch):
    if line.items and line.items[-1][0] == "t" and line.items[-1][1] == is_vg:
        line.items[-1] = ("t", is_vg, line.items[-1][2] + ch)
    else:
        line.items.append(("t", is_vg, ch))


def _add_marker(line, kind, digit):
    last = line.items[-1] if line.items else None
    if last and last[0] == kind and last[2]:           # digits of one number arrive one at a time
        line.items[-1] = (kind, last[1] * 10 + int(digit), True)
    else:
        line.items.append((kind, int(digit), True))


PSALM = re.compile(r"^\s*mZÑR\s+(\d+)\s*$")       # "መዝሙር 23" on a line of its own


def psalm_numbers(lines):
    """In Psalms each psalm starts with a line "መዝሙር N" instead of a large chapter number. Turn that
    line into a chapter marker and drop the heading lines that follow it."""
    out, skip = [], False
    for line in lines:
        m = PSALM.match(line.text())
        if m and not line.has_marker():
            line.items = [("c", int(m.group(1)), True)]
            out.append(line)
            skip = True
            continue
        if skip and not line.has_marker() and not line.gap:
            continue
        skip = False
        out.append(line)
    return out


def drop_headings(lines):
    """Section headings use the body font, so they are recognised by layout: a short block with extra
    space above and below, no verse number inside, followed by the start of a verse or chapter."""
    keep = [True] * len(lines)
    i = 0
    while i < len(lines):
        line = lines[i]
        starts_block = line.gap or (line.col_start and (i == 0 or lines[i - 1].text().rstrip().endswith(SENTENCE_END)))
        if starts_block and not line.has_marker():
            j = i
            while j + 1 < len(lines) and j - i < 3 and not lines[j + 1].gap and not lines[j + 1].col_start and not lines[j + 1].has_marker():
                j += 1
            nxt = lines[j + 1] if j + 1 < len(lines) else None
            block = " ".join(l.text() for l in lines[i:j + 1]).strip()
            if nxt is not None and nxt.gap and not block.endswith("ÝÝ"):
                plain = not any(p in block for p in ("ÝÝ", "¿", "½"))
                if nxt.first_kind() in ("v", "c") or (plain and (i == 0 or lines[i - 1].text().rstrip().endswith(SENTENCE_END))):
                    for k in range(i, j + 1):
                        keep[k] = False
                    i = j + 1
                    continue
        i += 1
    return [l for l, k in zip(lines, keep) if k]


def fix_marker_typos(lines):
    """The source has a few misprinted verse numbers (15, 18, 17 where 16 was meant). If a number breaks
    the sequence but the one after it continues the sequence, correct it."""
    markers = [(line, k) for line in lines for k, item in enumerate(line.items) if item[0] in ("v", "c")]
    for n in range(1, len(markers) - 1):
        (pl, pk), (line, k), (nl, nk) = markers[n - 1], markers[n], markers[n + 1]
        prev, cur, nxt = pl.items[pk], line.items[k], nl.items[nk]
        if prev[0] == "v" and cur[0] == "v" and nxt[0] == "v" and cur[1] != prev[1] + 1 and nxt[1] == prev[1] + 2:
            line.items[k] = ("v", prev[1] + 1, True)
    return lines


def to_verses(lines):
    """chapters -> {verse number: [line fragments]}; each fragment is a list of (is_vg, text)."""
    chapters = collections.OrderedDict()
    chapter, verse = None, None
    for line in lines:
        fragment = []
        for item in line.items:
            if item[0] == "c":
                if fragment and chapter is not None:
                    chapters[chapter].setdefault(verse, []).append(fragment)
                fragment = []
                chapter, verse = item[1], 1
                chapters.setdefault(chapter, collections.OrderedDict())
            elif item[0] == "v":
                if chapter is None:                     # single-chapter books have no chapter number
                    chapter = 1
                    chapters.setdefault(chapter, collections.OrderedDict())
                if fragment:
                    chapters[chapter].setdefault(verse, []).append(fragment)
                fragment = []
                verse = item[1]
            else:
                fragment.append((item[1], item[2]))
        if fragment and chapter is not None:
            chapters[chapter].setdefault(verse, []).append(fragment)
    return chapters


def read_book(path):
    lines = read_lines(path)
    if os.path.basename(path).startswith("19_"):
        lines = psalm_numbers(lines)
    return to_verses(fix_marker_typos(drop_headings(lines)))


def flat(fragment):
    return "".join(t for _, t in fragment)


def build_vocabulary(books):
    """Count every word, and every pair of neighbouring words, that appears whole inside a line
    (not touching a line end, where a word may have been cut)."""
    vocab, pairs = collections.Counter(), collections.Counter()
    for chapters in books:
        for verses in chapters.values():
            for fragments in verses.values():
                for fragment in fragments:
                    words = strip_punct(flat(fragment)).split()[1:-1]
                    vocab.update(words)
                    pairs.update(zip(words, words[1:]))
    # How often each character ends or begins a word, out of all the places it appears.
    final, initial, total = collections.Counter(), collections.Counter(), collections.Counter()
    for word, n in vocab.items():
        final[word[-1]] += n
        initial[word[0]] += n
        for ch in word:
            total[ch] += n
    ends = {ch: final[ch] / total[ch] for ch in total}
    begins = {ch: initial[ch] / total[ch] for ch in total}
    return vocab, pairs, (ends, begins)


def strip_punct(text):
    return "".join(" " if c in PUNCT else c for c in text)


def join_fragments(fragments, vocab, pairs, shape):
    """Join the line fragments of one verse, deciding at each line break whether a word continues."""
    parts = [list(fragments[0])]
    for nxt in fragments[1:]:
        prev_text, next_text = flat(parts[-1]), flat(nxt)
        a = strip_punct(prev_text).split()
        b = strip_punct(next_text).split()
        glue = False
        if a and b and prev_text.rstrip()[-1:] not in PUNCT and next_text.lstrip()[:1] not in PUNCT:
            left, right = a[-1], b[0]
            whole = vocab[left + right]
            if whole:
                # Seen as one word elsewhere: join unless the two pieces are seen side by side more often.
                glue = whole > pairs[(left, right)] or vocab[left] == 0 or vocab[right] == 0
            elif vocab[left] == 0 or vocab[right] == 0:
                # Never seen as one word, and a piece is not a known word. It is either a cut word or
                # a rare word; judge by whether the break looks like a word boundary.
                ends, begins = shape
                e, b = ends.get(left[-1], 0.5), begins.get(right[0], 0.5)
                glue = e * b < 0.2 and (vocab[left] < 2 or b < 0.25) and (vocab[right] < 2 or e < 0.3)
        if glue:
            last = parts[-1]
            is_vg, text = last[-1]
            last[-1] = (is_vg, text.rstrip())
            parts[-1] = last + [(nxt[0][0], nxt[0][1].lstrip())] + list(nxt[1:])
        else:
            parts[-1].append((True, " "))
            parts[-1].extend(nxt)
    return parts[-1]


def render(fragment, conv):
    merged = []                       # neighbouring pieces in the same font must be converted together
    for is_vg, text in fragment:
        if merged and merged[-1][0] == is_vg:
            merged[-1][1] += text
        else:
            merged.append([is_vg, text])
    out = "".join(conv.convert(text) if is_vg else text for is_vg, text in merged)
    out = re.sub(r"\s+", " ", out).strip()
    out = re.sub(r"እግዚ ?አ ?ብሔር", "እግዚአብሔር", out)          # the divine name is set in its own font and picks up stray spaces
    out = re.sub(r"\s+([።፤፣፡፦])", r"\1", out)
    return re.sub(r"([።፤፣፦])(?=[^\s”’)\]።፤፣፦])", r"\1 ", out)      # a space after punctuation


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf_dir"); ap.add_argument("rules"); ap.add_argument("out")
    ap.add_argument("--id", default="am-nasv"); ap.add_argument("--name", default="አዲሱ መደበኛ ትርጒም")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    only = {int(x) for x in args.only.split(",") if x}
    conv = Converter(args.rules)
    raw = [collections.OrderedDict() for _ in range(66)]
    paths = [p for p in sorted(glob.glob(os.path.join(args.pdf_dir, "*.pdf")))
             if not only or int(os.path.basename(p).split("_")[0]) in only]
    with multiprocessing.Pool() as pool:
        for path, chapters in zip(paths, pool.map(read_book, paths)):
            raw[int(os.path.basename(path).split("_")[0]) - 1] = chapters
            print("read", os.path.basename(path), "chapters", len(chapters), file=sys.stderr)
    vocab, pairs, shape = build_vocabulary(raw)
    books = []
    for chapters in raw:
        book = []
        for chapter in range(1, max(chapters, default=0) + 1):
            verses = chapters.get(chapter, {})
            book.append([render(join_fragments(verses[v], vocab, pairs, shape), conv) if v in verses else ""
                         for v in range(1, max(verses, default=0) + 1)])
        books.append(book)
    json.dump({"id": args.id, "name": args.name, "language": "am", "books": books},
              open(args.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
