import assert from "node:assert/strict";
import { success } from "./support/factories.ts";
import { test } from "vitest";
import { addNode, createDocument, moveNode, renameNode } from "../src/document/commands/index.ts";
import { commit, createHistory, getRevision, isDirty, listRevisions, markSaved, redo, undo } from "../src/document/history.ts";

test("編集時点は不変の ID と親 ID を持ち、Undo / Redo でも変わらない", () => {
  const initial = createDocument();
  const first = createHistory(initial, true);
  const added = success(addNode(initial, { type: "rectangle", x: 0, y: 0, width: 40, height: 30 }));
  const second = commit(first, added.document);
  const renamed = success(renameNode(second.present, added.node.id, "ボタン"));
  const third = commit(second, renamed);
  assert.match(first.presentRevisionId, /^rev_/);
  assert.notEqual(first.presentRevisionId, second.presentRevisionId);
  assert.notEqual(second.presentRevisionId, third.presentRevisionId);
  assert.equal(getRevision(third, second.presentRevisionId).parentId, first.presentRevisionId);
  assert.equal(getRevision(third, third.presentRevisionId).parentId, second.presentRevisionId);
  assert.equal(undo(third).presentRevisionId, second.presentRevisionId);
  assert.equal(redo(undo(third)).presentRevisionId, third.presentRevisionId);
  assert.equal(listRevisions(third).length, 3);
  assert.equal(commit(third, third.present), third);
});

test("分岐後も旧分岐を照会でき、ID は再利用しない", () => {
  const start = createHistory(createDocument());
  const added = success(addNode(start.present, { type: "rectangle", x: 0, y: 0, width: 40, height: 30 }));
  const base = commit(start, added.document);
  const old = commit(base, success(moveNode(base.present, added.node.id, 10, 0)));
  const oldId = old.presentRevisionId;
  const branched = commit(undo(old), success(moveNode(base.present, added.node.id, 0, 20)));
  assert.notEqual(branched.presentRevisionId, oldId);
  assert.equal(getRevision(branched, oldId).document.children[0].x, 10);
  assert.equal(getRevision(branched, branched.presentRevisionId).document.children[0].y, 20);
  assert.equal(getRevision(branched, branched.presentRevisionId).parentId, base.presentRevisionId);
  assert.equal(branched.future.length, 0);
  assert.equal(redo(branched), branched);
  assert.equal(listRevisions(branched).length, 4);
  const snapshot = getRevision(branched, oldId);
  snapshot.document.children[0].x = 999;
  assert.equal(getRevision(branched, oldId).document.children[0].x, 10);
});

test("保存済み時点とプレビューの確定を追跡し、別ファイルの履歴を混同しない", () => {
  const start = createHistory(createDocument(), true);
  const added = success(addNode(start.present, { type: "rectangle", x: 0, y: 0, width: 40, height: 30 }));
  const saved = markSaved(commit(start, added.document));
  assert.equal(saved.savedRevisionId, saved.presentRevisionId);
  assert.equal(isDirty(saved), false);
  const preview = success(moveNode(saved.present, added.node.id, 10, 20));
  assert.equal(listRevisions(saved).length, 2);
  const pending = markSaved(saved, preview);
  assert.equal(pending.savedRevisionId, null);
  const finished = commit(pending, preview);
  assert.equal(finished.savedRevisionId, finished.presentRevisionId);
  assert.equal(isDirty(finished), false);
  assert.equal(isDirty(undo(finished)), true);

  const opened = createHistory(createDocument(), true);
  assert.notEqual(opened.presentRevisionId, start.presentRevisionId);
  assert.equal(getRevision(opened, finished.presentRevisionId), undefined);
  assert.deepEqual(listRevisions(opened).map((revision) => revision.isSaved), [true]);
});
