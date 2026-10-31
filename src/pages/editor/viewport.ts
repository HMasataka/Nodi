export function clampZoom(value: number): number {
  return Math.min(4, Math.max(0.25, value));
}

export function screenDeltaToDocument(delta: number, zoom: number): number {
  return delta / zoom;
}
