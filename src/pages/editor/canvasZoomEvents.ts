import { zoomFromWheel } from "@/pages/editor/viewport.ts";

interface WebKitGestureEvent extends Event { scale: number; clientX?: number; clientY?: number }

export function listenForCanvasZoom(
  viewport: HTMLElement,
  getZoom: () => number,
  zoomAt: (zoom: number, clientX: number, clientY: number) => void,
  panBy: (dx: number, dy: number) => void,
  isInteracting: () => boolean = () => false,
): () => void {
  let gestureStartZoom: number | null = null;

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    // gestureend が届かなくても、次のホイール入力を優先する。
    gestureStartZoom = null;
    if (isInteracting()) return;
    if (event.ctrlKey || event.metaKey) {
      zoomAt(zoomFromWheel(getZoom(), event.deltaY, event.deltaMode, viewport.clientHeight), event.clientX, event.clientY);
    } else {
      const dx = event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1);
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      if (Number.isFinite(dx) && Number.isFinite(dy)) panBy(event.shiftKey && dx === 0 ? dy : dx, event.shiftKey && dx === 0 ? 0 : dy);
    }
  }

  function onGestureStart(event: Event) {
    event.preventDefault();
    gestureStartZoom = isInteracting() ? null : getZoom();
  }

  function onGestureChange(event: Event) {
    event.preventDefault();
    const gesture = event as WebKitGestureEvent;
    if (isInteracting() || gestureStartZoom === null || !Number.isFinite(gesture.scale) || gesture.scale <= 0) return;
    const rect = viewport.getBoundingClientRect();
    const clientX = typeof gesture.clientX === "number" ? gesture.clientX : rect.left + viewport.clientWidth / 2;
    const clientY = typeof gesture.clientY === "number" ? gesture.clientY : rect.top + viewport.clientHeight / 2;
    zoomAt(gestureStartZoom * gesture.scale, clientX, clientY);
  }

  function onGestureEnd(event: Event) {
    if (gestureStartZoom === null) return;
    event.preventDefault();
    gestureStartZoom = null;
  }

  viewport.addEventListener("wheel", onWheel, { passive: false });
  // WebKit のトラックパッドピンチは wheel ではなく gesture イベントとして届く。
  viewport.addEventListener("gesturestart", onGestureStart, { passive: false });
  viewport.addEventListener("gesturechange", onGestureChange, { passive: false });
  window.addEventListener("gestureend", onGestureEnd, { capture: true, passive: false });

  return () => {
    viewport.removeEventListener("wheel", onWheel);
    viewport.removeEventListener("gesturestart", onGestureStart);
    viewport.removeEventListener("gesturechange", onGestureChange);
    window.removeEventListener("gestureend", onGestureEnd, true);
  };
}
