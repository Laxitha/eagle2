"""
webagent.py — the conversational agent that answers over UPLOADED data.

Everything here reads the live case store (webstore.STATE): the people it has
resolved, the cases, and the graph edges built from what was uploaded. There is
no sample data and no fixture fallback — an empty store means "I don't have
anything yet, upload some files", not a canned demo case.

It understands plain questions ("who's the connector?", "who does Suresh Nair
talk to?", "how many people are there?") and answers from the graph, using the
resolver's name matching so a half-spelled or differently-spelled name still
finds the right person.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from . import webstore

_GREETING = re.compile(r"^\s*(hi+|hey+|hello|hola|yo|namaste|good\s*(morning|afternoon|evening)|"
                       r"greetings|sup|what'?s\s*up)\b", re.I)
_HELP = re.compile(r"\b(help|what can you do|how do you work|what do you do|capabilit|who are you|"
                   r"what are you)\b", re.I)
_CONNECTOR_Q = re.compile(r"\b(connector|key\s*(person|player|figure)|kingpin|mastermind|hub|"
                          r"who\s+connects|most\s+(important|central|linked)|ring\s*leader|"
                          r"central\s+figure)\b", re.I)
_COUNT_Q = re.compile(r"\b(how many|count|number of|total)\b", re.I)
_LIST_Q = re.compile(r"\b(list|show( me)?|who('?s| is| are)|everyone|all (the )?(people|persons|names))\b", re.I)
_SEND_Q = re.compile(r"\b(email|send|forward|notify|dispatch)\b", re.I)
_STOP = {"map", "the", "network", "around", "and", "find", "connector", "in", "of", "for",
         "who", "does", "is", "are", "show", "me", "call", "calls", "called", "talk", "talks",
         "to", "with", "links", "linked", "about", "a", "an", "on", "whom", "connections",
         "connected", "what", "which", "case", "please", "list", "give", "tell", "me", "their",
         "his", "her", "network", "people", "person", "draft", "report", "summary"}


def _norm(s: str) -> str:
    return " ".join(re.sub(r"[^a-z\s]", " ", str(s).lower()).split())


def _name_sim(a: str, b: str) -> float:
    try:
        from . import tools
        tools._load_backends()
        fn = tools._resolver_fn("name_similarity", "compare_names", "name_score")
        if fn:
            return float(fn(a, b))
    except Exception:
        pass
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    at, bt = set(na.split()), set(nb.split())
    return len(at & bt) / max(len(at | bt), 1)


def _entities() -> List[Dict]:
    return webstore.STATE["entities"]


def _node_name(nid: str) -> str:
    for n in webstore.STATE["nodes"]:
        if n["id"] == nid:
            return n["name"]
    return nid


def _find_focus(message: str) -> Optional[Dict]:
    """Which uploaded person is this question about? Direct name match first,
    then the resolver's fuzzy match so a different spelling still lands."""
    mnorm = _norm(message)
    best, best_s = None, 0.0
    # candidate name phrases in the message (capitalised runs), plus the
    # leftover words after stripping command words.
    caps = re.findall(r"[A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)*", message)
    leftover = " ".join(w for w in re.findall(r"[A-Za-z.]+", message) if w.lower() not in _STOP)
    candidates = [c for c in caps if c] + ([leftover] if leftover.strip() else [])

    for e in _entities():
        names = [e["canonical"]["name"]] + (e.get("variants", {}).get("name") or [])
        for v in names:
            vn = _norm(v)
            if not vn:
                continue
            vtok = set(vn.split())
            if vn in mnorm:                     # full name appears in the question
                s = 0.95 + min(0.05, len(vn) / 100)
            elif vtok and vtok & set(mnorm.split()):
                # a name token appears in the question ("Suresh" -> "Suresh Nair",
                # "Nair" -> "Suresh Nair"): strong partial hit, scaled by how much
                # of the name is covered.
                s = 0.75 + 0.2 * len(vtok & set(mnorm.split())) / len(vtok)
            else:
                s = max([_name_sim(c, v) for c in candidates] or [0.0])
            if s > best_s:
                best_s, best = s, e
    return best if best_s >= 0.6 else None


def _neighbours(entity_id: str) -> List[Dict]:
    out = []
    for edge in webstore.STATE["edges"]:
        if edge["source"] == entity_id:
            other = edge["target"]
        elif edge["target"] == entity_id:
            other = edge["source"]
        else:
            continue
        out.append({"name": _node_name(other), "type": edge["type"],
                    "is_case": other in webstore.STATE["cases"]})
    return out


def _overview() -> str:
    s = webstore.stats()
    return (f"{s['entities']} people, {s['relationships']} links across {s['cases']} case(s) "
            f"from {s['files']} uploaded file(s)")


def _connector() -> Optional[Dict]:
    leads = webstore.STATE["leads"]
    return leads[0] if leads else None


