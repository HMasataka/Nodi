import { walkLocatedNodes } from "@/document/geometry.ts";
import type { Document, Geometry } from "@/document/types.ts";

export interface CanvasExtent {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export function canvasExtent(document: Document): CanvasExtent {
  let minX = 0;
  let minY = 0;
  let maxX = 1200;
  let maxY = 900;
  walkLocatedNodes(document, ({ absolute }) => {
    minX = Math.min(minX, absolute.x);
    minY = Math.min(minY, absolute.y);
    maxX = Math.max(maxX, absolute.x + absolute.width);
    maxY = Math.max(maxY, absolute.y + absolute.height);
  });
  const originX = minX < 0 ? -minX + 32 : 0;
  const originY = minY < 0 ? -minY + 32 : 0;
  return { originX, originY, width: originX + maxX + 32, height: originY + maxY + 32 };
}

export function focusViewport(bounds: Geometry, extent: CanvasExtent, viewport: { width: number; height: number }, currentZoom: number) {
  const width = Math.max(1, viewport.width - 64);
  const height = Math.max(1, viewport.height - 64);
  const zoom = Math.min(currentZoom, width / bounds.width, height / bounds.height);
  const scrollLeft = Math.max(0, (extent.originX + bounds.x + bounds.width / 2) * zoom - viewport.width / 2);
  const scrollTop = Math.max(0, (extent.originY + bounds.y + bounds.height / 2) * zoom - viewport.height / 2);
  return { zoom, scrollLeft, scrollTop };
}

export function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.25, value));
}

export function screenDeltaToDocument(delta: number, zoom: number): number {
  return delta / zoom;
}
