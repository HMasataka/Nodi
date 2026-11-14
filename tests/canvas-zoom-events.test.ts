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
    const stop = listenForCanvasZoom(viewport, () => zoom, (next) => { zoom = next; }, () => {});

    viewport.dispatchEvent(new Event("gesturestart", { cancelable: true }));
    viewport.dispatchEvent(Object.assign(new Event("gesturechange", { cancelable: true }), { scale: 1.2, clientX: 300, clientY: 200 }));
    assert.equal(zoom, 1.2);

    const wheel = Object.assign(new Event("wheel", { cancelable: true }), { deltaY: -40, deltaMode: 0, clientX: 300, clientY: 200, ctrlKey: true });
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

test("通常ホイールは双方向へパンし、修飾キーだけズームする", () => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  try {
    const viewport = new EventTarget();
    Object.assign(viewport, { clientWidth: 800, clientHeight: 600 });
    let zoom = 1;
    let x = 0;
    let y = 0;
    let interacting = false;
    const stop = listenForCanvasZoom(viewport, () => zoom, (next) => { zoom = next; },
      (dx, dy) => { x += dx; y += dy; }, () => interacting);
    function wheel(values) {
      const event = Object.assign(new Event("wheel", { cancelable: true }), { deltaX: 0, deltaY: 0, deltaMode: 0, clientX: 100, clientY: 100, ...values });
      viewport.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
    }
    wheel({ deltaX: -5000, deltaY: -8000 });
    assert.deepEqual([x, y, zoom], [-5000, -8000, 1]);
    wheel({ deltaX: 5000, deltaY: 8000 });
    assert.deepEqual([x, y], [0, 0]);
    wheel({ deltaY: -2, deltaMode: 1, shiftKey: true });
    assert.deepEqual([x, y], [-32, 0]);
    wheel({ deltaX: 1, deltaY: -1, deltaMode: 2 });
    assert.deepEqual([x, y], [768, -600]);
    wheel({ deltaY: -100, metaKey: true });
    assert.ok(zoom > 1);
    const before = zoom;
    interacting = true;
    wheel({ deltaY: -100, ctrlKey: true });
    wheel({ deltaX: 100 });
    assert.deepEqual([x, y, zoom], [768, -600, before]);
    stop();
    viewport.dispatchEvent(Object.assign(new Event("wheel"), { deltaX: 100, deltaY: 100, deltaMode: 0 }));
    assert.deepEqual([x, y, zoom], [768, -600, before]);
  } finally { globalThis.window = previousWindow; }
});
