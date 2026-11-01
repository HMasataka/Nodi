import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, reorderNode } from "../src/document/commands/index.ts";
import { commit, createHistory, isDirty, redo, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("同じ親の子だけを並べ替え、位置と ID を維持して保存・Undo / Redo する", () => {
  const frame = success(addNode(createDocument(), { type: "frame", x: 30, y: 40, width: 200, height: 150 }));
  const first = success(addNode(frame.document, { type: "rectangle", parentId: frame.node.id, name: "カード", x: 10, y: 10, width: 80, height: 80 }));
  const second = success(addNode(first.document, { type: "rectangle", parentId: frame.node.id, name: "カード", x: 20, y: 20, width: 80, height: 80 }));
  const third = success(addNode(second.document, { type: "rectangle", parentId: frame.node.id, x: 30, y: 30, width: 80, height: 80 }));
  const other = success(addNode(third.document, { type: "rectangle", x: 0, y: 0, width: 20, height: 20 }));
  const before = createHistory(other.document, true);
  const changed = success(reorderNode(other.document, first.node.id, "front"));
  assert.deepEqual(changed.children.map((node) => node.id), other.document.children.map((node) => node.id));
  assert.deepEqual(changed.children[0].children.map((node) => node.id), [second.node.id, third.node.id, first.node.id]);
  assert.deepEqual(changed.children[0].children.find((node) => node.id === first.node.id), first.node);
  assert.deepEqual(other.document.children[0].children.map((node) => node.id), [first.node.id, second.node.id, third.node.id]);
  assert.deepEqual(success(parseDocument(success(serializeDocument(changed)))), changed);
  const history = commit(before, changed);
  assert.ok(isDirty(history));
  assert.equal(undo(history).present, other.document);
  assert.equal(redo(undo(history)).present, changed);
  assert.equal(reorderNode(changed, first.node.id, "front").value, changed);
  assert.equal(reorderNode(changed, "missing", "back").type, "Failure");
  assert.deepEqual(success(reorderNode(changed, first.node.id, "backward")).children[0].children.map((node) => node.id), [second.node.id, first.node.id, third.node.id]);
});
