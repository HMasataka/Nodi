import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Canvas } from "../src/pages/editor/components/organisms/Canvas/Canvas.tsx";
import { selectionBounds } from "../src/pages/editor/camera.ts";
import { sizeLabel } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { document, rectangle } from "./support/factories.ts";
import { geometryWithAnchor, type ResizeCorner, resizeFromWorldDelta } from "../src/pages/editor/geometry.ts";
import { IDENTITY_TRANSFORM, rotatePoint } from "../src/document/transform.ts";

const box = { x: 100, y: 100, width: 80, height: 40, rotation: 0 };

test("つまみと反対の角を動かさずに大きさを変える", () => {
  assert.deepEqual(resizeFromWorldDelta(box, IDENTITY_TRANSFORM, { x: 10, y: 5 }, { x: 1, y: 1 }), { x: 100, y: 100, width: 90, height: 45 });
  assert.deepEqual(resizeFromWorldDelta(box, IDENTITY_TRANSFORM, { x: 10, y: 5 }, { x: 0, y: 0 }), { x: 110, y: 105, width: 70, height: 35 });
  assert.deepEqual(resizeFromWorldDelta(box, IDENTITY_TRANSFORM, { x: -10, y: 5 }, { x: 0, y: 1 }), { x: 90, y: 100, width: 90, height: 45 });
  assert.deepEqual(resizeFromWorldDelta(box, IDENTITY_TRANSFORM, { x: 10, y: -5 }, { x: 1, y: 0 }), { x: 100, y: 95, width: 90, height: 45 });
  assert.deepEqual(resizeFromWorldDelta(box, IDENTITY_TRANSFORM, { x: 200, y: 0 }, { x: 0, y: 1 }).width, 1);
});

test("回転していても、反対の角の画面上の位置を保つ", () => {
  const rotated = { ...box, rotation: 30 };
  const corner = (geometry: typeof box, local: { x: number; y: number }) => {
    const offset = rotatePoint({ x: local.x - geometry.width / 2, y: local.y - geometry.height / 2 }, geometry.rotation);
    return { x: geometry.x + geometry.width / 2 + offset.x, y: geometry.y + geometry.height / 2 + offset.y };
  };
  const cases: [ResizeCorner, (geometry: typeof box) => { x: number; y: number }][] = [
    [{ x: 0, y: 0 }, (geometry) => ({ x: geometry.width, y: geometry.height })],
    [{ x: 1, y: 0 }, (geometry) => ({ x: 0, y: geometry.height })],
    [{ x: 0, y: 1 }, (geometry) => ({ x: geometry.width, y: 0 })],
    [{ x: 1, y: 1 }, () => ({ x: 0, y: 0 })],
  ];
  for (const [handle, anchor] of cases) {
    const next = { ...geometryWithAnchor(rotated, 120, 60, handle), rotation: 30 };
    const before = corner(rotated, anchor(rotated));
    const after = corner(next, anchor(next));
    assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9, JSON.stringify(handle));
  }
});

test("寸法の札は整数の幅 × 高さで出す", () => {
  assert.equal(sizeLabel(300, 308), "300 × 308");
  assert.equal(sizeLabel(99.6, 40.2), "100 × 40");
});

test("1つだけ選ぶと四隅のつまみと寸法を出し、複数を選ぶとまとめた範囲に枠・つまみ・寸法を出す", () => {
  const noop = () => {};
  const props = { zoom: 2, drawTool: "select" as const, drawing: null, onNodePointerDown: noop, onResizePointerDown: noop, onNodePointerMove: noop,
    onNodePointerUp: noop, onImageError: noop, onPanPointerDown: noop, onPanPointerMove: noop, onPanPointerUp: noop, onWorldPointerDown: noop,
    onWorldDoubleClick: noop, onWorldPointerMove: noop, onWorldPointerUp: noop, onWorldPointerCancel: noop };
  const design = document(rectangle({ id: "a", x: 0, y: 0, width: 40, height: 20 }), rectangle({ id: "b", x: 100, y: 60, width: 20, height: 20 }));
  const single = renderToStaticMarkup(createElement(Canvas, { ...props, design, selectedId: "a", selectedIds: ["a"] }));
  assert.deepEqual([...single.matchAll(/class="resize-handle (is-[a-z-]+)"/g)].map(([, corner]) => corner), ["is-top-left", "is-top-right", "is-bottom-left", "is-bottom-right"]);
  assert.match(single, /<span class="canvas-size-label" aria-hidden="true">40 × 20<\/span>/);
  assert.match(single, /--canvas-zoom:2/);
  assert.doesNotMatch(single, /selection-bounds/);
  const multiple = renderToStaticMarkup(createElement(Canvas, { ...props, design, selectedId: "b", selectedIds: ["a", "b"] }));
  assert.match(multiple, /<div class="selection-bounds" style="left:0;top:0;width:120px;height:80px">(<span class="resize-handle [^"]+"[^>]*><\/span>){4}<span class="canvas-size-label" aria-hidden="true">120 × 80<\/span><\/div>/);
  assert.equal(multiple.match(/class="canvas-node is-selected"/g)?.length, 2);
  assert.deepEqual(selectionBounds(design, ["missing"]), null);
});

test("選択枠は 1px、つまみは 8px 角を、倍率に依らず画面上の大きさで描く", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.canvas-image\.is-selected \{\n {2}outline: calc\(1px \/ var\(--canvas-zoom\)\) solid var\(--accent\);/);
  assert.match(css, /\.resize-handle \{[^}]*width: calc\(8px \/ var\(--canvas-zoom\)\);[^}]*border: calc\(1px \/ var\(--canvas-zoom\)\) solid var\(--accent\);[^}]*background: var\(--surface\);/);
  assert.match(css, /\.canvas-size-label \{[^}]*color: var\(--on-accent\);[^}]*background: var\(--accent-fill\);/);
});
