import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, setNodeStyle } from "../src/document/commands.ts";
import { parseDocument, serializeDocument } from "../src/document/format.ts";
import { commit, createHistory, undo, redo } from "../src/document/history.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("矩形の塗り・線・角丸を編集して保存し、Undo / Redo できる", () => {
  const { document, node } = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 100, height: 50 }));
  const edited = success(setNodeStyle(document, node.id, { fill: "#123456", stroke: "#abcdef", strokeWidth: 3, cornerRadius: 12 }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(edited)))), edited);
  const history = commit(createHistory(document), edited);
  assert.equal(undo(history).present.children[0].fill, "#f3d9c8");
  assert.equal(redo(undo(history)).present.children[0].cornerRadius, 12);
});

test("不正なスタイルは拒否し、フレームは矩形のスタイルを持たない", () => {
  const rectangle = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 100, height: 50 }));
  for (const patch of [{ fill: "red" }, { stroke: "#xyzxyz" }, { strokeWidth: -1 }, { cornerRadius: Infinity }]) {
    assert.equal(setNodeStyle(rectangle.document, rectangle.node.id, patch).type, "Failure");
  }
  const frame = success(addNode(rectangle.document, { type: "frame", x: 0, y: 0, width: 300, height: 200 }));
  assert.equal(setNodeStyle(frame.document, frame.node.id, { fill: "#ffffff" }).type, "Failure");
  assert.equal(rectangle.document.children[0].fill, "#f3d9c8");
});
