#!/usr/bin/env python3
"""PreToolUse hook: refuse `bd close` (or `bd done`) while a bead that blocks it is still open.

Why: a bead closed past an open blocker hides unfinished work. bd itself does not refuse it, so this hook does,
for every agent and the lead.

What counts: a dependency of type `blocks` whose status is not `closed` (`bd show <id> --json`). A blocker
closed in the same command counts as closed. `--force` does not get past it. A close whose reason says
superseded, duplicate, not needed or won't do is allowed. The way out is
the tracker's own: close the blocker first, or `bd dep remove <id> <blocker>` with a note saying why.
A bead of type bug also needs a closed `blocks` dependency labelled role:blind-checker (hive/FIXES.md 'The blind
check'), because that check was skipped on four fixes in a row. Other link types (discovered-from) do not count.
If bd fails or the bead is unknown, the hook lets the command through (bd reports the error itself).
"""
import json
import re
import shlex
import subprocess
import sys
from pathlib import Path

# Closes that are not "done" closes.
WASTE = re.compile(r"^(\w[\w ]{0,20}: )?(superseded|duplicate|not needed|won'?t (do|fix))\b", re.I)
BLIND = "role:blind-checker"
QUICK = re.compile(r"\bbd\b.*\b(close|done)\b", re.S)
SEPARATORS = {";", "&&", "||", "|", "&", "(", ")", "\n"}
SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
TEXT = {"bd", "git", "echo", "printf"}  # commands whose words are text, never run (but for $(...))
GLOBAL_VALUE = {"-C", "--directory", "--db", "--database", "--actor", "--dolt-auto-commit"}
CLOSE_VALUE = {"-r", "--reason", "--reason-file", "--session", "--actor", "--db", "--database", "-C",
               "--directory", "--dolt-auto-commit"}


def _segments(cmd: str) -> list[list[str]]:
    lex = shlex.shlex(cmd.replace("\n", " ; "), posix=True, punctuation_chars=";&|()")
    lex.whitespace_split = True
    out, cur = [], []
    for tok in lex:
        if tok in SEPARATORS or set(tok) <= set(";&|()"):
            if cur:
                out.append(cur)
            cur = []
        else:
            cur.append(tok)
    if cur:
        out.append(cur)
    return out


def _subs(word: str) -> list[str]:
    """The bodies of every `$(...)` in one word: the shell runs these even inside double quotes."""
    out, k = [], word.find("$(")
    while k >= 0:
        depth, j = 0, k + 1
        while j < len(word):
            depth += {"(": 1, ")": -1}.get(word[j], 0)
            if depth == 0:
                break
            j += 1
        out.append(word[k + 2:j])
        k = word.find("$(", j)
    return out


def _bare_shell(segs: list[list[str]]) -> bool:
    """A shell with no -c in the command (`echo ... | sh`): text printed elsewhere in it may be run."""
    return any(seg and Path(seg[0]).name in SHELLS and not any(re.fullmatch(r"-[A-Za-z]*c[A-Za-z]*", w) for w in seg)
               for seg in segs)


def closes(cmd: str, depth: int = 0) -> list[dict]:
    """Every `bd close` in a shell command: {"ids", "reasons", "reason_files", "dir"}.

    Any word a command gets may be a command line it runs (`env zsh -c '...'`, `sudo`, `timeout`, `xargs sh -c`,
    `with-key`), so a word holding a close is read as one. The exception is the words given to bd, git, echo and
    printf (a note, a commit message): only the `$(...)` and backtick parts of those run. Over-refusing beats a
    missed close."""
    cmd = re.sub(r"`([^`]*)`", r"$(\1)", cmd)
    try:
        segs = _segments(cmd)
    except ValueError:
        return []
    text_ok = not _bare_shell(segs)
    found = []
    for seg in segs:
        i = 0
        while i < len(seg) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", seg[i]):
            i += 1  # leading VAR=value
        head = Path(seg[i]).name if i < len(seg) else ""
        if depth < 4:
            for k, w in enumerate(seg):
                if k < i or (head in TEXT and text_ok and k > i):
                    for body in _subs(w):
                        found += closes(body, depth + 1)
                elif k > i and QUICK.search(w):
                    found += closes(w, depth + 1)
        if head in TEXT and head != "bd":
            continue
        while i < len(seg) and Path(seg[i]).name != "bd":
            i += 1
        if i >= len(seg):
            continue
        i += 1
        bd_dir = None
        while i < len(seg) and seg[i].startswith("-"):
            flag = seg[i].split("=", 1)[0]
            if flag in ("-C", "--directory"):
                bd_dir = seg[i].split("=", 1)[1] if "=" in seg[i] else (seg[i + 1] if i + 1 < len(seg) else None)
            i += 2 if (seg[i] in GLOBAL_VALUE) else 1
        if i >= len(seg) or seg[i] not in ("close", "done"):
            continue
        rec = {"ids": [], "reasons": [], "reason_files": [], "dir": bd_dir}
        i += 1
        while i < len(seg):
            tok = seg[i]
            flag, eq, val = tok.partition("=")
            if tok.startswith("-") and flag in CLOSE_VALUE:
                if not eq:
                    val = seg[i + 1] if i + 1 < len(seg) else ""
                    i += 1
                if flag in ("-r", "--reason"):
                    rec["reasons"].append(val)
                elif flag == "--reason-file":
                    rec["reason_files"].append(val)
                elif flag in ("-C", "--directory"):
                    rec["dir"] = val
            elif not tok.startswith("-"):
                rec["ids"].append(tok)
            i += 1
        found.append(rec)
    return found


