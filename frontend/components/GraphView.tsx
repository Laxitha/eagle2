"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export const ENTITY_COLORS: Record<string, string> = {
  Person: "#3b82f6",
  Phone: "#22c55e",
  Case: "#ef4444",
  Vehicle: "#f97316",
  Account: "#a855f7",
  Location: "#eab308",
};

// Shape carries the type as well as colour, so the graph still reads for
// anyone who can't tell red from green.
const SHAPES: Record<string, string> = {
  Person: "ellipse",
  Phone: "round-triangle",
  Case: "round-rectangle",
  Vehicle: "round-pentagon",
  Account: "round-diamond",
  Location: "round-hexagon",
};

// Labels are drawn for hubs always, for everything else only once zoomed in.
const LABEL_ZOOM = 1.15;

function layoutFor(degree: Map<string, number>): any {
  const deg = (id: string) => degree.get(id) ?? 0;
  return {
    name: "fcose",
    quality: "proof",
    animate: false,
    fit: true,
    padding: 30,
    randomize: true,
    packComponents: true,
    tile: true,
    tilingPaddingVertical: 40,
    tilingPaddingHorizontal: 40,
    nodeDimensionsIncludeLabels: false,
    // Leaves sit close to their hub; hubs keep their distance from each other.
    // That turns each FIR into a compact, readable cluster.
    idealEdgeLength: (e: any) => {
      const a = deg(e.source().id());
      const b = deg(e.target().id());
      return Math.min(a, b) <= 2 ? 38 : 110 + Math.min(Math.max(a, b), 20) * 3;
    },
    edgeElasticity: (e: any) => (Math.min(deg(e.source().id()), deg(e.target().id())) <= 2 ? 0.8 : 0.2),
    nodeRepulsion: (n: any) => (deg(n.id()) <= 2 ? 1800 : 9000 + Math.min(deg(n.id()), 20) * 600),
    nodeSeparation: 60,
    gravity: 0.35,
    gravityRange: 3.0,
    numIter: 4000,
  };
}

