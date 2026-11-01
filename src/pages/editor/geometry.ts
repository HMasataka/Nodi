import type { Document, DocumentNode, Geometry } from "@/document/types.ts";

export { absoluteGeometry } from "@/document/geometry.ts";

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

export function nodesInBounds(document: Document, bounds: Geometry): string[] {
  const ids: string[] = [];
  function visit(nodes: DocumentNode[], origin: Point) {
    for (const node of nodes) {
      const x = origin.x + node.x;
      const y = origin.y + node.y;
      if (x < bounds.x + bounds.width && x + node.width > bounds.x && y < bounds.y + bounds.height && y + node.height > bounds.y) ids.push(node.id);
      if (node.type === "frame") visit(node.children, { x, y });
    }
  }
  visit(document.children, { x: 0, y: 0 });
  return ids;
}

export function drawingGeometry(start: Point, end: Point, parentOrigin: Point = { x: 0, y: 0 }): Geometry {
  return {
    x: Math.min(start.x, end.x) - parentOrigin.x,
    y: Math.min(start.y, end.y) - parentOrigin.y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
