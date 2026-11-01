import type { Document, Geometry } from "@/document/types.ts";
import { locateSelection, walkLocatedNodes } from "@/document/geometry.ts";

export interface SnapGuide { orientation: "vertical" | "horizontal"; position: number; from: number; to: number }

type Axis = "x" | "y";
type SnapMode = "move" | "resize";

interface AxisEdges { start: number; center: number; end: number; size: number }
interface SnapMatch { adjustment: number; distance: number; guide: SnapGuide }

// 判定は画面上で 8px 以内。ズームに応じてドキュメント座標へ換算する。
const SNAP_DISTANCE_ON_SCREEN = 8;

function otherElementBounds(document: Document, selectedIds: string[]): Geometry[] {
  const selectedRoots = new Set(locateSelection(document, new Set(selectedIds)).map(({ node }) => node.id));
  const bounds: Geometry[] = [];
  walkLocatedNodes(document, ({ node, absolute }) => {
    // 選択フレームの子にも自分自身をスナップさせない。
    if (selectedRoots.has(node.id)) return "skipChildren";
    bounds.push(absolute);
  });
  return bounds;
}

function enclosingBounds(geometries: Geometry[]): Geometry {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const geometry of geometries) {
    left = Math.min(left, geometry.x);
    top = Math.min(top, geometry.y);
    right = Math.max(right, geometry.x + geometry.width);
    bottom = Math.max(bottom, geometry.y + geometry.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function edgesAlong(geometry: Geometry, axis: Axis): AxisEdges {
  const start = axis === "x" ? geometry.x : geometry.y;
  const size = axis === "x" ? geometry.width : geometry.height;
  return { start, center: start + size / 2, end: start + size, size };
}

function movingAnchors(edges: AxisEdges, mode: SnapMode) {
  if (mode === "move") return [
    { position: edges.start, adjustmentFactor: 1 },
    { position: edges.center, adjustmentFactor: 1 },
    { position: edges.end, adjustmentFactor: 1 },
  ];
  return [
    { position: edges.end, adjustmentFactor: 1 },
    // 左上は固定。幅・高さを変えると中心はその半分だけ動く。
    { position: edges.center, adjustmentFactor: 2 },
  ];
}

function guideAcross(moving: Geometry, other: Geometry, axis: Axis, position: number): SnapGuide {
  if (axis === "x") return {
    orientation: "vertical", position,
    from: Math.min(moving.y, other.y), to: Math.max(moving.y + moving.height, other.y + other.height),
  };
  return {
    orientation: "horizontal", position,
    from: Math.min(moving.x, other.x), to: Math.max(moving.x + moving.width, other.x + other.width),
  };
}

function closestSnap(moving: Geometry, others: Geometry[], axis: Axis, mode: SnapMode, zoom: number): SnapMatch | null {
  const movingEdges = edgesAlong(moving, axis);
  const anchors = movingAnchors(movingEdges, mode);
  const threshold = SNAP_DISTANCE_ON_SCREEN / zoom;
  let closest: SnapMatch | null = null;

  for (const other of others) {
    const targetEdges = edgesAlong(other, axis);
    for (const target of [targetEdges.start, targetEdges.center, targetEdges.end]) {
      for (const anchor of anchors) {
        const difference = target - anchor.position;
        const distance = Math.abs(difference);
        const adjustment = difference * anchor.adjustmentFactor;
        if (distance > threshold || (mode === "resize" && movingEdges.size + adjustment <= 0)) continue;
        if (closest && distance >= closest.distance) continue;
        closest = { adjustment, distance, guide: guideAcross(moving, other, axis, target) };
      }
    }
  }
  return closest;
}

function guidesFor(xSnap: SnapMatch | null, ySnap: SnapMatch | null): SnapGuide[] {
  return [xSnap?.guide, ySnap?.guide].filter((guide): guide is SnapGuide => guide !== undefined);
}

export function snapMove(document: Document, ids: string[], dx: number, dy: number, zoom: number) {
  const selected = locateSelection(document, new Set(ids));
  if (selected.length === 0) return { dx, dy, guides: [] as SnapGuide[] };

  const original = enclosingBounds(selected.map(({ absolute }) => absolute));
  const moving = { ...original, x: original.x + dx, y: original.y + dy };
  const others = otherElementBounds(document, ids);
  const xSnap = closestSnap(moving, others, "x", "move", zoom);
  const ySnap = closestSnap(moving, others, "y", "move", zoom);
  return {
    dx: dx + (xSnap?.adjustment ?? 0), dy: dy + (ySnap?.adjustment ?? 0),
    guides: guidesFor(xSnap, ySnap),
  };
}

export function snapResize(document: Document, id: string, geometry: Geometry, zoom: number) {
  const selected = locateSelection(document, new Set([id]))[0];
  if (!selected) return { geometry, guides: [] as SnapGuide[] };

  // 提案された x/y は親基準なので、元の絶対位置との差分を足して比較する。
  const moving = {
    ...geometry,
    x: selected.absolute.x + geometry.x - selected.node.x,
    y: selected.absolute.y + geometry.y - selected.node.y,
  };
  const others = otherElementBounds(document, [id]);
  const xSnap = closestSnap(moving, others, "x", "resize", zoom);
  const ySnap = closestSnap(moving, others, "y", "resize", zoom);
  return {
    geometry: { ...geometry, width: geometry.width + (xSnap?.adjustment ?? 0), height: geometry.height + (ySnap?.adjustment ?? 0) },
    guides: guidesFor(xSnap, ySnap),
  };
}
