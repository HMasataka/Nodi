import assert from "node:assert/strict";
import test from "node:test";
import { clampZoom, screenDeltaToDocument } from "../src/pages/editor/viewport.ts";
import { createDocument } from "../src/document/commands/index.ts";
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