def _reason_text(rec: dict, cwd: str) -> list[str]:
    texts = list(rec["reasons"])
    for f in rec["reason_files"]:
        p = Path(f) if Path(f).is_absolute() else Path(cwd) / f
        try:
            texts.append(p.read_text(encoding="utf-8"))
        except OSError:
            pass
    return texts


def _show(ids: list[str], cwd: str, bd_dir: str | None) -> list[dict]:
    args = ["bd"] + (["-C", bd_dir] if bd_dir else []) + ["show", *ids, "--json"]
    try:
        r = subprocess.run(args, cwd=cwd or None, capture_output=True, text=True, timeout=20)
        data = json.loads(r.stdout or "[]")
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return []
    return data if isinstance(data, list) else [data]


def refusals(rec: dict, cwd: str) -> tuple[dict[str, list[str]], list[str]]:
    """({bead id: [open blocker ids]}, [bug ids with no closed blind check]) for one close; both empty when allowed."""
    ids = rec["ids"]
    if not ids:
        return {}, []
    texts = _reason_text(rec, cwd)
    if texts and all(WASTE.match(t.strip()) for t in texts):
        return {}, []
    closing = set(ids)
    bad, bugs = {}, {}
    for b in _show(ids, cwd, rec["dir"]):
        if not isinstance(b, dict):
            continue
        deps = [d for d in b.get("dependencies") or [] if d.get("id") != b.get("id")]
        held = [d.get("id") for d in deps
                if d.get("dependency_type") == "blocks" and d.get("status") != "closed"
                and d.get("id") not in closing]
        if held:
            bad[b.get("id")] = held
        if b.get("issue_type") == "bug":
            bugs[b.get("id")] = [d.get("id") for d in deps if d.get("dependency_type") == "blocks"
                                 and (d.get("status") == "closed" or d.get("id") in closing)]
    return bad, unchecked(bugs, cwd, rec["dir"])


def unchecked(bugs: dict[str, list[str]], cwd: str, bd_dir: str | None) -> list[str]:
    """Bug ids (from {bug id: [closed dependency ids]}) with no closed dependency labelled role:blind-checker."""
    want = sorted({d for ds in bugs.values() for d in ds if d})
    checkers = {b.get("id") for b in (_show(want, cwd, bd_dir) if want else [])
                if isinstance(b, dict) and BLIND in (b.get("labels") or [])}
    return [bug for bug, ds in bugs.items() if not checkers & set(ds)]


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    if data.get("tool_name") != "Bash":
        return 0
    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not QUICK.search(cmd):
        return 0
    cwd = data.get("cwd") or ""
    bad, bugs = {}, []
    for rec in closes(cmd):
        held, unc = refusals(rec, cwd)
        bad.update(held)
        bugs += unc
    if bad or bugs:
        print(json.dumps(deny(bad, bugs)))
    return 0


def deny(bad: dict[str, list[str]], bugs: list[str] = ()) -> dict:
    parts = []
    if bad:
        what = "; ".join(f"{b} is blocked by {', '.join(h)}" for b, h in bad.items())
        parts.append(f"Refused: {what} (still open). Never close a bead past an open blocker; --force does not get past this. "
                     "Close the blocker first, or if the link is wrong, remove it with bd dep remove <id> <blocker> "
                     "and a bd note saying why.")
    if bugs:
        parts.append(f"Refused: bug {', '.join(bugs)} has no closed {BLIND} bead it depends on (hive/FIXES.md "
                     "'The blind check'). File the check bead with that label, bd dep add <bug> <check>, "
                     "and close the bug after its verdict.")
    parts.append("If the bead is superseded or a duplicate, start the reason with that word.")
    reason = " ".join(parts)
    return {"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}


if __name__ == "__main__":
    sys.exit(main())
