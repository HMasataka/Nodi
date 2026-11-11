import { composeTransform, IDENTITY_TRANSFORM, invertTransform, nodeTransform, rotatePoint, type Transform, transformPoint, transformVector } from "@/document/transform.ts";
import type { Document, Geometry, RotatedGeometry } from "@/document/types.ts";
import { listLocatedNodes, walkVisibleNodes } from "@/document/geometry.ts";

export { absoluteGeometry } from "@/document/geometry.ts";

export interface Point { x: number; y: number }

export function pointOnCanvas(clientX: number, clientY: number, bounds: { left: number; top: number }, zoom: number): Point {
  return { x: (clientX - bounds.left) / zoom, y: (clientY - bounds.top) / zoom };
}

export function frameOrigin(document: Document, id: string): Point | null {
  const transform = frameTransform(document, id);
  return transform ? transformPoint(transform, { x: 0, y: 0 }) : null;
}

export function frameTransform(document: Document, id: string): Transform | null {
  return listLocatedNodes(document).find(({ node }) => node.id === id && node.type === "frame")?.world ?? null;
}

function overlaps(first: Geometry, second: Geometry): boolean {
  const horizontal = first.x < second.x + second.width && second.x < first.x + first.width;
  const vertical = first.y < second.y + second.height && second.y < first.y + first.height;
  return horizontal && vertical;
}

export function nodesInBounds(document: Document, bounds: Geometry): string[] {
  const ids: string[] = [];
  walkVisibleNodes(document, ({ node, visible }) => { if (overlaps(visible, bounds)) ids.push(node.id); });
  return ids;
}

export function drawingGeometry(start: Point, end: Point, parent: Point | Transform = IDENTITY_TRANSFORM): Geometry {
  const localStart = "a" in parent ? transformPoint(invertTransform(parent), start) : { x: start.x - parent.x, y: start.y - parent.y };
  const localEnd = "a" in parent ? transformPoint(invertTransform(parent), end) : { x: end.x - parent.x, y: end.y - parent.y };
  return {
    x: Math.min(localStart.x, localEnd.x),
    y: Math.min(localStart.y, localEnd.y),
    width: Math.abs(localEnd.x - localStart.x),
    height: Math.abs(localEnd.y - localStart.y),
  };
}

export function geometryWithFixedCorner(node: RotatedGeometry, width: number, height: number): Geometry {
  const centerChange = { x: (width - node.width) / 2, y: (height - node.height) / 2 };
  const rotated = rotatePoint(centerChange, node.rotation);
  return { x: node.x + rotated.x - centerChange.x, y: node.y + rotated.y - centerChange.y, width, height };
}

export function resizeFromWorldDelta(node: RotatedGeometry, parent: Transform, delta: Point): Geometry {
  const orientation = composeTransform(parent, nodeTransform(node));
  const local = transformVector(invertTransform(orientation), delta);
  return geometryWithFixedCorner(node, Math.max(1, node.width + local.x), Math.max(1, node.height + local.y));
}
