import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, findNode, moveNode } from "../src/document/commands/index.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("フレーム内の子は親基準の座標と ID を保って保存・再読込できる", () => {
  const parent = success(addNode(createDocument(), { type: "frame", name: "画面", x: 100, y: 200, width: 400, height: 300 }));
  const child = success(addNode(parent.document, { type: "rectangle", parentId: parent.node.id, name: "ボタン", x: 24, y: 50, width: 100, height: 40 }));
  const moved = success(moveNode(child.document, child.node.id, 32, 60));
  const loaded = success(parseDocument(success(serializeDocument(moved))));
  assert.equal(findNode(loaded, parent.node.id).x, 100);
  assert.equal(findNode(loaded, child.node.id).x, 32);
  assert.equal(findNode(loaded, child.node.id).y, 60);
  assert.equal(loaded.children[0].children[0].id, child.node.id);
});

test("同名の子要素を ID で区別できる", () => {
  const parent = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 400, height: 300 }));
  const first = success(addNode(parent.document, { type: "rectangle", parentId: parent.node.id, name: "ボタン", x: 0, y: 0, width: 20, height: 20 }));
  const second = success(addNode(first.document, { type: "rectangle", parentId: parent.node.id, name: "ボタン", x: 30, y: 0, width: 20, height: 20 }));
  assert.notEqual(first.node.id, second.node.id);
  assert.equal(findNode(second.document, first.node.id).x, 0);
  assert.equal(findNode(second.document, second.node.id).x, 30);
});
