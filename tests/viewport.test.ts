import assert from "node:assert/strict";
import { test } from "vitest";

import { absoluteGeometry } from "../src/pages/editor/geometry.ts";
import { addNode, createDocument } from "../src/document/commands/index.ts";
import { cameraScreenGeometry, focusCamera, zoomCamera } from "../src/pages/editor/camera.ts";
import { clampZoom, panScroll, screenDeltaToDocument, zoomFromWheel } from "../src/pages/editor/viewport.ts";
import { createHistory, isDirty } from "../src/document/history.ts";

test("ズーム中のドラッグとリサイズはドキュメント座標に変換する", () => {
  assert.equal(screenDeltaToDocument(40, 2), 20);
  assert.equal(screenDeltaToDocument(-20, 0.5), -40);
  assert.equal(clampZoom(0.1), 0.25);
  assert.equal(clampZoom(8), 4);
});

test("表示倍率とパンは保存対象のドキュメントを変更しない", () => {
  const document = createDocument();
  const history = createHistory(document, true);
  const zoom = clampZoom(2);
  const scroll = { x: 120, y: 80 };
  assert.deepEqual({ zoom, scroll }, { zoom: 2, scroll: { x: 120, y: 80 } });
  assert.equal(history.present, document);
  assert.equal(isDirty(history), false);
});

test("ホイールの移動量に応じて連続的に拡大・縮小し、倍率の上下限を守る", () => {
  const zoomed = zoomFromWheel(1, -37, 0, 600);
  assert.ok(zoomed > 1 && zoomed < 1.25);
  assert.ok(Math.abs(zoomFromWheel(zoomed, 37, 0, 600) - 1) < 1e-12);
  assert.equal(zoomFromWheel(1, -2, 1, 600), zoomFromWheel(1, -32, 0, 600));
  assert.equal(zoomFromWheel(1, 1, 2, 600), zoomFromWheel(1, 600, 0, 600));
  assert.equal(zoomFromWheel(4, -100, 0, 600), 4);
  assert.equal(zoomFromWheel(0.25, 100, 0, 600), 0.25);
});

test("ズーム時はポインターの下にあるキャンバス座標を維持する", () => {
  const point = { x: 120, y: 70 };
  const scroll = { scrollLeft: 160, scrollTop: 80 };
  const zoomed = zoomCamera({ zoom: 1, ...scroll }, 1.73, point);
  assert.equal(zoomed.zoom, 1.73);
  assert.ok(Math.abs((zoomed.scrollLeft + point.x) / zoomed.zoom - (scroll.scrollLeft + point.x)) < 1e-12);
  assert.ok(Math.abs((zoomed.scrollTop + point.y) / zoomed.zoom - (scroll.scrollTop + point.y)) < 1e-12);
  const pinch = zoomCamera(zoomed, 0.82, point);
  assert.ok(Math.abs((pinch.scrollLeft + point.x) / pinch.zoom - (scroll.scrollLeft + point.x)) < 1e-12);
  assert.equal(zoomCamera({ zoom: 1, ...scroll }, 10, point).zoom, 4);
});

test("パンの移動量とスクロール後の要素座標を画面ピクセルで計算する", () => {
  const start = { pointerId: 1, clientX: 100, clientY: 200, scrollLeft: 120, scrollTop: 80 };
  assert.deepEqual(panScroll(start, { clientX: 130, clientY: 170 }), { scrollLeft: 90, scrollTop: 110 });
  assert.deepEqual(cameraScreenGeometry(
    { x: -60, y: 150, width: 300, height: 100 },
    { zoom: 0.5, scrollLeft: -56, scrollTop: 25 },
  ), { x: 26, y: 50, width: 150, height: 50 });
});

test("入れ子や負の座標でも対象の境界が表示領域に入るパン・ズームを求める", () => {
  const outer = addNode(createDocument(), { type: "frame", x: -80, y: 120, width: 600, height: 400 });
  assert.equal(outer.type, "Success");
  const inner = addNode(outer.value.document, { type: "rectangle", parentId: outer.value.node.id, x: 20, y: 30, width: 300, height: 100 });
  assert.equal(inner.type, "Success");
  const bounds = absoluteGeometry(inner.value.document, inner.value.node.id);
  assert.deepEqual(bounds, { x: -60, y: 150, width: 300, height: 100 });
  const view = focusCamera(bounds, { width: 240, height: 160 }, 2);
  assert.equal(view.zoom, 176 / 300);
  const { x: left, y: top } = cameraScreenGeometry(bounds, view);
  assert.ok(left >= 0 && top >= 0);
  assert.ok(left + bounds.width * view.zoom <= 240);
  assert.ok(top + bounds.height * view.zoom <= 160);
});
