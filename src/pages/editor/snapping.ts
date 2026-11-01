import { absoluteGeometry, locateSelection } from "@/document/geometry.ts";
import type { Document, DocumentNode, Geometry } from "@/document/types.ts";

export interface SnapGuide { orientation: "vertical" | "horizontal"; position: number; from: number; to: number }

function candidates(document: Document, selectedIds: string[]): Geometry[] {
  const excluded = new Set(locateSelection(document, new Set(selectedIds)).map(({ node }) => node.id));
  const results: Geometry[] = [];
  function visit(nodes: DocumentNode[], originX: number, originY: number) {
    for (const node of nodes) {
      if (excluded.has(node.id)) continue;
      const x = originX + node.x;
      const y = originY + node.y;
      results.push({ x, y, width: node.width, height: node.height });
      if (node.type === "frame") visit(node.children, x, y);
    }
  }
  visit(document.children, 0, 0);
  return results;
}

function boundsOf(geometries: Geometry[]): Geometry {
  const x = Math.min(...geometries.map((item) => item.x));
  const y = Math.min(...geometries.map((item) => item.y));
  return { x, y, width: Math.max(...geometries.map((item) => item.x + item.width)) - x,
    height: Math.max(...geometries.map((item) => item.y + item.height)) - y };
}

function snapAxis(moving: Geometry, others: Geometry[], axis: "x" | "y", threshold: number, resize: boolean) {
  const start = moving[axis];
  const size = axis === "x" ? moving.width : moving.height;
  const cross = axis === "x" ? "y" : "x";
  const crossSize = axis === "x" ? "height" : "width";
  const anchors = resize ? [{ value: start + size, factor: 1 }, { value: start + size / 2, factor: 2 }]
    : [{ value: start, factor: 1 }, { value: start + size / 2, factor: 1 }, { value: start + size, factor: 1 }];
  let best: { adjustment: number; distance: number; guide: SnapGuide } | null = null;
  for (const other of others) {
    const otherSize = axis === "x" ? other.width : other.height;
    for (const target of [other[axis], other[axis] + otherSize / 2, other[axis] + otherSize]) {
      for (const anchor of anchors) {
        const distance = Math.abs(target - anchor.value);
        const adjustment = (target - anchor.value) * anchor.factor;
        if (distance > threshold || (resize && size + adjustment <= 0) || (best && distance >= best.distance)) continue;
        best = { adjustment, distance, guide: {
          orientation: axis === "x" ? "vertical" : "horizontal", position: target,
          from: Math.min(moving[cross], other[cross]),
          to: Math.max(moving[cross] + moving[crossSize], other[cross] + other[crossSize]),
        } };
      }
    }
  }
  return best;
}

export function snapMove(document: Document, ids: string[], dx: number, dy: number, zoom: number) {
  const located = locateSelection(document, new Set(ids));
  if (located.length === 0) return { dx, dy, guides: [] as SnapGuide[] };
  const original = boundsOf(located.map(({ absolute }) => absolute));
  const moving = { ...original, x: original.x + dx, y: original.y + dy };
  const others = candidates(document, ids);
  const horizontal = snapAxis(moving, others, "x", 8 / zoom, false);
  const vertical = snapAxis(moving, others, "y", 8 / zoom, false);
  return { dx: dx + (horizontal?.adjustment ?? 0), dy: dy + (vertical?.adjustment ?? 0),
    guides: [horizontal?.guide, vertical?.guide].filter((guide): guide is SnapGuide => !!guide) };
}

export function snapResize(document: Document, id: string, geometry: Geometry, zoom: number) {
  const current = absoluteGeometry(document, id);
  const located = locateSelection(document, new Set([id]))[0];
  if (!current || !located) return { geometry, guides: [] as SnapGuide[] };
  const moving = { ...geometry, x: current.x + geometry.x - located.node.x, y: current.y + geometry.y - located.node.y };
  const others = candidates(document, [id]);
  const horizontal = snapAxis(moving, others, "x", 8 / zoom, true);
  const vertical = snapAxis(moving, others, "y", 8 / zoom, true);
  return { geometry: { ...geometry, width: geometry.width + (horizontal?.adjustment ?? 0), height: geometry.height + (vertical?.adjustment ?? 0) },
    guides: [horizontal?.guide, vertical?.guide].filter((guide): guide is SnapGuide => !!guide) };
}
