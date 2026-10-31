import type { Document, DocumentNode, Geometry } from "./types.ts";

export interface Point { x: number; y: number }

export function pointOnCanvas(clientX: number, clientY: number, bounds: { left: number; top: number }, zoom: number): Point {
  return { x: (clientX - bounds.left) / zoom, y: (clientY - bounds.top) / zoom };
}

export function frameOrigin(document: Document, id: string): Point | null {
  function visit(nodes: DocumentNode[], offset: Point): Point | null {
    for (const node of nodes) {
      if (node.type !== "frame") continue;
      const origin = { x: offset.x + node.x, y: offset.y + node.y };
      if (node.id === id) return origin;
      const found = visit(node.children, origin);
      if (found) return found;
    }
    return null;
  }
  return visit(document.children, { x: 0, y: 0 });
}

export function drawingGeometry(start: Point, end: Point, parentOrigin: Point = { x: 0, y: 0 }): Geometry {
  return {
    x: Math.min(start.x, end.x) - parentOrigin.x,
    y: Math.min(start.y, end.y) - parentOrigin.y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
