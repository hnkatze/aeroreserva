"use client";

import "@xyflow/react/dist/style.css";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useMemo } from "react";

import { TablaNode, type TablaNode as TablaNodeType } from "./tabla-node";
import type { EsquemaDB } from "@/lib/esquema";

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 220;

function estimateHeight(columnCount: number): number {
  // header 36px + each column row 32px
  return 36 + columnCount * 32;
}

const nodeTypes: NodeTypes = {
  tabla: TablaNode,
};

// ── Dagre layout ─────────────────────────────────────────────────────────────

function buildLayout(
  nodes: TablaNodeType[],
  edges: Edge[],
): TablaNodeType[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    const height = estimateHeight(node.data.columnas.length);
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const height = estimateHeight(node.data.columnas.length);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - height / 2,
      },
    };
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ErDiagramProps {
  esquema: EsquemaDB;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ErDiagram({ esquema }: ErDiagramProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const rawNodes: TablaNodeType[] = esquema.tablas.map((tabla) => ({
      id: tabla.nombre,
      type: "tabla" as const,
      position: { x: 0, y: 0 },
      data: {
        nombre: tabla.nombre,
        columnas: tabla.columnas,
      },
      draggable: true,
    }));

    const edges: Edge[] = esquema.relaciones.map((rel) => ({
      id: rel.constraint,
      source: rel.origen,
      target: rel.destino,
      label: `${rel.columnaOrigen} → ${rel.columnaDestino}`,
      labelStyle: { fontSize: 10, fill: "var(--color-muted-foreground)" },
      labelBgStyle: {
        fill: "var(--color-card)",
        fillOpacity: 0.9,
      },
      style: {
        stroke: "var(--color-primary)",
        strokeOpacity: 0.5,
        strokeWidth: 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--color-primary)",
      },
      type: "smoothstep",
    }));

    const positionedNodes = buildLayout(rawNodes, edges);

    return { initialNodes: positionedNodes, initialEdges: edges };
  }, [esquema]);

  const tableCount = esquema.tablas.length;
  const relCount = esquema.relaciones.length;

  return (
    <figure
      className="h-full w-full"
      aria-label={`Diagrama ER con ${tableCount} tablas y ${relCount} relaciones`}
    >
      <figcaption className="sr-only">
        Diagrama entidad-relación generado dinámicamente desde el catálogo de
        PostgreSQL. Contiene {tableCount} tablas y {relCount} relaciones de
        clave foránea.
      </figcaption>

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        colorMode="light"
        aria-label={`Lienzo del diagrama ER: ${tableCount} tablas, ${relCount} relaciones`}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeColor={() => "var(--color-primary)"}
          nodeStrokeWidth={2}
          pannable
          zoomable
        />
      </ReactFlow>
    </figure>
  );
}
