import { zoomFromWheel } from "@/pages/editor/viewport.ts";

interface WebKitGestureEvent extends Event { scale: number; clientX?: number; clientY?: number }

export function listenForCanvasZoom(
  viewport: HTMLElement,
  getZoom: () => number,
  zoomAt: (zoom: number, clientX: number, clientY: number) => void,
): () => void {
  let gestureStartZoom: number | null = null;

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    // gestureend が届かなくても、次のホイール入力を優先する。
    gestureStartZoom = null;
    zoomAt(zoomFromWheel(getZoom(), event.deltaY, event.deltaMode, viewport.clientHeight), event.clientX, event.clientY);
  }

  function onGestureStart(event: Event) {
    event.preventDefault();
    gestureStartZoom = getZoom();
  }

  function onGestureChange(event: Event) {
    event.preventDefault();
    const gesture = event as WebKitGestureEvent;
    if (gestureStartZoom === null || !Number.isFinite(gesture.scale) || gesture.scale <= 0) return;
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
