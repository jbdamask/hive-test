#!/usr/bin/env python3
"""Write a blind check file from old and new result files, with the A/B order hidden, and a separate key file.

Each case gives a name, the old code's result file and the new code's result file. Put in each result file exactly
what the project's own runner prints (for the game, game/sim/run.js), so days, ticks and wording in the check are
the runner's and not a re-computation. The check file has two parts (hive/FIXES.md "The blind check"): the sources
first, then every case's results as A and B. Which side is new is drawn per case from a cryptographic coin
(secrets), so neither the order of the cases nor a seed can give it away; if every case lands the same way the
draw is repeated, so a check of two or more cases always has the new side in A on some and in B on others.
The key file says, per case, "A is new" or "B is new"; give it only to whoever reads the verdict, never to the checker.

  python3 hive/tools/blind_pair.py --title "Blind check: laying limit (bug hive-test-qlq)" \\
      --sources sources.md --out check.md --key key.json \\
      --case "seed 11, balanced" old/11-balanced.txt new/11-balanced.txt \\
      --case "seed 11, change-nothing" old/11-change-nothing.txt new/11-change-nothing.txt
"""
from __future__ import annotations

import argparse
import json
import secrets
import sys
from pathlib import Path


def draw(n: int, coin=lambda: secrets.randbits(1)) -> list[bool]:
    """One coin per case; True means the new result is shown as A. Redrawn while all cases agree (n >= 2)."""
    while True:
        sides = [coin() == 1 for _ in range(n)]
        if n < 2 or any(sides) and not all(sides):
            return sides


def build(title: str, sources: str, cases: list[tuple[str, str, str]], sides: list[bool]) -> tuple[str, dict]:
    """cases: (name, old text, new text). Returns the check file's text and the key."""
    out = [f"# {title}", "", "## Part 1: the sources. Judge each case from these before reading Part 2.", "",
           sources.strip(), "", "Cases: " + "; ".join(name for name, _, _ in cases), "",
           "## Part 2: results. A and B are the old and new code, in an order hidden from you, drawn per case.", ""]
    key = {}
    for (name, old, new), new_is_a in zip(cases, sides):
        a, b = (new, old) if new_is_a else (old, new)
        key[name] = "A is new" if new_is_a else "B is new"
        out += [f"### {name}", "", "A:", "", "```", a.rstrip("\n"), "```", "", "B:", "", "```", b.rstrip("\n"), "```", ""]
    return "\n".join(out), key


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--title", required=True)
    p.add_argument("--sources", required=True, help="file with each case's source text (Part 1)")
    p.add_argument("--case", nargs=3, action="append", required=True, metavar=("NAME", "OLD", "NEW"))
    p.add_argument("--out", required=True, help="the check file to write")
    p.add_argument("--key", required=True, help="the key file to write; keep it from the checker")
    a = p.parse_args(argv)
    if Path(a.out).resolve() == Path(a.key).resolve():
        print("blind_pair: --out and --key must be different files", file=sys.stderr)
        return 2
    names = [c[0] for c in a.case]
    if len(set(names)) != len(names):
        print("blind_pair: case names must be unique", file=sys.stderr)
        return 2
    cases = [(name, Path(old).read_text(encoding="utf-8"), Path(new).read_text(encoding="utf-8"))
             for name, old, new in a.case]
    text, key = build(a.title, Path(a.sources).read_text(encoding="utf-8"), cases, draw(len(cases)))
    Path(a.out).write_text(text, encoding="utf-8")
    Path(a.key).write_text(json.dumps(key, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(cases)} cases to {a.out}; key in {a.key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
