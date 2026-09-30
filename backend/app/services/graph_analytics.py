"""
Graph analytics over the Neo4j knowledge graph: centrality, community
detection, shortest path, PageRank. Uses plain Cypher aggregation for
degree centrality and shortest path (no extra plugin required), and pulls
the graph into networkx for community detection + PageRank so this works
against community-edition Neo4j without GDS installed.
"""
import networkx as nx

from app.db.neo4j_client import run_query


def degree_centrality(entity_id: str) -> dict:
    query = """
    MATCH (n {id: $entity_id})
    OPTIONAL MATCH (n)-[r]-()
    RETURN n.id AS id, count(r) AS degree
    """
    result = run_query(query, {"entity_id": entity_id})
    return result[0] if result else {"id": entity_id, "degree": 0}


def _load_networkx_graph() -> nx.Graph:
    rows = run_query("""
        MATCH (a)-[r]->(b)
        RETURN a.id AS source, b.id AS target, type(r) AS rel_type, r.confidence AS confidence
    """)
    g = nx.Graph()
    for row in rows:
        weight = row.get("confidence") or 0.5
        g.add_edge(row["source"], row["target"], type=row["rel_type"], weight=weight)
    return g


def community_detection() -> list[dict]:
    g = _load_networkx_graph()
    if g.number_of_nodes() == 0:
        return []
    communities = nx.community.greedy_modularity_communities(g, weight="weight")
    return [
        {"community_id": i, "members": sorted(members)}
        for i, members in enumerate(communities)
    ]


def shortest_path(from_id: str, to_id: str) -> dict:
    query = """
    MATCH (a {id: $from_id}), (b {id: $to_id}),
          p = shortestPath((a)-[*..10]-(b))
    RETURN [n IN nodes(p) | n.id] AS node_path,
           [r IN relationships(p) | type(r)] AS rel_path,
           length(p) AS hops
    """
    result = run_query(query, {"from_id": from_id, "to_id": to_id})
    if not result:
        return {"from": from_id, "to": to_id, "found": False}
    return {"from": from_id, "to": to_id, "found": True, **result[0]}


def pagerank() -> list[dict]:
    g = _load_networkx_graph()
    if g.number_of_nodes() == 0:
        return []
    scores = nx.pagerank(g, weight="weight")
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return [{"entity_id": entity_id, "score": round(score, 6)} for entity_id, score in ranked]
