"""Convert text in the legacy "Visual Ge'ez" (VG2 Main / Agazian / Title) font encoding to Unicode Ethiopic.

The mapping comes from the ICU rule file monodirectional/VisualGeez.txt in
https://github.com/geezorg/geez-lib (itself ported from LibEth). This module is a small
interpreter for the subset of ICU transform syntax that file uses.
"""
import re

_TOKEN = re.compile(r"\\x([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})|(\$[A-Za-z_]+)|(\[)|(\])|'([^']*)'|(\S)")


def _tokens(text, variables):
    """Turn a rule pattern into a list of items: each item is a set of single characters."""
    items, stack = [], None
    for m in _TOKEN.finditer(text):
        x4, x2, u4, var, open_, close, quoted, bare = m.groups()
        if open_:
            stack = set()
            continue
        if close:
            items.append(stack)
            stack = None
            continue
        if var:
            value = variables[var]            # a list of items; only single-set variables are used inside sets
            if stack is not None:
                for item in value:
                    stack |= item
            else:
                items.extend(value)
            continue
        chars = quoted if quoted is not None else (chr(int(x4 or x2 or u4, 16)) if (x4 or x2 or u4) else bare)
        if stack is not None:
            stack |= set(chars)
        else:
            items.extend({c} for c in chars)
    return items


class Converter:
    def __init__(self, rule_path):
        variables = {}
        self.rules = {}                       # first character -> [(order, compiled pattern, replacement)]
        order = 0
        for raw in open(rule_path, encoding="utf-8"):
            line = raw.split("#")[0].strip() if not raw.lstrip().startswith("'") else raw.strip()
            if not line or line.startswith("::"):
                continue
            line = line.rstrip(";").strip()
            if line.startswith("$") and "=" in line and "←" not in line:
                name, value = line.split("=", 1)
                variables[name.strip()] = _tokens(value, variables)
                continue
            if "←" not in line:
                continue
            target, source = line.split("←", 1)
            target = target.strip().strip("'")
            items = _tokens(source, variables)
            if not items:
                continue
            pattern = re.compile("".join("[" + "".join(re.escape(c) for c in sorted(item)) + "]" for item in items))
            order += 1
            for first in items[0]:
                self.rules.setdefault(first, []).append((order, pattern, target))

    def convert(self, text):
        out, i, n = [], 0, len(text)
        while i < n:
            for _, pattern, target in self.rules.get(text[i], ()):
                m = pattern.match(text, i)
                if m:
                    out.append(target)
                    i = m.end()
                    break
            else:
                out.append(text[i])
                i += 1
        return "".join(out)


if __name__ == "__main__":
    import sys
    conv = Converter(sys.argv[1])
    for sample in sys.argv[2:]:
        print(sample, "→", conv.convert(sample))
