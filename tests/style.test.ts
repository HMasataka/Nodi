import assert from "node:assert/strict";
import { test } from "vitest";

import { addNode, createDocument, findNode, setFrameStyle, setNodeStyle } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { corners, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("矩形の塗り・線・角丸を編集して保存し、Undo / Redo できる", () => {
  const { document, node } = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 100, height: 50 }));
  const edited = success(setNodeStyle(document, node.id, { fill: "#123456", stroke: { color: "#abcdef", width: 3 }, cornerRadii: corners(12) }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(edited)))), edited);
  const history = commit(createHistory(document), edited);
  assert.equal(undo(history).present.children[0].style.fill, "#f3d9c8");
  assert.deepEqual(redo(undo(history)).present.children[0].style.cornerRadii, corners(12));
});

test("不正なスタイルを拒否し、図形用コマンドはフレームを変更しない", () => {
  const rectangle = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 100, height: 50 }));
  for (const patch of [{ fill: "red" }, { stroke: { color: "#xyzxyz", width: 1 } }, { stroke: { color: "#ffffff", width: -1 } }, { cornerRadii: corners(Infinity) }]) {
    assert.equal(setNodeStyle(rectangle.document, rectangle.node.id, patch).type, "Failure");
  }
  const frame = success(addNode(rectangle.document, { type: "frame", x: 0, y: 0, width: 300, height: 200 }));
  assert.equal(setNodeStyle(frame.document, frame.node.id, { fill: "#ffffff" }).type, "Failure");
  assert.equal(rectangle.document.children[0].style.fill, "#f3d9c8");
});

test("入れ子フレームの背景とはみ出し表示を保存し、Undo / Redo できる", () => {
  const outer = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 300, height: 200 }));
  const inner = success(addNode(outer.document, { type: "frame", parentId: outer.node.id, x: 20, y: 30, width: 100, height: 90 }));
  assert.equal(inner.node.style.fill, "#ffffff");
  assert.equal(inner.node.clipContent, true);
  const edited = success(setFrameStyle(inner.document, inner.node.id, { fill: "#123456", clipContent: false }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(edited)))), edited);
  const history = commit(createHistory(inner.document, true), edited);
  assert.equal(findNode(undo(history).present, inner.node.id).style.fill, "#ffffff");
  assert.equal(findNode(redo(undo(history)).present, inner.node.id).clipContent, false);
  assert.equal(findNode(inner.document, inner.node.id).clipContent, true);
});

test("不正なフレーム設定と欠落した保存項目を拒否する", () => {
  const frame = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 100, height: 100 }));
  const rectangle = success(addNode(frame.document, { type: "rectangle", x: 0, y: 0, width: 30, height: 30 }));
  for (const patch of [{ fill: "red" }, { fill: "#12345g" }, { fill: 0 }, { clipContent: "false" }, { clipContent: 0 }, { clipContent: null }]) {
    assert.equal(setFrameStyle(rectangle.document, frame.node.id, patch).type, "Failure");
  }
  assert.equal(setFrameStyle(rectangle.document, rectangle.node.id, { fill: "#abcdef" }).type, "Failure");
  assert.equal(setFrameStyle(rectangle.document, "missing", { clipContent: true }).type, "Failure");
  for (const patch of [{ style: undefined }, { style: { ...frame.node.style, fill: "invalid" } }, { clipContent: "yes" }]) {
    const invalid = { ...frame.node, ...patch };
    assert.equal(serializeDocument({ version: 1, children: [invalid] }).type, "Failure");
  }
  assert.equal(findNode(rectangle.document, frame.node.id).style.fill, "#ffffff");
});
