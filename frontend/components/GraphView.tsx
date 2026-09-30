"use client";

import { useEffect, useMemo, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import type { GraphEdge, GraphNode } from "@/lib/api";

// fcose spaces nodes without overlap and packs disconnected components neatly,
// which base cose does not. Register once.
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
    padding: 80,
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
  const rafRef = useRef<number | null>(null);

  const elements = useMemo(
    () => [
      ...nodes.map((n) => ({ data: { id: n.id, label: n.name, type: n.label } })),
      ...edges.map((e, i) => ({
        data: { id: `e${i}`, source: e.source, target: e.target, label: e.type },
      })),
    ],
    [nodes, edges]
  );

  // Run the layout only once the container has a real size, and re-run it
  // whenever the data changes. Running against a 0-size canvas is what
  // collapses everything onto a single horizontal line.
  const relayout = () => {
    const cy = cyRef.current;
    const el = containerRef.current;
    if (!cy || cy.destroyed() || !el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width < 50 || height < 50 || cy.elements().length === 0) {
      rafRef.current = requestAnimationFrame(relayout);
      return;
    }
    cy.resize();
    cy.layout(makeLayout(cy.nodes().length)).run();
    cy.fit(undefined, 50);
  };

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(relayout);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let t: any;
    const obs = new ResizeObserver(() => {
      const cy = cyRef.current;
      if (!cy || cy.destroyed()) return;
      clearTimeout(t);
      // On resize just refit — a full relayout on every drag is jarring.
      t = setTimeout(() => {
        cy.resize();
        cy.fit(undefined, 50);
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
        "text-margin-y": 8,
        "text-max-width": "120px",
        "text-wrap": "ellipsis",
        width: 30,
        height: 30,
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
        // Edge labels are the main source of clutter on busy graphs — only
        // show them when the graph is small enough to read.
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

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <CytoscapeComponent
        elements={elements}
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
