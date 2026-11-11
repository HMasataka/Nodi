import assert from "node:assert/strict";
import { test } from "vitest";

import { success } from "./support/factories.ts";
import { addNode, createDocument, deleteNode, duplicateNode, findNode } from "../src/document/commands/index.ts";
import { commit, createHistory, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("階層ごと複製してすべての ID を再生成し、名前・配置を区別する", () => {
  const frame = success(addNode(createDocument(), { type: "frame", name: "画面", x: 0, y: 0, width: 400, height: 300 }));
  const child = success(addNode(frame.document, { type: "rectangle", parentId: frame.node.id, name: "ボタン", x: 10, y: 20, width: 100, height: 40 }));
  const duplicate = success(duplicateNode(child.document, frame.node.id));
  assert.notEqual(duplicate.node.id, frame.node.id);
  assert.notEqual(duplicate.node.children[0].id, child.node.id);
  assert.equal(duplicate.node.children[0].name, "ボタン");
  assert.equal(duplicate.node.name, "画面 のコピー");
  assert.equal(duplicate.node.x, 24);
  assert.equal(duplicate.node.children[0].x, 10);
  assert.equal(success(duplicateNode(duplicate.document, frame.node.id)).node.name, "画面 のコピー 2");
  assert.deepEqual(success(parseDocument(success(serializeDocument(duplicate.document)))), duplicate.document);
});

test("削除・複製は履歴1件で戻せる。見つからない ID は失敗する", () => {
  const original = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 30, height: 30 }));
  const copied = success(duplicateNode(original.document, original.node.id));
  const deleted = success(deleteNode(copied.document, original.node.id));
  assert.equal(findNode(deleted, original.node.id), undefined);
  assert.equal(deleted.children.length, 1);
  assert.equal(undo(commit(createHistory(copied.document), deleted)).present, copied.document);
  assert.equal(undo(commit(createHistory(original.document), copied.document)).present, original.document);
  assert.deepEqual(success(parseDocument(success(serializeDocument(deleted)))), deleted);
  assert.equal(deleteNode(deleted, "missing").type, "Failure");
  assert.equal(duplicateNode(deleted, "missing").type, "Failure");
});
