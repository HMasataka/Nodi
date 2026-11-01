import type { Document, DocumentNode, Geometry } from "@/document/types.ts";

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
  function visit(nodes: DocumentNode[], originX: number, originY: number) {
    for (const node of nodes) {
      const x = originX + node.x;
      const y = originY + node.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + node.width);
      maxY = Math.max(maxY, y + node.height);
      if (node.type === "frame") visit(node.children, x, y);
    }
  }
  visit(document.children, 0, 0);
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