def answer(message: str) -> Dict[str, Any]:
    msg = (message or "").strip()
    s = webstore.stats()

    # Nothing uploaded — say so, never fall back to sample data.
    if s["records"] == 0:
        if _GREETING.match(msg) or _HELP.search(msg):
            return {"kind": "chat", "reply":
                    "Hi! I answer questions about the case files you upload — the people in them, "
                    "how they connect, and who the key figure is. I don't have any data yet, so "
                    "head to the Upload page, add your files, and then ask me anything."}
        return {"kind": "chat", "reply":
                "I don't have any case data yet. Upload files on the Upload page and I'll "
                "investigate them — then ask me who connects to whom, or who the key figure is."}

    if _GREETING.match(msg) and len(msg.split()) <= 4:
        return {"kind": "chat", "reply":
                f"Hi! I've loaded {_overview()}. Ask me who the key connector is, who a person "
                f"links to, or how many people are involved."}
    if _HELP.search(msg) and not _find_focus(msg):
        return {"kind": "chat", "reply":
                f"I work over what you've uploaded — right now {_overview()}. Try:\n"
                f"• “Who's the key connector?”\n"
                f"• “Who does <name> connect to?”\n"
                f"• “How many people are there?”\n"
                f"• “List everyone in <case>.”"}

    # won't send anything externally
    if _SEND_Q.search(msg):
        return {"kind": "chat", "reply":
                "I won't send anything out on my own — dispatching to a person needs an officer's "
                "sign-off, and that action isn't enabled from here. I can summarise the findings "
                "for you instead."}

    # counts
    if _COUNT_Q.search(msg):
        what = "people"
        if re.search(r"\bcase", msg, re.I):
            n, what = s["cases"], "cases"
        elif re.search(r"\b(link|relationship|connection|edge)", msg, re.I):
            n, what = s["relationships"], "links"
        else:
            n = s["entities"]
        return {"kind": "answer", "reply": f"There are {n} {what} in the uploaded data ({_overview()})."}

    # question about a specific person / "map around X"
    focus = _find_focus(msg)
    if focus:
        nbrs = _neighbours(focus["entity_id"])
        people = [n for n in nbrs if not n["is_case"]]
        cases = sorted({n["name"] for n in nbrs if n["is_case"]})
        asked = None
        m = re.findall(r"[A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)*", msg)
        if m and _norm(m[-1]) != _norm(focus["canonical"]["name"]):
            asked = m[-1]
        lead = next((l for l in webstore.STATE["leads"] if l["entity_id"] == focus["entity_id"]), None)

        parts = []
        if asked:
            parts.append(f"Closest match to “{asked}” is **{focus['canonical']['name']}**.")
        else:
            parts.append(f"**{focus['canonical']['name']}**.")
        if cases:
            parts.append(f"Appears in {', '.join(cases)}.")
        if people:
            listed = ", ".join(f"{p['name']} ({p['type'].lower()})" for p in people[:8])
            parts.append(f"Connected to {len(people)} "
                         + ("person" if len(people) == 1 else "people") + f": {listed}"
                         + ("…" if len(people) > 8 else "."))
        else:
            parts.append("No links to other people in the data yet.")
        if lead and lead.get("cross_case"):
            parts.append("They bridge more than one case, which is worth a closer look.")
        return {"kind": "answer", "reply": " ".join(parts),
                "focus": focus["canonical"]["name"],
                "neighbours": [{"name": p["name"], "type": p["type"]} for p in people],
                "cases": cases}

    # connector / key figure
    if _CONNECTOR_Q.search(msg) or re.search(r"\bmap\b", msg, re.I):
        c = _connector()
        if not c:
            return {"kind": "answer", "reply": "I don't see a standout connector yet — the uploaded "
                    "records don't link anyone to more than one thing."}
        return {"kind": "answer",
                "reply": f"The key connector is **{c['entity_name']}** ({(c['score']*100):.0f}/100). "
                         f"{c['reason']} {c['recommended_action']}",
                "focus": c["entity_name"]}

    # list people / who is in a case
    if _LIST_Q.search(msg):
        cm = re.search(r"(case[-\s]?\w+|fir[-\s/]?\w+)", msg, re.I)
        if cm:
            cid = cm.group(1).upper().replace(" ", "-")
            names = sorted({_node_name(e["source"]) for e in webstore.STATE["edges"]
                            if e["target"] == cid and e["type"] == "LINKED_TO"})
            if not names:
                return {"kind": "answer", "reply": f"I don't have anyone linked to {cid}."}
            return {"kind": "answer", "reply": f"In {cid}: {', '.join(names)}."}
        names = [e["canonical"]["name"] for e in _entities()][:25]
        return {"kind": "answer", "reply": f"People in the data: {', '.join(names)}."}

    # fallback
    c = _connector()
    hint = f" The most-connected person is {c['entity_name']}." if c else ""
    return {"kind": "chat",
            "reply": f"I've got {_overview()}.{hint} Ask me who someone connects to, who the key "
                     f"figure is, or to list everyone in a case."}
