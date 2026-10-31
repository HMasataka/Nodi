import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, setNodeGeometry } from "../src/document/commands/index.ts";
import { commit, createHistory, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("位置・サイズの編集は保存でき、1操作で戻せる", () => {
  const { document, node } = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 20, height: 30 }));
  const updated = success(setNodeGeometry(document, node.id, { x: -5, y: 12.5, width: 100, height: 75 }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(updated)))), updated);
  assert.equal(undo(commit(createHistory(document), updated)).present, document);
});

test("不正な寸法と座標は拒否され、元の文書を変更しない", () => {
  const original = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 20, height: 30 })).document;
  for (const geometry of [
    { x: 0, y: 0, width: 0, height: 30 },
    { x: 0, y: 0, width: -1, height: 30 },
    { x: 0, y: 0, width: 20, height: Infinity },
    { x: NaN, y: 0, width: 20, height: 30 },
  ]) assert.equal(setNodeGeometry(original, original.children[0].id, geometry).type, "Failure");
  assert.equal(original.children[0].width, 20);
});