export default function GraphView({
  nodes,
  edges,
  selectedId,
  highlightIds,
  onNodeClick,
  onBackgroundClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string | null;
  /** Nodes matching a search; everything else is dimmed. */
  highlightIds?: Set<string> | null;
  onNodeClick?: (id: string) => void;
  onBackgroundClick?: () => void;
}) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const handlers = useRef({ onNodeClick, onBackgroundClick });
  handlers.current = { onNodeClick, onBackgroundClick };

  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [edges]);

  const elements = useMemo(() => {
    const maxDeg = Math.max(1, ...Array.from(degree.values()));
    return [
      ...nodes.map((n) => {
        const d = degree.get(n.id) ?? 0;
        return {
          data: {
            id: n.id,
            label: n.name,
            type: n.label,
            degree: d,
            // 16px for a leaf up to 54px for the best-connected node
            size: Math.round(16 + 38 * Math.sqrt(d / maxDeg)),
          },
          classes: d >= 4 || n.label === "Case" ? "hub" : "",
        };
      }),
      ...edges.map((e, i) => ({
        data: { id: `e${i}`, source: e.source, target: e.target, label: e.type.replace(/_/g, " ").toLowerCase() },
      })),
    ];
  }, [nodes, edges, degree]);

  const layout = useMemo(() => layoutFor(degree), [degree]);

  const signature = useMemo(() => `${nodes.map((n) => n.id).join("|")}#${edges.length}`, [nodes, edges.length]);
  const prevSig = useRef(signature);
  useEffect(() => {
    if (signature !== prevSig.current) {
      prevSig.current = signature;
      setLayoutKey((k) => k + 1);
    }
  }, [signature]);

  // Focus: the selected node and its neighbours stay lit, everything else
  // fades back. A search highlights its matches the same way.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed()) return;
    cy.batch(() => {
      cy.elements().removeClass("faded focus neighbour");
      if (selectedId) {
        const node = cy.getElementById(selectedId);
        if (node.nonempty()) {
          const hood = node.closedNeighborhood();
          cy.elements().not(hood).addClass("faded");
          hood.addClass("neighbour");
          node.addClass("focus");
        }
      } else if (highlightIds && highlightIds.size) {
        const hits = cy.nodes().filter((n) => highlightIds.has(n.id()));
        const hood = hits.closedNeighborhood();
        cy.elements().not(hood).addClass("faded");
        hits.addClass("focus");
        hood.nodes().addClass("neighbour");
      }
    });
    // Move the camera once input settles; a new selection or keystroke
    // cancels the previous move instead of stacking on top of it.
    const t = setTimeout(() => {
      if (cy.destroyed()) return;
      cy.stop(true, false);
      let target: cytoscape.Collection | null = null;
      if (selectedId) target = cy.getElementById(selectedId).closedNeighborhood();
      else if (highlightIds && highlightIds.size)
        target = cy.nodes().filter((n) => highlightIds.has(n.id())).closedNeighborhood();
      if (target && target.nonempty()) cy.animate({ fit: { eles: target, padding: 70 }, duration: 350 });
      else if (!selectedId && !highlightIds) cy.animate({ fit: { eles: cy.elements(), padding: 30 }, duration: 300 });
    }, selectedId ? 60 : 300);
    return () => clearTimeout(t);
  }, [selectedId, highlightIds, layoutKey]);

  const applyZoomClass = useCallback((cy: cytoscape.Core) => {
    const zoomed = cy.zoom() >= LABEL_ZOOM;
    const el = cy.container();
    if (el) el.dataset.zoomed = zoomed ? "1" : "0";
    cy.nodes().toggleClass("zoomed", zoomed);
  }, []);

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
        // Keep a focused selection in view when a side panel opens or closes.
        const focus = cy.$("node.focus");
        cy.stop(true, false);
        if (focus.nonempty()) cy.animate({ fit: { eles: focus.closedNeighborhood(), padding: 80 }, duration: 250 });
        else cy.fit(undefined, 30);
      }, 120);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stylesheet: cytoscape.StylesheetStyle[] = [
    {
      selector: "node",
      style: {
        "background-color": (ele: any) => ENTITY_COLORS[ele.data("type")] ?? "#64748b",
        shape: (ele: any) => SHAPES[ele.data("type")] ?? "ellipse",
        width: "data(size)",
        height: "data(size)",
        "border-width": 1.5,
        "border-color": "#0b1120",
        label: "",
        color: "#cbd5e1",
        "font-size": 9,
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-max-width": "110px",
        "text-wrap": "ellipsis",
        "text-outline-color": "#0b1120",
        "text-outline-width": 2,
        "transition-property": "opacity",
        "transition-duration": 150,
      } as any,
    },
    { selector: "node.hub", style: { label: "data(label)", "font-size": 11, "font-weight": 600, color: "#f1f5f9" } as any },
    { selector: "node.zoomed", style: { label: "data(label)" } },
    {
      selector: "edge",
      style: {
        width: 1,
        "line-color": "#64748b",
        opacity: 0.6,
        "curve-style": "haystack",
        "haystack-radius": 0,
        "transition-property": "opacity",
        "transition-duration": 150,
      } as any,
    },
    { selector: ".faded", style: { opacity: 0.08, label: "" } as any },
    { selector: "node.neighbour", style: { label: "data(label)", opacity: 1 } },
    {
      selector: "edge.neighbour",
      style: {
        opacity: 1,
        width: 1.8,
        "line-color": "#94a3b8",
        "curve-style": "bezier",
        label: "data(label)",
        "font-size": 8,
        color: "#94a3b8",
        "text-rotation": "autorotate",
        "text-background-color": "#0b1120",
        "text-background-opacity": 0.9,
        "text-background-padding": "2px",
      } as any,
    },
    { selector: "node.focus", style: { "border-color": "#f59e0b", "border-width": 3, label: "data(label)", "font-size": 12, "font-weight": 700, color: "#ffffff", "z-index": 10 } as any },
    { selector: "node:active", style: { "overlay-opacity": 0 } as any },
  ];

  if (elements.length === 0) {
    return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
  }

  const zoomBy = (f: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: { level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }, duration: 200 });
  };

  return (
    <div ref={containerRef} className="relative" style={{ width: "100%", height: "100%" }}>
      <CytoscapeComponent
        key={layoutKey}
        elements={elements}
        layout={layout}
        stylesheet={stylesheet}
        minZoom={0.15}
        maxZoom={3}
        style={{ width: "100%", height: "100%" }}
        cy={(cy) => {
          if (cy.destroyed() || cyRef.current === cy) return;
          cyRef.current = cy;
          cy.on("tap", "node", (evt) => handlers.current.onNodeClick?.(evt.target.id()));
          cy.on("tap", (evt) => {
            if (evt.target === cy) handlers.current.onBackgroundClick?.();
          });
          cy.on("zoom", () => applyZoomClass(cy));
          cy.one("layoutstop", () => applyZoomClass(cy));
          // hover: show the name of whatever is under the pointer
          cy.on("mouseover", "node", (evt) => evt.target.style("label", evt.target.data("label")));
          cy.on("mouseout", "node", (evt) => evt.target.removeStyle("label"));
        }}
      />

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        {[
          { t: "+", f: () => zoomBy(1.3), title: "Zoom in" },
          { t: "−", f: () => zoomBy(1 / 1.3), title: "Zoom out" },
          { t: "⤢", f: () => cyRef.current?.animate({ fit: { eles: cyRef.current.elements(), padding: 30 }, duration: 300 }), title: "Fit everything" },
        ].map((b) => (
          <button
            key={b.title}
            title={b.title}
            onClick={b.f}
            className="h-7 w-7 rounded-md border border-slate-700/60 bg-slate-900/80 text-sm text-slate-300 hover:text-white hover:border-slate-500"
          >
            {b.t}
          </button>
        ))}
      </div>
    </div>
  );
}
