import assert from "node:assert/strict";
import { test } from "vitest";

import { drawPreviewStyle } from "../src/pages/editor/canvasStyles.ts";
import { absoluteGeometry, listLocatedNodes } from "../src/document/geometry.ts";
import { alignNodes, moveNodes } from "../src/document/commands/index.ts";
import { document, frame, rectangle, success } from "./support/factories.ts";
import { drawingGeometry, geometryWithFixedCorner, nodesInBounds, resizeFromWorldDelta } from "../src/pages/editor/geometry.ts";
import { nodeTransform, transformPoint } from "../src/document/transform.ts";
import { snapMove, snapResize } from "../src/pages/editor/snapping.ts";

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
}

test("回転後のリサイズは逆回転したポインタ差分を使い、反対側の角を固定する", () => {
  const node = rectangle({ x: 10, y: 20, width: 40, height: 20, rotation: 90 });
  const parent = listLocatedNodes(document(node))[0].parent;
  const oldCorner = transformPoint(nodeTransform(node), { x: 0, y: 0 });
  const resized = resizeFromWorldDelta(node, parent, { x: 0, y: 10 });
  assert.deepEqual(resized, { x: 5, y: 25, width: 50, height: 20 });
  assert.deepEqual(transformPoint(nodeTransform({ ...node, ...resized }), { x: 0, y: 0 }), oldCorner);
  const diagonal = rectangle({ x: 2, y: 3, width: 40, height: 20, rotation: 45 });
  const changed = resizeFromWorldDelta(diagonal, parent, { x: 10, y: 0 });
  const before = transformPoint(nodeTransform(diagonal), { x: 0, y: 0 });
  const after = transformPoint(nodeTransform({ ...diagonal, ...changed }), { x: 0, y: 0 });
  near(before.x, after.x);
  near(before.y, after.y);
  assert.deepEqual(geometryWithFixedCorner(node, node.width, node.height), { x: 10, y: 20, width: 40, height: 20 });
});

test("回転後のAABBで移動し、ハンドルの世界座標を逆変換してリサイズスナップする", () => {
  const moving = rectangle({ x: 0, y: 0, width: 40, height: 20, rotation: 90 });
  const target = rectangle({ id: "target", x: 40, y: -10, width: 20, height: 40 });
  const doc = document(moving, target);
  const snapped = snapMove(doc, [moving.id], 28, 0, 1);
  assert.equal(snapped.dx, 30);
  assert.equal(snapped.guides[0].position, 40);

  const resizeTarget = rectangle({ id: "resize-target", x: 100, y: 40, width: 20, height: 20 });
  const proposed = resizeFromWorldDelta(moving, listLocatedNodes(document(moving))[0].parent, { x: 0, y: 7 });
  const result = snapResize(document(moving, resizeTarget), moving.id, proposed, 1);
  near(result.geometry.width, 50);
  near(result.geometry.height, 20);
  near(result.guides[0].position, 40);
  const corner = transformPoint(nodeTransform({ ...moving, ...result.geometry }), { x: 0, y: 0 });
  near(corner.x, 30);
  near(corner.y, -10);
});

test("回転フレーム内の整列・グループ移動は世界差分を親ローカルに戻す", () => {
  const child = rectangle({ id: "child", x: 10, y: 10, width: 20, height: 10 });
  const parent = frame({ x: 100, y: 100, width: 100, height: 100, rotation: 90, children: [child] });
  const target = rectangle({ id: "target", x: 100, y: 100, width: 20, height: 10 });
  const doc = document(parent, target);
  const aligned = success(alignNodes(doc, [child.id, target.id], "left"));
  near(absoluteGeometry(aligned, child.id)!.x, 100);
  near(absoluteGeometry(aligned, target.id)!.x, 100);
  const moved = success(moveNodes(doc, [child.id], 10, 0));
  near(absoluteGeometry(moved, child.id)!.x, absoluteGeometry(doc, child.id)!.x + 10);
  assert.deepEqual(moved.children[0].children[0].y, 0);
});

test("範囲選択と回転フレーム内の描画プレビューは回転後AABBとローカル変換を使う", () => {
  const rotated = rectangle({ rotation: 45, width: 40, height: 20 });
  assert.deepEqual(nodesInBounds(document(rotated), { x: -1, y: -10, width: 2, height: 2 }), [rotated.id]);
  const parent = frame({ x: 100, y: 50, width: 100, height: 80, rotation: 90 });
  const transform = nodeTransform(parent);
  const start = transformPoint(transform, { x: 10, y: 20 });
  const end = transformPoint(transform, { x: 50, y: 60 });
  const geometry = drawingGeometry(start, end, transform);
  assert.deepEqual(geometry, { x: 10, y: 20, width: 40, height: 40 });
  const preview = drawPreviewStyle(geometry, transform);
  assert.equal(preview.transform, "matrix(0, 1, -1, 0, 0, 0)");
  near(Number(preview.left), start.x);
  near(Number(preview.top), start.y);
});
