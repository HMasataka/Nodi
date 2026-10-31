import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, deleteNode, moveNode, renameNode, setNodeGeometry } from "../src/document/commands/index.ts";
import { commit, createHistory, undo } from "../src/document/history.ts";
import { compareElementRevisions, measureElementAtRevision, measureRelativeAtRevision } from "../src/document/measure.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }
function failure(result) { assert.equal(result.type, "Failure"); return result.error; }

test("入れ子フレームのローカル座標と絶対境界を取得する", () => {
  const outer = success(addNode(createDocument(), { type: "frame", name: "画面", x: 100, y: 50, width: 400, height: 300 }));
  const inner = success(addNode(outer.document, { type: "frame", parentId: outer.node.id, name: "パネル", x: 20, y: 30, width: 200, height: 150 }));
  const child = success(addNode(inner.document, { type: "rectangle", parentId: inner.node.id, name: "ボタン", x: 10, y: 15, width: 80, height: 40 }));
  const history = createHistory(child.document, true);
  const measured = success(measureElementAtRevision(history, history.presentRevisionId, child.node.id));
  assert.equal(measured.path, "画面 › パネル › ボタン");
  assert.equal(measured.parentId, inner.node.id);
  assert.deepEqual(measured.local, { x: 10, y: 15, width: 80, height: 40 });
  assert.deepEqual(measured.absolute, {
    x: 130, y: 95, width: 80, height: 40,
    left: 130, top: 95, right: 210, bottom: 135, centerX: 170, centerY: 115,
  });
  assert.equal(success(measureElementAtRevision(history, history.presentRevisionId, outer.node.id)).absolute.x, 100);
});

test("親の移動、子のリサイズと改名を2時点の数値差分に反映する", () => {
  const frame = success(addNode(createDocument(), { type: "frame", name: "画面", x: 100, y: 50, width: 300, height: 200 }));
  const child = success(addNode(frame.document, { type: "rectangle", parentId: frame.node.id, name: "前", x: 10, y: 20, width: 80, height: 40 }));
  const before = createHistory(child.document);
  const movedFrame = commit(before, success(moveNode(before.present, frame.node.id, 130, 60)));
  const moved = success(compareElementRevisions(movedFrame, before.presentRevisionId, movedFrame.presentRevisionId, child.node.id));
  assert.deepEqual(moved.delta.local, { x: 0, y: 0, width: 0, height: 0 });
  assert.deepEqual(moved.delta.absolute, { x: 30, y: 10, width: 0, height: 0, centerX: 30, centerY: 10 });

  const resized = success(setNodeGeometry(movedFrame.present, child.node.id, { x: 18, y: 24, width: 100, height: 60 }));
  const after = commit(movedFrame, success(renameNode(resized, child.node.id, "後")));
  const compared = success(compareElementRevisions(after, before.presentRevisionId, after.presentRevisionId, child.node.id));
  assert.equal(compared.from.path, "画面 › 前");
  assert.equal(compared.to.path, "画面 › 後");
  assert.deepEqual(compared.delta.local, { x: 8, y: 4, width: 20, height: 20 });
  assert.deepEqual(compared.delta.absolute, { x: 38, y: 14, width: 20, height: 20, centerX: 48, centerY: 24 });
});

test("別分岐の時点も比較でき、間隔・方向・重なりを数値で返す", () => {
  const first = success(addNode(createDocument(), { type: "rectangle", name: "左", x: 0, y: 0, width: 100, height: 100 }));
  const second = success(addNode(first.document, { type: "rectangle", name: "右", x: 120, y: 20, width: 50, height: 60 }));
  const base = createHistory(second.document);
  const relative = success(measureRelativeAtRevision(base, base.presentRevisionId, first.node.id, second.node.id));
  assert.deepEqual(relative.centerDelta, { x: 95, y: 0 });
  assert.equal(relative.horizontal, "right");
  assert.equal(relative.vertical, "overlap");
  assert.equal(relative.gapX, 20);
  assert.equal(relative.gapY, 0);
  assert.deepEqual(relative.overlap, { width: 0, height: 60, area: 0 });

  const old = commit(base, success(moveNode(base.present, second.node.id, 80, 80)));
  const oldId = old.presentRevisionId;
  const branch = commit(undo(old), success(moveNode(base.present, second.node.id, -60, -90)));
  const overlap = success(measureRelativeAtRevision(branch, oldId, first.node.id, second.node.id));
  assert.deepEqual(overlap.overlap, { width: 20, height: 20, area: 400 });
  const left = success(measureRelativeAtRevision(branch, branch.presentRevisionId, first.node.id, second.node.id));
  assert.equal(left.horizontal, "left");
  assert.equal(left.vertical, "above");
  assert.equal(left.gapX, 10);
  assert.equal(left.gapY, 30);
  assert.equal(success(compareElementRevisions(branch, oldId, branch.presentRevisionId, second.node.id)).delta.absolute.x, -140);
});

test("存在しないリビジョン・要素と削除済み要素は失敗し、履歴を変えない", () => {
  const added = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 20, height: 20 }));
  const before = createHistory(added.document, true);
  const after = commit(before, success(deleteNode(before.present, added.node.id)));
  assert.match(failure(measureElementAtRevision(after, "rev_missing", added.node.id)).message, /リビジョン/);
  assert.match(failure(measureElementAtRevision(after, after.presentRevisionId, added.node.id)).message, /要素/);
  assert.match(failure(compareElementRevisions(after, before.presentRevisionId, "rev_missing", added.node.id)).message, /リビジョン/);
  assert.equal(compareElementRevisions(after, before.presentRevisionId, after.presentRevisionId, added.node.id).type, "Failure");
  assert.equal(measureRelativeAtRevision(after, before.presentRevisionId, added.node.id, added.node.id).type, "Failure");
  assert.match(failure(measureRelativeAtRevision(after, before.presentRevisionId, added.node.id, "missing")).message, /要素/);
  assert.equal(after.present.children.length, 0);
  assert.equal(success(measureElementAtRevision(after, before.presentRevisionId, added.node.id)).absolute.width, 20);
});
