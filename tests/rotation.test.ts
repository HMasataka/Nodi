import assert from "node:assert/strict";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { setRotation } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { compareElementRevisions, measureElementAtRevision } from "../src/document/measure.ts";
import { composeTransform, cornersAabb, IDENTITY_TRANSFORM, nodeTransform, rotatePoint, transformedCorners } from "../src/document/transform.ts";
import { document, ellipse, failure, frame, image, rectangle, success, text } from "./support/factories.ts";
import { frameNodeStyle, imageNodeStyle, shapeNodeStyle, textNodeStyle } from "../src/pages/editor/canvasStyles.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
}

test("0 度は従来の境界を維持し、90 度は中心を固定して四隅と AABB を回す", () => {
  const node = rectangle({ x: 10, y: 20, width: 80, height: 40 });
  const history = createHistory(document(node));
  const original = success(measureElementAtRevision(history, history.presentRevisionId, node.id));
  assert.deepEqual(original.absolute, { x: 10, y: 20, width: 80, height: 40, left: 10, top: 20, right: 90, bottom: 60, centerX: 50, centerY: 40 });
  assert.deepEqual(original.corners, [{ x: 10, y: 20 }, { x: 90, y: 20 }, { x: 90, y: 60 }, { x: 10, y: 60 }]);
  assert.equal(original.rotation, 0);
  const rotated = commit(history, success(setRotation(history.present, node.id, 90)));
  const measured = success(measureElementAtRevision(rotated, rotated.presentRevisionId, node.id));
  assert.deepEqual(measured.local, original.local);
  assert.equal(measured.rotation, 90);
  [[70, 0], [70, 80], [30, 80], [30, 0]].forEach(([x, y], index) => {
    near(measured.corners[index].x, x);
    near(measured.corners[index].y, y);
  });
  near(measured.absolute.x, 30);
  near(measured.absolute.y, 0);
  near(measured.absolute.width, 40);
  near(measured.absolute.height, 80);
  assert.equal(success(compareElementRevisions(rotated, history.presentRevisionId, rotated.presentRevisionId, node.id)).delta.rotation, 90);
});

test("45 度と親子回転をアフィン合成し、四隅から AABB を求める", () => {
  const root = frame({ x: 100, y: 50, width: 200, height: 100, rotation: 90, children: [
    frame({ id: "inner", x: 20, y: 10, width: 100, height: 80, rotation: 45, children: [
      rectangle({ x: 10, y: 20, width: 40, height: 20, rotation: 45 }),
    ] }),
  ] });
  const history = createHistory(document(root));
  const measured = success(measureElementAtRevision(history, history.presentRevisionId, "rectangle"));
  const inner = root.children[0];
  assert.equal(inner.type, "frame");
  if (inner.type !== "frame") return;
  const world = composeTransform(composeTransform(composeTransform(IDENTITY_TRANSFORM, nodeTransform(root)), nodeTransform(inner)), nodeTransform(inner.children[0]));
  const expected = transformedCorners(world, 40, 20);
  expected.forEach((point, index) => {
    near(measured.corners[index].x, point.x);
    near(measured.corners[index].y, point.y);
  });
  const aabb = cornersAabb(expected);
  near(measured.absolute.x, aabb.x);
  near(measured.absolute.width, aabb.width);
  assert.deepEqual(measured.local, { x: 10, y: 20, width: 40, height: 20 });
  assert.equal(measured.rotation, 45);
  const diagonalHistory = createHistory(document(rectangle({ width: 40, height: 20, rotation: 45 })));
  const diagonal = success(measureElementAtRevision(diagonalHistory, diagonalHistory.presentRevisionId, "rectangle"));
  assert.ok(diagonal.absolute.width > 40);
  assert.ok(diagonal.absolute.height > 20);
  near(rotatePoint({ x: 1, y: 0 }, 90).y, 1);
});

test("全ノードの回転は保存時に正規化され、既定 0 は再帰的に省略される", () => {
  const original = document(frame({ rotation: 360, children: [rectangle({ rotation: -90 }), ellipse(), text({ rotation: 45 }), image()] }));
  const json = success(serializeDocument(original));
  const wire = JSON.parse(json).children[0];
  assert.equal(Object.hasOwn(wire, "rotation"), false);
  assert.equal(wire.children[0].rotation, 270);
  assert.equal(wire.children[2].rotation, 45);
  assert.equal(Object.hasOwn(wire.children[1], "rotation"), false);
  const parsed = success(parseDocument(json));
  assert.equal(parsed.children[0].rotation, 0);
  const parsedRoot = parsed.children[0];
  assert.equal(parsedRoot.type, "frame");
  if (parsedRoot.type !== "frame") return;
  assert.equal(parsedRoot.children[0].rotation, 270);
  assert.equal(parsedRoot.children[3].rotation, 0);
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...rectangle(), rotation: 0 }] }).replace('"rotation":0', '"rotation":1e999')).type, "Failure");
  assert.equal(serializeDocument(document(rectangle({ rotation: Infinity }))).type, "Failure");
  assert.equal(failure(setRotation(original, "rectangle", NaN)).message.includes("有限"), true);
});

test("回転コマンドと MCP は同じ履歴を更新し Undo / Redo に反映する", () => {
  let history = createHistory(document(rectangle()), true);
  const api = createAgentApi({ getDocument: () => history.present, getHistory: () => history, getSelectedId: () => null, apply: (next) => { history = commit(history, next); } });
  assert.equal(success(api.getElement("rectangle")).rotation, 0);
  assert.deepEqual(dispatchAgentRequest(api, "set_rotation", { id: "rectangle", rotation: -90 }).ok, true);
  assert.equal(success(api.getElement("rectangle")).rotation, 270);
  assert.equal(dispatchAgentRequest(api, "set_rotation", { id: "rectangle", rotation: Infinity }).ok, false);
  assert.equal(history.past.length, 1);
  assert.equal(success(api.getRevisionElement(history.presentRevisionId, "rectangle")).rotation, 270);
  history = undo(history);
  assert.equal(success(api.getElement("rectangle")).rotation, 0);
  history = redo(history);
  assert.equal(success(api.getElement("rectangle")).rotation, 270);
});

test("DOM スタイルは全ノード種別で中心回転し、未回転なら transform を持たない", () => {
  for (const [node, style] of [
    [frame({ rotation: 30 }), frameNodeStyle], [rectangle({ rotation: 30 }), shapeNodeStyle],
    [ellipse({ rotation: 30 }), shapeNodeStyle], [text({ rotation: 30 }), textNodeStyle], [image({ rotation: 30 }), imageNodeStyle],
  ] as const) {
    const computed = style(node);
    assert.equal(computed.transform, "rotate(30deg)");
    assert.equal(computed.transformOrigin, "center center");
    assert.equal(computed.width, node.width);
    assert.equal(computed.left, node.x);
  }
  assert.equal(shapeNodeStyle(rectangle()).transform, undefined);
});
