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

It also reads the full graph topology — shortest paths between people, cluster
detection, degree distribution — so an officer can ask structural questions
without leaving the chat.
"""

from __future__ import annotations

import re
from collections import deque
from typing import Any, Dict, List, Optional, Set, Tuple

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
_PATH_Q = re.compile(r"\b(path|route|connect(ion|ed)?|link|between|reach|hop|degree|step)\b", re.I)
_GRAPH_Q = re.compile(r"\b(graph|network|topology|structure|cluster|communit|component|"
                      r"isolated|bridge|bottleneck|dense|sparse|overview|summar|analys|analyz|"
                      r"describe|explain)\b", re.I)
_RISK_Q = re.compile(r"\b(risk|suspicious|danger|flag|alert|anomal|unusual|outlier|warning)\b", re.I)
_STOP = {"map", "the", "network", "around", "and", "find", "connector", "in", "of", "for",
         "who", "does", "is", "are", "show", "me", "call", "calls", "called", "talk", "talks",
         "to", "with", "links", "linked", "about", "a", "an", "on", "whom", "connections",
         "connected", "what", "which", "case", "please", "list", "give", "tell", "me", "their",
         "his", "her", "network", "people", "person", "draft", "report", "summary", "between",
         "path", "from", "how"}


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


def _node_label(nid: str) -> str:
    for n in webstore.STATE["nodes"]:
        if n["id"] == nid:
            return n["label"]
    return "Unknown"


def _find_focus(message: str) -> Optional[Dict]:
    mnorm = _norm(message)
    best, best_s = None, 0.0
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
            if vn in mnorm:
                s = 0.95 + min(0.05, len(vn) / 100)
            elif vtok and vtok & set(mnorm.split()):
                s = 0.75 + 0.2 * len(vtok & set(mnorm.split())) / len(vtok)
            else:
                s = max([_name_sim(c, v) for c in candidates] or [0.0])
            if s > best_s:
                best_s, best = s, e
    return best if best_s >= 0.6 else None


def _find_two_people(message: str) -> Tuple[Optional[Dict], Optional[Dict]]:
    """Extract two distinct people from the question for path queries."""
    caps = re.findall(r"[A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)*", message)
    found: List[Dict] = []
    seen_ids: Set[str] = set()
    for cap in caps:
        for e in _entities():
            if e["entity_id"] in seen_ids:
                continue
            names = [e["canonical"]["name"]] + (e.get("variants", {}).get("name") or [])
            for v in names:
                if _name_sim(cap, v) >= 0.6:
                    found.append(e)
                    seen_ids.add(e["entity_id"])
                    break
            if e["entity_id"] in seen_ids:
                break
        if len(found) >= 2:
            break
    return (found[0] if len(found) >= 1 else None, found[1] if len(found) >= 2 else None)


def _neighbours(entity_id: str) -> List[Dict]:
    out = []
    for edge in webstore.STATE["edges"]:
        if edge["source"] == entity_id:
            other = edge["target"]
        elif edge["target"] == entity_id:
            other = edge["source"]
        else:
            continue
        out.append({"name": _node_name(other), "id": other, "type": edge["type"],
                    "label": _node_label(other),
                    "is_case": other in webstore.STATE["cases"]})
    return out


def _overview() -> str:
    s = webstore.stats()
    return (f"{s['entities']} people, {s['relationships']} links across {s['cases']} case(s) "
            f"from {s['files']} uploaded file(s)")


def _connector() -> Optional[Dict]:
    leads = webstore.STATE["leads"]
    return leads[0] if leads else None


# ---- Graph analysis helpers ------------------------------------------------

def _build_adjacency() -> Dict[str, List[str]]:
    adj: Dict[str, List[str]] = {}
    for edge in webstore.STATE["edges"]:
        adj.setdefault(edge["source"], []).append(edge["target"])
        adj.setdefault(edge["target"], []).append(edge["source"])
    return adj


def _shortest_path(src: str, dst: str) -> Optional[List[str]]:
    if src == dst:
        return [src]
    adj = _build_adjacency()
    visited: Set[str] = {src}
    queue: deque[List[str]] = deque([[src]])
    while queue:
        path = queue.popleft()
        for nbr in adj.get(path[-1], []):
            if nbr == dst:
                return path + [nbr]
            if nbr not in visited:
                visited.add(nbr)
                queue.append(path + [nbr])
    return None


def _degree_map() -> Dict[str, int]:
    deg: Dict[str, int] = {}
    for edge in webstore.STATE["edges"]:
        for node in (edge["source"], edge["target"]):
            deg[node] = deg.get(node, 0) + 1
    return deg


def _connected_components() -> List[Set[str]]:
    adj = _build_adjacency()
    all_nodes = set(adj.keys())
    for n in webstore.STATE["nodes"]:
        all_nodes.add(n["id"])
    visited: Set[str] = set()
    components: List[Set[str]] = []
    for node in all_nodes:
        if node in visited:
            continue
        comp: Set[str] = set()
        stack = [node]
        while stack:
            n = stack.pop()
            if n in visited:
                continue
            visited.add(n)
            comp.add(n)
            stack.extend(adj.get(n, []))
        components.append(comp)
    components.sort(key=len, reverse=True)
    return components


def _graph_summary() -> str:
    nodes = webstore.STATE["nodes"]
    edges = webstore.STATE["edges"]
    if not nodes:
        return "The graph is empty — no data has been uploaded yet."

    deg = _degree_map()
    person_nodes = [n for n in nodes if n["label"] == "Person"]
    case_nodes = [n for n in nodes if n["label"] == "Case"]
    components = _connected_components()

    top_by_deg = sorted(person_nodes, key=lambda n: deg.get(n["id"], 0), reverse=True)[:5]

    parts = [f"**Network overview**: {len(nodes)} nodes ({len(person_nodes)} people, "
             f"{len(case_nodes)} cases, {len(nodes) - len(person_nodes) - len(case_nodes)} other) "
             f"and {len(edges)} edges."]

    if len(components) == 1:
        parts.append("The entire network is connected — every node can reach every other node.")
    else:
        sizes = [len(c) for c in components]
        parts.append(f"The network has {len(components)} separate components "
                     f"(sizes: {', '.join(str(s) for s in sizes[:5])}"
                     f"{'...' if len(sizes) > 5 else ''}).")

    if top_by_deg:
        lines = [f"  {i+1}. **{n['name']}** — {deg.get(n['id'], 0)} connections"
                 for i, n in enumerate(top_by_deg)]
        parts.append("**Most connected people**:\n" + "\n".join(lines))

    cross_case = [l for l in webstore.STATE["leads"] if l.get("cross_case")]
    if cross_case:
        names = ", ".join(l["entity_name"] for l in cross_case[:3])
        parts.append(f"**Cross-case links**: {names} — {'this person bridges' if len(cross_case) == 1 else 'these people bridge'} "
                     f"multiple investigations and deserve priority attention.")

    if case_nodes:
        for cn in case_nodes:
            linked = [_node_name(e["source"]) for e in edges
                      if e["target"] == cn["id"] and _node_label(e["source"]) == "Person"]
            if linked:
                parts.append(f"**{cn['name']}**: {len(linked)} people — {', '.join(linked[:6])}"
                             f"{'...' if len(linked) > 6 else ''}.")

    return "\n\n".join(parts)


def _risk_assessment() -> str:
    leads = webstore.STATE["leads"]
    if not leads:
        return "No leads to assess — upload case data first."

    deg = _degree_map()
    parts = ["**Risk assessment** based on network structure:\n"]

    cross_case = [l for l in leads if l.get("cross_case")]
    if cross_case:
        for l in cross_case[:3]:
            parts.append(f"- **{l['entity_name']}** (score {(l['score']*100):.0f}/100): "
                         f"Bridges multiple cases. {l['reason']} {l['recommended_action']}")

    high_deg = sorted(leads, key=lambda l: l["score"], reverse=True)[:3]
    for l in high_deg:
        if not l.get("cross_case"):
            parts.append(f"- **{l['entity_name']}** (score {(l['score']*100):.0f}/100): "
                         f"High connectivity. {l['reason']}")

    isolated = [n for n in webstore.STATE["nodes"]
                if n["label"] == "Person" and deg.get(n["id"], 0) <= 1]
    if isolated:
        parts.append(f"\n{len(isolated)} person(s) with minimal connections — could be peripheral "
                     f"or data may be incomplete for them.")

    return "\n".join(parts)


# ---- Main answer function -------------------------------------------------

def answer(message: str) -> Dict[str, Any]:
    msg = (message or "").strip()
    s = webstore.stats()

    if s["records"] == 0:
        if _GREETING.match(msg) or _HELP.search(msg):
            return {"kind": "chat", "reply":
                    "Hi! I answer questions about the case files you upload — the people in them, "
                    "how they connect, and who the key figure is. I can also analyze the graph "
                    "structure, find paths between people, and flag risk patterns. I don't have any "
                    "data yet, so head to the Upload page, add your files, and then ask me anything."}
        return {"kind": "chat", "reply":
                "I don't have any case data yet. Upload files on the Upload page and I'll "
                "investigate them — then ask me who connects to whom, who the key figure is, "
                "or for a full network analysis."}

    if _GREETING.match(msg) and len(msg.split()) <= 4:
        return {"kind": "chat", "reply":
                f"Hi! I've loaded {_overview()}. Ask me who the key connector is, who a person "
                f"links to, for a network analysis, or the shortest path between two people."}
    if _HELP.search(msg) and not _find_focus(msg):
        return {"kind": "chat", "reply":
                f"I work over what you've uploaded — right now {_overview()}. Try:\n"
                f"• “Who’s the key connector?”\n"
                f"• “Who does <name> connect to?”\n"
                f"• “How many people are there?”\n"
                f"• “Describe the network” or “Analyze the graph”\n"
                f"• “Path between <name1> and <name2>”\n"
                f"• “Risk assessment”\n"
                f"• “List everyone in <case>.”"}

    if _SEND_Q.search(msg):
        return {"kind": "chat", "reply":
                "I won't send anything out on my own — dispatching to a person needs an officer's "
                "sign-off, and that action isn't enabled from here. I can summarise the findings "
                "for you instead."}

    # Risk / anomaly assessment
    if _RISK_Q.search(msg) and not _find_focus(msg):
        return {"kind": "answer", "reply": _risk_assessment()}

    # Graph / network overview
    if _GRAPH_Q.search(msg) and not _find_focus(msg):
        return {"kind": "answer", "reply": _graph_summary()}

    # Path between two people
    if _PATH_Q.search(msg):
        a, b = _find_two_people(msg)
        if a and b:
            path = _shortest_path(a["entity_id"], b["entity_id"])
            if path:
                named = [_node_name(nid) for nid in path]
                return {"kind": "answer",
                        "reply": f"**Shortest path** from **{a['canonical']['name']}** to "
                                 f"**{b['canonical']['name']}** ({len(path) - 1} hop{'s' if len(path) > 2 else ''}):\n\n"
                                 f"{' → '.join(named)}",
                        "focus": a["canonical"]["name"],
                        "path": named}
            else:
                return {"kind": "answer",
                        "reply": f"**{a['canonical']['name']}** and **{b['canonical']['name']}** "
                                 f"are not connected in the current data — they sit in separate "
                                 f"parts of the network."}
        elif a:
            return {"kind": "answer",
                    "reply": f"I found **{a['canonical']['name']}** but couldn't identify a second "
                             f"person. Try: \"Path between {a['canonical']['name']} and <other name>\"."}

    # Counts
    if _COUNT_Q.search(msg):
        what = "people"
        if re.search(r"\bcase", msg, re.I):
            n, what = s["cases"], "cases"
        elif re.search(r"\b(link|relationship|connection|edge)", msg, re.I):
            n, what = s["relationships"], "links"
        elif re.search(r"\b(file|upload|document)", msg, re.I):
            n, what = s["files"], "files"
        else:
            n = s["entities"]
        return {"kind": "answer", "reply": f"There are {n} {what} in the uploaded data ({_overview()})."}

    # Question about a specific person
    focus = _find_focus(msg)
    if focus:
        nbrs = _neighbours(focus["entity_id"])
        people = [n for n in nbrs if not n["is_case"] and n["label"] == "Person"]
        cases = sorted({n["name"] for n in nbrs if n["is_case"]})
        other_assets = [n for n in nbrs if not n["is_case"] and n["label"] != "Person"]

        asked = None
        m = re.findall(r"[A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)*", msg)
        if m and _norm(m[-1]) != _norm(focus["canonical"]["name"]):
            asked = m[-1]
        lead = next((l for l in webstore.STATE["leads"] if l["entity_id"] == focus["entity_id"]), None)
        deg = _degree_map()

        parts = []
        if asked:
            parts.append(f"Closest match to “{asked}” is **{focus['canonical']['name']}**.")
        else:
            parts.append(f"**{focus['canonical']['name']}**.")

        if lead:
            parts.append(f"Priority score: {(lead['score']*100):.0f}/100.")

        if cases:
            parts.append(f"Appears in {', '.join(cases)}.")
        if people:
            listed = ", ".join(f"{p['name']} ({p['type'].lower()})" for p in people[:8])
            parts.append(f"Connected to {len(people)} "
                         + ("person" if len(people) == 1 else "people") + f": {listed}"
                         + ("…" if len(people) > 8 else "."))
        else:
            parts.append("No links to other people in the data yet.")

        if other_assets:
            assets_str = ", ".join(f"{a['name']} ({a['label'].lower()})" for a in other_assets[:5])
            parts.append(f"Associated assets: {assets_str}.")

        if lead and lead.get("cross_case"):
            parts.append("They bridge more than one case, which is worth a closer look.")

        d = deg.get(focus["entity_id"], 0)
        if d >= 5:
            parts.append(f"With {d} total connections, this is one of the most connected nodes in the network.")

        return {"kind": "answer", "reply": " ".join(parts),
                "focus": focus["canonical"]["name"],
                "neighbours": [{"name": p["name"], "type": p["type"]} for p in people],
                "cases": cases}

    # Connector / key figure
    if _CONNECTOR_Q.search(msg) or re.search(r"\bmap\b", msg, re.I):
        c = _connector()
        if not c:
            return {"kind": "answer", "reply": "I don't see a standout connector yet — the uploaded "
                    "records don't link anyone to more than one thing."}
        return {"kind": "answer",
                "reply": f"The key connector is **{c['entity_name']}** ({(c['score']*100):.0f}/100). "
                         f"{c['reason']} {c['recommended_action']}",
                "focus": c["entity_name"]}

    # List people
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

    # Fallback — give a useful summary
    c = _connector()
    hint = f" The most-connected person is **{c['entity_name']}**." if c else ""
    components = _connected_components()
    comp_hint = (f" The network has {len(components)} separate component{'s' if len(components) > 1 else ''}."
                 if len(components) > 1 else "")
    return {"kind": "chat",
            "reply": f"I've got {_overview()}.{hint}{comp_hint} Ask me who someone connects to, "
                     f"who the key figure is, to describe the network, find a path between two "
                     f"people, or for a risk assessment."}
