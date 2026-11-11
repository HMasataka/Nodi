import assert from "node:assert/strict";
import { test } from "vitest";

import { success } from "./support/factories.ts";
import { toggleSelection } from "../src/pages/editor/selection.ts";
import { absoluteGeometry, nodesInBounds } from "../src/pages/editor/geometry.ts";
import { addNode, createDocument, deleteNodes, findNode, moveNodes } from "../src/document/commands/index.ts";
import { commit, createHistory, isDirty, redo, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("Shift 選択と範囲選択は履歴を変えず、別フレームの要素を見つける", () => {
  const firstFrame = success(addNode(createDocument(), { type: "frame", x: 100, y: 50, width: 150, height: 130 }));
  const first = success(addNode(firstFrame.document, { type: "rectangle", parentId: firstFrame.node.id, x: 10, y: 20, width: 40, height: 30 }));
  const secondFrame = success(addNode(first.document, { type: "frame", x: 300, y: 150, width: 140, height: 120 }));
  const second = success(addNode(secondFrame.document, { type: "rectangle", parentId: secondFrame.node.id, x: 15, y: 25, width: 40, height: 30 }));
  const history = createHistory(second.document, true);
  assert.deepEqual(toggleSelection(toggleSelection([], first.node.id), second.node.id), [first.node.id, second.node.id]);
  assert.deepEqual(toggleSelection([first.node.id, second.node.id], first.node.id), [second.node.id]);
  assert.deepEqual(nodesInBounds(second.document, { x: 105, y: 65, width: 255, height: 150 }), [firstFrame.node.id, first.node.id, secondFrame.node.id, second.node.id]);
  assert.deepEqual(nodesInBounds(second.document, { x: 250, y: 60, width: 50, height: 300 }), []);
  assert.equal(isDirty(history), false);
  assert.equal(history.past.length, 0);

  const moved = success(moveNodes(second.document, [first.node.id, second.node.id], 20, -10));
  assert.deepEqual(absoluteGeometry(moved, first.node.id), { x: 130, y: 60, width: 40, height: 30 });
  assert.deepEqual(absoluteGeometry(moved, second.node.id), { x: 335, y: 165, width: 40, height: 30 });
  assert.equal(findNode(moved, firstFrame.node.id).x, 100);
  assert.equal(findNode(moved, secondFrame.node.id).x, 300);
  const changed = commit(history, moved);
  assert.equal(changed.past.length, 1);
  assert.equal(undo(changed).present, second.document);
  assert.equal(redo(undo(changed)).present, moved);
  assert.deepEqual(success(parseDocument(success(serializeDocument(moved)))), moved);

  const parentMoved = success(moveNodes(second.document, [firstFrame.node.id, first.node.id], 20, 10));
  assert.equal(findNode(parentMoved, first.node.id).x, 10);
  assert.equal(absoluteGeometry(parentMoved, first.node.id).x, 130);
  assert.equal(moveNodes(second.document, [first.node.id, "missing"], 1, 1).type, "Failure");
  assert.equal(moveNodes(second.document, [first.node.id], Infinity, 0).type, "Failure");
  assert.equal(second.document.children[0].x, 100);

  const deleted = success(deleteNodes(second.document, [first.node.id, second.node.id]));
  assert.equal(findNode(deleted, first.node.id), undefined);
  assert.equal(findNode(deleted, second.node.id), undefined);
  assert.equal(commit(history, deleted).past.length, 1);
  assert.equal(deleteNodes(second.document, [first.node.id, "missing"]).type, "Failure");
  assert.equal(findNode(success(deleteNodes(second.document, [firstFrame.node.id, first.node.id])), first.node.id), undefined);
});
