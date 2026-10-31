import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, moveNode, renameNode } from "../src/document/commands/index.ts";
import { commit, createHistory, isDirty, markSaved, redo, undo } from "../src/document/history.ts";

function success(result) {
  assert.equal(result.type, "Success");
  return result.value;
}

test("追加・改名・移動を順に戻してやり直せる", () => {
  const initial = createDocument();
  const { document: added, node } = success(addNode(initial, {
    type: "rectangle", x: 0, y: 0, width: 100, height: 50,
  }));
  const renamed = success(renameNode(added, node.id, "送信ボタン"));
  const moved = success(moveNode(renamed, node.id, 24, 32));
  let history = commit(commit(commit(createHistory(initial), added), renamed), moved);

  history = undo(history);
  assert.equal(history.present, renamed);
  history = undo(history);
  assert.equal(history.present, added);
  history = undo(history);
  assert.equal(history.present, initial);
  assert.equal(undo(history), history);
  history = redo(redo(redo(history)));
  assert.equal(history.present, moved);
  assert.equal(redo(history), history);
});

test("ドラッグ中のプレビューは履歴に積まず、終了時の移動だけ1件にする", () => {
  const { document, node } = success(addNode(createDocument(), {
    type: "rectangle", x: 0, y: 0, width: 100, height: 50,
  }));
  const initial = createHistory(document, true);
  const preview1 = success(moveNode(document, node.id, 10, 10));
  const preview2 = success(moveNode(preview1, node.id, 20, 20));
  assert.equal(initial.past.length, 0);
  assert.ok(isDirty(initial, preview2));

  const finished = commit(initial, preview2);
  assert.equal(finished.past.length, 1);
  assert.equal(undo(finished).present, document);
  assert.equal(isDirty(initial, document), false);
});

test("保存時点に戻ると保存済みになり、分岐しても履歴番号を誤認しない", () => {
  const initial = createDocument();
  const { document: added, node } = success(addNode(initial, {
    type: "rectangle", x: 0, y: 0, width: 100, height: 50,
  }));
  const renamed = success(renameNode(added, node.id, "保存前"));
  let history = markSaved(commit(commit(createHistory(initial), added), renamed));
  assert.equal(isDirty(history), false);

  history = commit(history, success(moveNode(renamed, node.id, 10, 20)));
  assert.ok(isDirty(history));
  history = undo(history);
  assert.equal(isDirty(history), false);
  history = undo(history);
  assert.ok(isDirty(history));
  history = redo(history);
  assert.equal(isDirty(history), false);

  history = undo(history);
  history = commit(history, success(renameNode(added, node.id, "分岐後")));
  assert.ok(isDirty(history));
  assert.equal(history.future.length, 0);
  assert.equal(redo(history), history);

  const snapshot = history.present;
  history = commit(history, success(moveNode(snapshot, node.id, 40, 50)));
  history = markSaved(history, snapshot);
  assert.ok(isDirty(history));
  assert.equal(isDirty(undo(history)), false);

  const opened = createHistory(createDocument(), true);
  assert.equal(opened.past.length, 0);
  assert.equal(opened.future.length, 0);
  assert.equal(isDirty(opened), false);
});
