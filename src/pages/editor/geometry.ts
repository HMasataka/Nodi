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

// つまみの位置。1 は右端・下端、0 は左端・上端。
export type ResizeCorner = { x: 0 | 1; y: 0 | 1 };
export const RESIZE_CORNERS: readonly ResizeCorner[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];

// つまみと反対の角を動かさずに大きさを変える。回転していても、反対の角の画面上の位置を保つ。
export function geometryWithAnchor(node: RotatedGeometry, width: number, height: number, corner: ResizeCorner): Geometry {
  const anchorBefore = { x: (corner.x ? 0 : node.width) - node.width / 2, y: (corner.y ? 0 : node.height) - node.height / 2 };
  const anchorAfter = { x: (corner.x ? 0 : width) - width / 2, y: (corner.y ? 0 : height) - height / 2 };
  const before = rotatePoint(anchorBefore, node.rotation);
  const after = rotatePoint(anchorAfter, node.rotation);
  const center = { x: node.x + node.width / 2 + before.x - after.x, y: node.y + node.height / 2 + before.y - after.y };
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

export function resizeFromWorldDelta(node: RotatedGeometry, parent: Transform, delta: Point, corner: ResizeCorner = { x: 1, y: 1 }): Geometry {
  const orientation = composeTransform(parent, nodeTransform(node));
  const local = transformVector(invertTransform(orientation), delta);
  const width = Math.max(1, node.width + (corner.x ? local.x : -local.x));
  const height = Math.max(1, node.height + (corner.y ? local.y : -local.y));
  return geometryWithAnchor(node, width, height, corner);
}
