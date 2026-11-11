import assert from "node:assert/strict";
import { test } from "vitest";

import { listenForCanvasZoom } from "../src/pages/editor/canvasZoomEvents.ts";

test("ピンチ終了を取り逃してもホイールがズームし、遅れたジェスチャーで戻らない", () => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  try {
    const viewport = new EventTarget();
    viewport.clientWidth = 800;
    viewport.clientHeight = 600;
    viewport.getBoundingClientRect = () => ({ left: 100, top: 50 });
    let zoom = 1;
    const stop = listenForCanvasZoom(viewport, () => zoom, (next) => { zoom = next; });

    viewport.dispatchEvent(new Event("gesturestart", { cancelable: true }));
    viewport.dispatchEvent(Object.assign(new Event("gesturechange", { cancelable: true }), { scale: 1.2, clientX: 300, clientY: 200 }));
    assert.equal(zoom, 1.2);

    const wheel = Object.assign(new Event("wheel", { cancelable: true }), { deltaY: -40, deltaMode: 0, clientX: 300, clientY: 200 });
    viewport.dispatchEvent(wheel);
    assert.equal(wheel.defaultPrevented, true);
    assert.ok(zoom > 1.2);
    const afterWheel = zoom;
    viewport.dispatchEvent(Object.assign(new Event("gesturechange", { cancelable: true }), { scale: 1.21 }));
    assert.equal(zoom, afterWheel);

    viewport.dispatchEvent(new Event("gesturestart", { cancelable: true }));
    globalThis.window.dispatchEvent(new Event("gestureend", { cancelable: true }));
    viewport.dispatchEvent(Object.assign(new Event("gesturechange", { cancelable: true }), { scale: 1.3 }));
    assert.equal(zoom, afterWheel);

    stop();
    viewport.dispatchEvent(wheel);
    assert.equal(zoom, afterWheel);
  } finally {
    globalThis.window = previousWindow;
  }
});
