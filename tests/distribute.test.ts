import assert from "node:assert/strict";
import { test } from "vitest";

import { absoluteGeometry } from "../src/document/geometry.ts";
import { success } from "./support/factories.ts";
import { addNode, createDocument, distributeNodes, measureSelectionSpacing, setFrameLayout, setRotation } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("回転した子の画面上の外接矩形を横・縦で分配し、両端と親座標を保持する", () => {
  const frame = success(addNode(createDocument(), { type: "frame", x: 200, y: 100, width: 600, height: 600 }));
  const rotatedFrame = success(setRotation(frame.document, frame.node.id, 30));
  const a = success(addNode(rotatedFrame, { type: "rectangle", parentId: frame.node.id, x: 10, y: 30, width: 40, height: 20 }));
  const rotatedA = success(setRotation(a.document, a.node.id, 45));
  const b = success(addNode(rotatedA, { type: "rectangle", parentId: frame.node.id, x: 150, y: 190, width: 65, height: 30 }));
  const c = success(addNode(b.document, { type: "rectangle", parentId: frame.node.id, x: 390, y: 320, width: 90, height: 50 }));
  const ids = [c.node.id, a.node.id, b.node.id];
  for (const axis of ["x", "y"] as const) {
    const before = success(measureSelectionSpacing(c.document, ids, axis));
    const after = success(distributeNodes(c.document, ids, axis, "equal"));
    const measured = success(measureSelectionSpacing(after, ids, axis));
    assert.ok(Math.abs(measured.intervals[0].distance - measured.intervals[1].distance) < 1e-9);
    assert.equal(absoluteGeometry(after, a.node.id)?.[axis], absoluteGeometry(c.document, a.node.id)?.[axis]);
    assert.equal(absoluteGeometry(after, c.node.id)?.[axis], absoluteGeometry(c.document, c.node.id)?.[axis]);
    assert.equal(before.intervals.length, 2);
    assert.deepEqual(success(parseDocument(success(serializeDocument(after)))), after);
    const history = commit(createHistory(c.document, true), after);
    assert.equal(undo(history).present, c.document);
    assert.equal(redo(undo(history)).present, after);
  }
});

test("数値指定は先頭を固定し、選択順に左右されず0以上の間隔を設定する", () => {
  const a = success(addNode(createDocument(), { type: "rectangle", x: 10, y: 0, width: 20, height: 20 }));
  const b = success(addNode(a.document, { type: "rectangle", x: 90, y: 0, width: 30, height: 20 }));
  const c = success(addNode(b.document, { type: "rectangle", x: 200, y: 0, width: 40, height: 20 }));
  const ids = [c.node.id, a.node.id, b.node.id];
  const after = success(distributeNodes(c.document, ids, "x", 12));
  assert.deepEqual([a.node.id, b.node.id, c.node.id].map((id) => absoluteGeometry(after, id)?.x), [10, 42, 84]);
  assert.deepEqual(success(measureSelectionSpacing(after, ids, "x")).intervals.map(({ distance }) => distance), [12, 12]);
  assert.equal(success(distributeNodes(after, ids, "x", 12)), after);
});

test("不正な選択と間隔は文書を変更せず失敗する", () => {
  const frame = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 300, height: 300 }));
  const a = success(addNode(frame.document, { type: "rectangle", parentId: frame.node.id, x: 0, y: 0, width: 20, height: 20 }));
  const b = success(addNode(a.document, { type: "rectangle", parentId: frame.node.id, x: 60, y: 0, width: 20, height: 20 }));
  const c = success(addNode(b.document, { type: "rectangle", x: 150, y: 0, width: 20, height: 20 }));
  for (const ids of [[a.node.id, b.node.id, c.node.id], [frame.node.id, a.node.id, b.node.id], [a.node.id, a.node.id, b.node.id], [a.node.id, b.node.id, "missing"]]) {
    assert.equal(distributeNodes(c.document, ids, "x", "equal").type, "Failure");
  }
  assert.equal(distributeNodes(c.document, [a.node.id, b.node.id, c.node.id], "x", -1).type, "Failure");
  assert.equal(distributeNodes(c.document, [a.node.id, b.node.id, c.node.id], "x", Infinity).type, "Failure");
  const auto = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 300, height: 100 }));
  const layout = success(setFrameLayout(auto.document, auto.node.id, { layoutMode: "horizontal" }));
  const children = [0, 1, 2].reduce((document, x) => success(addNode(document, { type: "rectangle", parentId: auto.node.id, x: x * 50, y: 0, width: 20, height: 20 })).document, layout);
  assert.equal(distributeNodes(children, children.children[0].type === "frame" ? children.children[0].children.map((node) => node.id) : [], "x", "equal").type, "Failure");
});
