import assert from "node:assert/strict";
import test from "node:test";

import { absoluteGeometry } from "../src/document/geometry.ts";
import { success } from "./support/factories.mjs";
import { addNode, alignNodes, createDocument, findNode } from "../src/document/commands/index.ts";
import { commit, createHistory, isDirty, redo, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { snapMove, snapResize } from "../src/pages/editor/snapping.ts";

test("移動・リサイズの辺と中心をズームに応じた閾値でスナップし、ガイドだけでは履歴を変えない", () => {
  const a = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 100, height: 40 }));
  const b = success(addNode(a.document, { type: "rectangle", x: 150, y: 80, width: 80, height: 80 }));
  const history = createHistory(b.document, true);
  const atOne = snapMove(b.document, [a.node.id], 48, 38, 1);
  const atTwo = snapMove(b.document, [a.node.id], 48, 38, 2);
  assert.deepEqual([atOne.dx, atOne.dy], [50, 40]);
  assert.deepEqual([atTwo.dx, atTwo.dy], [50, 40]);
  assert.deepEqual(atOne.guides.map((guide) => [guide.orientation, guide.position]), [["vertical", 150], ["horizontal", 80]]);
  const nearAtOne = snapMove(b.document, [a.node.id], 44, 35, 1);
  const nearAtTwo = snapMove(b.document, [a.node.id], 44, 35, 2);
  assert.deepEqual([nearAtOne.dx, nearAtOne.dy], [50, 40]);
  assert.deepEqual([nearAtTwo.dx, nearAtTwo.dy], [44, 35]);
  const resized = snapResize(b.document, a.node.id, { x: 0, y: 0, width: 145, height: 75 }, 1);
  assert.deepEqual(resized.geometry, { x: 0, y: 0, width: 150, height: 80 });
  assert.equal(resized.guides.length, 2);
  const centered = snapMove(b.document, [a.node.id], 139, 99, 1);
  assert.deepEqual([centered.dx, centered.dy], [140, 100]);
  assert.deepEqual(centered.guides.map((guide) => guide.position), [190, 120]);
  const centerResized = snapResize(b.document, a.node.id, { x: 0, y: 0, width: 298, height: 238 }, 1);
  assert.deepEqual([centerResized.geometry.width, centerResized.geometry.height], [300, 240]);
  assert.deepEqual(centerResized.guides.map((guide) => guide.position), [150, 120]);
  assert.equal(history.present, b.document);
  assert.equal(isDirty(history), false);
});

test("選択フレームの子にはスナップせず、入れ子のリサイズは絶対座標で比較する", () => {
  const frame = success(addNode(createDocument(), { type: "frame", x: 100, y: 50, width: 400, height: 300 }));
  const child = success(addNode(frame.document, { type: "rectangle", parentId: frame.node.id, x: 10, y: 20, width: 100, height: 40 }));
  const onlyFrameAndChild = snapMove(child.document, [frame.node.id], 0, 0, 1);
  assert.deepEqual(onlyFrameAndChild, { dx: 0, dy: 0, guides: [] });

  const sibling = success(addNode(child.document, { type: "rectangle", parentId: frame.node.id, x: 150, y: 100, width: 80, height: 40 }));
  const result = snapResize(sibling.document, child.node.id, { x: 10, y: 20, width: 145, height: 40 }, 1);
  assert.equal(result.geometry.width, 140);
  assert.equal(result.guides.find((guide) => guide.orientation === "vertical")?.position, 250);
});

test("別フレームの要素を左右・上下・中心で整列して保存・Undo / Redo できる", () => {
  const frameA = success(addNode(createDocument(), { type: "frame", x: 100, y: 50, width: 200, height: 180 }));
  const a = success(addNode(frameA.document, { type: "rectangle", parentId: frameA.node.id, x: 10, y: 20, width: 40, height: 20 }));
  const frameB = success(addNode(a.document, { type: "frame", x: 300, y: 150, width: 200, height: 180 }));
  const b = success(addNode(frameB.document, { type: "rectangle", parentId: frameB.node.id, x: 15, y: 25, width: 80, height: 40 }));
  for (const [alignment, anchor] of [
    ["left", (bounds) => bounds.x], ["centerX", (bounds) => bounds.x + bounds.width / 2], ["right", (bounds) => bounds.x + bounds.width],
    ["top", (bounds) => bounds.y], ["centerY", (bounds) => bounds.y + bounds.height / 2], ["bottom", (bounds) => bounds.y + bounds.height],
  ]) {
    const aligned = success(alignNodes(b.document, [a.node.id, b.node.id], alignment));
    assert.equal(anchor(absoluteGeometry(aligned, a.node.id)), anchor(absoluteGeometry(aligned, b.node.id)), alignment);
    assert.equal(findNode(aligned, frameA.node.id).x, 100);
    assert.equal(findNode(aligned, frameB.node.id).x, 300);
    assert.deepEqual(success(parseDocument(success(serializeDocument(aligned)))), aligned);
  }
  const aligned = success(alignNodes(b.document, [a.node.id, b.node.id], "left"));
  const history = commit(createHistory(b.document, true), aligned);
  assert.equal(history.past.length, 1);
  assert.equal(isDirty(history), true);
  assert.equal(undo(history).present, b.document);
  assert.equal(redo(undo(history)).present, aligned);
  assert.equal(alignNodes(b.document, [a.node.id, "missing"], "left").type, "Failure");
  assert.equal(alignNodes(b.document, [a.node.id], "left").type, "Failure");
  assert.equal(alignNodes(b.document, [frameA.node.id, a.node.id], "left").type, "Failure");
});
