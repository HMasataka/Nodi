import assert from "node:assert/strict";
import test from "node:test";

import { absoluteGeometry } from "../src/pages/editor/geometry.ts";
import { addNode, createDocument } from "../src/document/commands/index.ts";
import { canvasExtent, clampZoom, focusViewport, screenDeltaToDocument } from "../src/pages/editor/viewport.ts";
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

test("入れ子や負の座標でも対象の境界が表示領域に入るパン・ズームを求める", () => {
  const outer = addNode(createDocument(), { type: "frame", x: -80, y: 120, width: 600, height: 400 });
  assert.equal(outer.type, "Success");
  const inner = addNode(outer.value.document, { type: "rectangle", parentId: outer.value.node.id, x: 20, y: 30, width: 300, height: 100 });
  assert.equal(inner.type, "Success");
  const bounds = absoluteGeometry(inner.value.document, inner.value.node.id);
  assert.deepEqual(bounds, { x: -60, y: 150, width: 300, height: 100 });
  const extent = canvasExtent(inner.value.document);
  assert.equal(extent.originX, 112);
  const view = focusViewport(bounds, extent, { width: 240, height: 160 }, 2);
  assert.equal(view.zoom, 176 / 300);
  const left = (extent.originX + bounds.x) * view.zoom - view.scrollLeft;
  const top = (extent.originY + bounds.y) * view.zoom - view.scrollTop;
  assert.ok(left >= 0 && top >= 0);
  assert.ok(left + bounds.width * view.zoom <= 240);
  assert.ok(top + bounds.height * view.zoom <= 160);
});
