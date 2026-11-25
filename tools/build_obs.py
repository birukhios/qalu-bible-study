"""Build data/obs/<lang>.json from an Open Bible Stories zip (unfoldingWord® Open Bible Stories, CC BY-SA 4.0).

Each story file content/NN.md looks like:
    # 1. The Creation
    ![OBS Image](https://cdn.door43.org/obs/jpg/360px/obs-en-01-01.jpg)
    The text of the first frame...
    ...
    _A Bible story from: Genesis 1-2_
Output: [{"n": 1, "t": title, "r": reference line, "f": [["01-01", text], ...]}, ...] for stories 1-50.
Usage: python3 tools/build_obs.py am_obs.zip data/obs/am.json
"""
import json, re, sys, zipfile

IMG = re.compile(r'obs-[a-z]+-(\d\d)-(\d\d)\.jpg')

def parse(md, n):
    title, frames, ref, cur = '', [], '', None
    for line in md.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith('#') and not title:
            title = re.sub(r'^#+\s*', '', s)
            title = re.sub(r'^\d+\.\s*', '', title)
            continue
        m = IMG.search(s)
        if m:
            cur = [f'{m.group(1)}-{m.group(2)}', '']
            frames.append(cur)
            continue
        if re.fullmatch(r'[_*]+.+[_*]+', s):
            ref = s.strip('_*').strip()
            continue
        if cur is not None:
            cur[1] = (cur[1] + ' ' + re.sub(r'\*\*|__', '', s)).strip()
    return {'n': n, 't': title, 'r': ref, 'f': [f for f in frames if f[1]]}

def main(src, dst):
    z = zipfile.ZipFile(src)
    stories = {}
    for name in z.namelist():
        m = re.search(r'content/(\d\d)\.md$', name)
        if m and 1 <= int(m.group(1)) <= 50:
            stories[int(m.group(1))] = parse(z.read(name).decode('utf-8'), int(m.group(1)))
    out = [stories[k] for k in sorted(stories)]
    json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'stories,', sum(len(s['f']) for s in out), 'frames ->', dst)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
