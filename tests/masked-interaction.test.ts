import assert from "node:assert/strict";
import { test } from "vitest";

import { nodesInBounds } from "../src/pages/editor/geometry.ts";
import { snapMove } from "../src/pages/editor/snapping.ts";
import { absoluteGeometry, walkVisibleNodes } from "../src/document/geometry.ts";
import { document, frame, rectangle } from "./support/factories.ts";

test("マスク自身と完全に隠れた兄弟は選択・スナップ対象にしない", () => {
  const mask = rectangle({ id: "mask", x: 0, y: 0, width: 40, height: 40, isMask: true });
  const hidden = rectangle({ id: "hidden", x: 100, y: 0, width: 20, height: 20 });
  const doc = document(mask, hidden);
  assert.deepEqual(nodesInBounds(doc, { x: 0, y: 0, width: 20, height: 20 }), []);
  assert.deepEqual(nodesInBounds(doc, { x: 100, y: 0, width: 20, height: 20 }), []);
  assert.ok(absoluteGeometry(doc, "mask"));
  assert.ok(absoluteGeometry(doc, "hidden"));
  const mover = rectangle({ id: "mover", x: 45, y: 0, width: 10, height: 10 });
  assert.deepEqual(snapMove(document(mask, mover), ["mover"], 0, 0, 1), { dx: 0, dy: 0, guides: [] });
});

test("一部だけ見える要素はマスクで切ったAABBを選択・スナップに使う", () => {
  const mask = rectangle({ id: "mask", x: 0, y: 0, width: 40, height: 40, isMask: true });
  const partial = rectangle({ id: "partial", x: 30, y: 0, width: 50, height: 40 });
  const mover = rectangle({ id: "mover", x: 55, y: 100, width: 10, height: 10 });
  const doc = document(mask, partial, mover);
  const located: Array<{ id: string; visible: { x: number; y: number; width: number; height: number } }> = [];
  walkVisibleNodes(doc, ({ node, visible }) => { located.push({ id: node.id, visible }); });
  assert.deepEqual(located[0], { id: "partial", visible: { x: 30, y: 0, width: 10, height: 40 } });
  assert.deepEqual(nodesInBounds(doc, { x: 35, y: 5, width: 3, height: 3 }), ["partial"]);
  assert.deepEqual(nodesInBounds(doc, { x: 50, y: 5, width: 3, height: 3 }), []);
  const snapped = snapMove(doc, ["mover"], -17, 0, 1);
  assert.equal(snapped.dx, -15);
  assert.equal(snapped.guides[0].position, 40);
});

test("回転フレーム内と入れ子フレームのクリップは親の変換後のAABBで合成する", () => {
  const mask = rectangle({ id: "mask", x: 0, y: 0, width: 40, height: 20, isMask: true });
  const partial = rectangle({ id: "partial", x: 30, y: 0, width: 30, height: 20 });
  const rotated = frame({ id: "rotated", x: 100, y: 50, width: 100, height: 80, rotation: 90,
    children: [mask, partial] });
  const clipped = frame({ id: "clipped", x: 0, y: 0, width: 20, height: 20, children: [rectangle({ id: "outside", x: 30, y: 0, width: 10, height: 10 })] });
  const doc = document(rotated, clipped);
  const entries: Record<string, { x: number; y: number; width: number; height: number }> = {};
  walkVisibleNodes(doc, ({ node, visible }) => { entries[node.id] = visible; });
  assert.deepEqual(entries.partial, { x: 170, y: 70, width: 20, height: 10 });
  assert.equal(entries.outside, undefined);
  assert.deepEqual(nodesInBounds(doc, { x: 170, y: 70, width: 5, height: 5 }), ["rotated", "partial"]);
  const visible = document({ ...clipped, clipContent: false });
  assert.deepEqual(nodesInBounds(visible, { x: 30, y: 0, width: 5, height: 5 }), ["outside"]);
});
