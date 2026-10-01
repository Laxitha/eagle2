"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import type { GraphEdge, GraphNode } from "@/lib/api";

if (typeof (cytoscape as any).__fcose === "undefined") {
  try {
    cytoscape.use(fcose as any);
    (cytoscape as any).__fcose = true;
  } catch {
    /* already registered */
  }
}

const ENTITY_COLORS: Record<string, string> = {
  Person: "#3b82f6",
  Phone: "#22c55e",
  Case: "#ef4444",
  Vehicle: "#f97316",
  Account: "#a855f7",
  Location: "#eab308",
};

function makeLayout(nodeCount: number): any {
  const sep = nodeCount > 60 ? 160 : nodeCount > 25 ? 130 : 120;
  const edgeLen = nodeCount > 60 ? 180 : nodeCount > 25 ? 160 : 150;
  return {
    name: "fcose",
    quality: "proof",
    animate: false,
    fit: true,
    padding: 60,
    randomize: true,
    packComponents: true,
    nodeSeparation: sep,
    nodeRepulsion: () => 15000,
    idealEdgeLength: () => edgeLen,
    edgeElasticity: () => 0.35,
    gravity: 0.1,
    gravityRange: 5.0,
    numIter: 5000,
  };
}

export default function GraphView({
  nodes,
  edges,
  onNodeClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (id: string) => void;
}) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Force CytoscapeComponent to remount when the element set changes
  // structurally — this ensures fcose runs fresh on the complete graph.
  const [layoutKey, setLayoutKey] = useState(0);

  const elements = useMemo(
    () => [
      ...nodes.map((n) => ({ data: { id: n.id, label: n.name, type: n.label } })),
      ...edges.map((e, i) => ({
        data: { id: `e${i}`, source: e.source, target: e.target, label: e.type },
      })),
    ],
    [nodes, edges]
  );

  const layout = useMemo(() => makeLayout(nodes.length), [nodes.length]);

  // When the data changes, bump the key so the component remounts with a
  // fresh fcose layout instead of patching elements into an existing
  // "preset"-positioned graph.
  const prevCountRef = useRef(elements.length);
  useEffect(() => {
    if (elements.length > 0 && elements.length !== prevCountRef.current) {
      prevCountRef.current = elements.length;
      setLayoutKey((k) => k + 1);
    }
  }, [elements.length]);

  // After mount, wait for the container to have a real size, then refit.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const obs = new ResizeObserver(() => {
      const cy = cyRef.current;
      if (!cy || cy.destroyed()) return;
      clearTimeout(t);
      t = setTimeout(() => {
        cy.resize();
        cy.fit(undefined, 40);
      }, 120);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const denseEdges = edges.length > 40;

  const stylesheet: cytoscape.StylesheetStyle[] = [
    {
      selector: "node",
      style: {
        "background-color": (ele: any) => ENTITY_COLORS[ele.data("type")] ?? "#64748b",
        label: "data(label)",
        color: "#e2e8f0",
        "font-size": 10,
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-max-width": "100px",
        "text-wrap": "ellipsis",
        width: 28,
        height: 28,
        "border-width": 2,
        "border-color": "#0f172a",
      },
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": "#475569",
        "target-arrow-color": "#475569",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        label: denseEdges ? "" : "data(label)",
        "font-size": 8,
        color: "#94a3b8",
        "text-background-color": "#0f172a",
        "text-background-opacity": 0.85,
        "text-background-padding": "2px",
      },
    },
    {
      selector: "node:selected",
      style: { "border-color": "#f59e0b", "border-width": 3 },
    },
  ];

  if (elements.length === 0) {
    return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <CytoscapeComponent
        key={layoutKey}
        elements={elements}
        layout={layout}
        stylesheet={stylesheet}
        style={{ width: "100%", height: "100%" }}
        cy={(cy) => {
          if (cy.destroyed()) return;
          cyRef.current = cy;
          cy.off("tap", "node");
          cy.on("tap", "node", (evt) => onNodeClick?.(evt.target.id()));
        }}
      />
    </div>
  );
}
