import assert from "node:assert/strict";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { commit, createHistory, isDirty } from "../src/document/history.ts";
import { corners, document, frame, image, rectangle, success, text } from "./support/factories.ts";
import { findNode, moveNode, renameNode, setBorder, setFrameStyle, setImageFilters, setImageStyle, setMask, setNodeGeometry, setNodeStyle, setRotation, setTextContent, setTextMarks, setTextStyle } from "../src/document/commands/index.ts";

test("同じ値の編集は文書参照と履歴・保存状態を変えない", () => {
  const original = document(frame({ children: [rectangle(), text(), image()] }));
  const operations = [
    (doc: typeof original) => moveNode(doc, "rectangle", 0, 0),
    (doc: typeof original) => renameNode(doc, "rectangle", "矩形"),
    (doc: typeof original) => setNodeGeometry(doc, "rectangle", { x: 0, y: 0, width: 100, height: 50 }),
    (doc: typeof original) => setRotation(doc, "rectangle", 360),
    (doc: typeof original) => setMask(doc, "rectangle", false),
    (doc: typeof original) => setNodeStyle(doc, "rectangle", { fill: "#f3d9c8", cornerRadii: corners(2), stroke: { color: "#d9bbaa", width: 1 } }),
    (doc: typeof original) => setFrameStyle(doc, "frame", { clipContent: true, fill: "#ffffff" }),
    (doc: typeof original) => setBorder(doc, "frame", {}),
    (doc: typeof original) => setImageStyle(doc, "image", { fit: "cover", focalPoint: { x: 0.5, y: 0.5 } }),
    (doc: typeof original) => setImageFilters(doc, "image", { brightness: 1 }),
    (doc: typeof original) => setTextContent(doc, "text", "テキスト"),
    (doc: typeof original) => setTextStyle(doc, "text", { fontSize: 16, fontFamily: "default" }),
    (doc: typeof original) => setTextMarks(doc, "text", []),
  ];
  const history = createHistory(original, true);
  for (const [index, operation] of operations.entries()) {
    const updated = success(operation(original));
    assert.equal(updated, original, `operation ${index}`);
    assert.equal(commit(history, updated), history);
    assert.equal(isDirty(history, updated), false);
  }
});

test("入れ子要素の更新では対象への経路だけを複製する", () => {
  const target = rectangle({ id: "target" });
  const neighbor = rectangle({ id: "neighbor" });
  const inner = frame({ id: "inner", children: [target, neighbor] });
  const sibling = frame({ id: "sibling" });
  const original = document(frame({ id: "outer", children: [inner] }), sibling);
  const updated = success(renameNode(original, "target", "変更後"));
  assert.notEqual(updated, original);
  assert.notEqual(updated.children[0], original.children[0]);
  assert.notEqual(findNode(updated, "inner"), inner);
  assert.equal(findNode(updated, "neighbor"), neighbor);
  assert.equal(updated.children[1], sibling);
  assert.equal(original.children[0].children[0].children[0].name, "矩形");
});

test("MCP の無変更編集は apply を呼ばず新しいリビジョンを作らない", () => {
  let history = createHistory(document(rectangle()), true);
  let applications = 0;
  const api = createAgentApi({ getDocument: () => history.present, getHistory: () => history, getSelectedId: () => null,
    apply: (next) => { applications++; history = commit(history, next); } });
  success(api.setRotation("rectangle", 0));
  success(api.setShapeStyle("rectangle", { fill: "#f3d9c8" }));
  assert.equal(applications, 0);
  assert.equal(history.past.length, 0);
  assert.equal(isDirty(history), false);
  success(api.setRotation("rectangle", 30));
  assert.equal(applications, 1);
  assert.equal(history.past.length, 1);
});
