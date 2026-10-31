import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument } from "../src/document/commands.ts";
import { drawingGeometry, frameOrigin, pointOnCanvas } from "../src/document/drawing.ts";
import { commit, createHistory, undo } from "../src/document/history.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("ズーム・スクロールされた画面座標からドラッグの位置と寸法を得る", () => {
  const bounds = { left: -100, top: 20 };
  const start = pointOnCanvas(300, 220, bounds, 2);
  const end = pointOnCanvas(180, 120, bounds, 2);
  assert.deepEqual(drawingGeometry(start, end), { x: 140, y: 50, width: 60, height: 50 });
});

test("入れ子フレーム内の作成は親基準の座標になり、確定まで履歴に入らない", () => {
  const outer = success(addNode(createDocument(), { type: "frame", x: 100, y: 80, width: 400, height: 300 }));
  const inner = success(addNode(outer.document, { type: "frame", parentId: outer.node.id, x: 20, y: 30, width: 200, height: 150 }));
  const origin = frameOrigin(inner.document, inner.node.id);
  assert.deepEqual(origin, { x: 120, y: 110 });
  const geometry = drawingGeometry({ x: 140, y: 140 }, { x: 180, y: 190 }, origin);
  assert.deepEqual(geometry, { x: 20, y: 30, width: 40, height: 50 });
  const history = createHistory(inner.document, true);
  assert.equal(history.past.length, 0);
  const drawn = success(addNode(inner.document, { type: "ellipse", parentId: inner.node.id, ...geometry }));
  assert.equal(undo(commit(history, drawn.document)).present, inner.document);
  assert.equal(frameOrigin(inner.document, "missing"), null);
});
