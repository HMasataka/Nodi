import type { PanState } from "@/pages/editor/types";

export interface ScrollPosition { scrollLeft: number; scrollTop: number }

const WHEEL_LINE_PIXELS = 16;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

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

export function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.25, value));
}

export function screenDeltaToDocument(delta: number, zoom: number): number {
  return delta / zoom;
}
