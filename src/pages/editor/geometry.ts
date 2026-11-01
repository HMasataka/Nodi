import { listLocatedNodes } from "@/document/geometry.ts";
import type { Document, Geometry } from "@/document/types.ts";

export { absoluteGeometry } from "@/document/geometry.ts";

export interface Point { x: number; y: number }

export function pointOnCanvas(clientX: number, clientY: number, bounds: { left: number; top: number }, zoom: number): Point {
  return { x: (clientX - bounds.left) / zoom, y: (clientY - bounds.top) / zoom };
}

export function frameOrigin(document: Document, id: string): Point | null {
  const frame = listLocatedNodes(document).find(({ node }) => node.id === id && node.type === "frame");
  return frame ? { x: frame.absolute.x, y: frame.absolute.y } : null;
}

function overlaps(first: Geometry, second: Geometry): boolean {
  const horizontal = first.x < second.x + second.width && second.x < first.x + first.width;
  const vertical = first.y < second.y + second.height && second.y < first.y + first.height;
  return horizontal && vertical;
}

export function nodesInBounds(document: Document, bounds: Geometry): string[] {
  return listLocatedNodes(document)
    .filter(({ absolute }) => overlaps(absolute, bounds))
    .map(({ node }) => node.id);
}

export function drawingGeometry(start: Point, end: Point, parentOrigin: Point = { x: 0, y: 0 }): Geometry {
  return {
    x: Math.min(start.x, end.x) - parentOrigin.x,
    y: Math.min(start.y, end.y) - parentOrigin.y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
