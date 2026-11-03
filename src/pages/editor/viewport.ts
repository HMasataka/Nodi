import type { PanState } from "@/pages/editor/types";
import { walkLocatedNodes } from "@/document/geometry.ts";
import type { Document, Geometry } from "@/document/types.ts";

export interface CanvasExtent {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface ScrollPosition { scrollLeft: number; scrollTop: number }

const WHEEL_LINE_PIXELS = 16;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

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

export function screenGeometry(bounds: Geometry, extent: CanvasExtent, zoom: number, scroll: ScrollPosition): Geometry {
  return {
    x: (extent.originX + bounds.x) * zoom - scroll.scrollLeft,
    y: (extent.originY + bounds.y) * zoom - scroll.scrollTop,
    width: bounds.width * zoom,
    height: bounds.height * zoom,
  };
}

export function panScroll(start: PanState, pointer: { clientX: number; clientY: number }): ScrollPosition {
  return {
    scrollLeft: start.scrollLeft - (pointer.clientX - start.clientX),
    scrollTop: start.scrollTop - (pointer.clientY - start.clientY),
  };
}

export function zoomFromWheel(currentZoom: number, deltaY: number, deltaMode: number, viewportHeight: number): number {
  const pixelsPerUnit = deltaMode === 1 ? WHEEL_LINE_PIXELS : deltaMode === 2 ? viewportHeight : 1;
  return clampZoom(currentZoom * Math.exp(-deltaY * pixelsPerUnit * WHEEL_ZOOM_SENSITIVITY));
}

export function zoomAroundPoint(currentZoom: number, requestedZoom: number, scroll: ScrollPosition, point: { x: number; y: number }) {
  const zoom = clampZoom(requestedZoom);
  const ratio = zoom / currentZoom;
  return {
    zoom,
    scrollLeft: Math.max(0, (scroll.scrollLeft + point.x) * ratio - point.x),
    scrollTop: Math.max(0, (scroll.scrollTop + point.y) * ratio - point.y),
  };
}

export function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.25, value));
}

export function screenDeltaToDocument(delta: number, zoom: number): number {
  return delta / zoom;
}
