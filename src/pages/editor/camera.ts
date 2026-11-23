import { absoluteGeometry } from "@/document/geometry.ts";
import { clampZoom } from "@/pages/editor/viewport.ts";
import type { Document, Geometry } from "@/document/types.ts";

// スクロール位置は仮想的な画面px。DOMのscrollLeft/Topには代入しない。
export interface CanvasCamera { zoom: number; scrollLeft: number; scrollTop: number }
export const INITIAL_CAMERA: CanvasCamera = { zoom: 1, scrollLeft: -64, scrollTop: -64 };

export function cameraWorldPoint(camera: CanvasCamera, point: { x: number; y: number }) {
  return { x: (point.x + camera.scrollLeft) / camera.zoom, y: (point.y + camera.scrollTop) / camera.zoom };
}

export function initialCamera(document: Document, size: { width: number; height: number }): CanvasCamera {
  const first = document.children.find((node) => node.type === "frame") ?? document.children[0];
  const bounds = first ? absoluteGeometry(document, first.id) : null;
  return bounds ? focusCamera(bounds, size, 1) : { ...INITIAL_CAMERA };
}

export function zoomCamera(camera: CanvasCamera, requestedZoom: number, point: { x: number; y: number }): CanvasCamera {
  const zoom = clampZoom(requestedZoom);
  const ratio = zoom / camera.zoom;
  return { zoom, scrollLeft: (camera.scrollLeft + point.x) * ratio - point.x,
    scrollTop: (camera.scrollTop + point.y) * ratio - point.y };
}

export function focusCamera(bounds: Geometry, size: { width: number; height: number }, currentZoom: number): CanvasCamera {
  const zoom = Math.min(currentZoom, Math.max(1, size.width - 64) / bounds.width, Math.max(1, size.height - 64) / bounds.height);
  return { zoom, scrollLeft: (bounds.x + bounds.width / 2) * zoom - size.width / 2,
    scrollTop: (bounds.y + bounds.height / 2) * zoom - size.height / 2 };
}

export function cameraScreenGeometry(bounds: Geometry, camera: CanvasCamera): Geometry {
  return { x: bounds.x * camera.zoom - camera.scrollLeft, y: bounds.y * camera.zoom - camera.scrollTop,
    width: bounds.width * camera.zoom, height: bounds.height * camera.zoom };
}

const FIT_MARGIN = 64;

// 最上位の要素をすべて囲む外接枠。要素がないときは null。
export function documentBounds(document: Document): Geometry | null {
  const boxes = document.children.map((node) => absoluteGeometry(document, node.id)).filter((box): box is Geometry => !!box);
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// 外接枠が余白付きで画面に収まる倍率で、枠の中心を画面の中心に置く。
export function fitCamera(bounds: Geometry, size: { width: number; height: number }): CanvasCamera {
  const zoom = clampZoom(Math.min(Math.max(1, size.width - FIT_MARGIN) / Math.max(1, bounds.width), Math.max(1, size.height - FIT_MARGIN) / Math.max(1, bounds.height)));
  return { zoom, scrollLeft: (bounds.x + bounds.width / 2) * zoom - size.width / 2,
    scrollTop: (bounds.y + bounds.height / 2) * zoom - size.height / 2 };
}
