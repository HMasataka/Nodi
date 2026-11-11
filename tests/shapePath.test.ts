import assert from "node:assert/strict";
import { test } from "vitest";

import { corners } from "./support/factories.ts";
import { boxShape, ellipsePath, ellipseShape, pathToString, roundedRectPath } from "../src/document/shapePath.ts";

test("roundedRectPath は4隅を円弧でつなぐ", () => {
  assert.deepEqual(roundedRectPath(0, 0, 20, 10, corners(4)), [
    { kind: "move", x: 4, y: 0 },
    { kind: "line", x: 16, y: 0 },
    { kind: "arc", cx: 16, cy: 4, rx: 4, ry: 4, startAngle: -Math.PI / 2, endAngle: 0, counterclockwise: false },
    { kind: "line", x: 20, y: 6 },
    { kind: "arc", cx: 16, cy: 6, rx: 4, ry: 4, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: false },
    { kind: "line", x: 4, y: 10 },
    { kind: "arc", cx: 4, cy: 6, rx: 4, ry: 4, startAngle: Math.PI / 2, endAngle: Math.PI, counterclockwise: false },
    { kind: "line", x: 0, y: 4 },
    { kind: "arc", cx: 4, cy: 4, rx: 4, ry: 4, startAngle: Math.PI, endAngle: Math.PI + Math.PI / 2, counterclockwise: false },
    { kind: "close" },
  ]);
});

test("角丸0の矩形は円弧を出さない", () => {
  assert.deepEqual(roundedRectPath(0, 0, 20, 10, corners(0)).map((command) => command.kind),
    ["move", "line", "line", "line", "line", "close"]);
});

test("原点をずらした矩形も角の円弧の中心を追従する", () => {
  const path = roundedRectPath(2, 2, 18, 8, corners(3));
  assert.deepEqual(path[0], { kind: "move", x: 5, y: 2 });
  assert.deepEqual(path[2], { kind: "arc", cx: 17, cy: 5, rx: 3, ry: 3, startAngle: -Math.PI / 2, endAngle: 0, counterclockwise: false });
});

test("ellipsePath は2つの半円弧で楕円を描く", () => {
  assert.deepEqual(ellipsePath(10, 5, 10, 5), [
    { kind: "move", x: 20, y: 5 },
    { kind: "arc", cx: 10, cy: 5, rx: 10, ry: 5, startAngle: 0, endAngle: Math.PI, counterclockwise: false },
    { kind: "arc", cx: 10, cy: 5, rx: 10, ry: 5, startAngle: Math.PI, endAngle: Math.PI * 2, counterclockwise: false },
    { kind: "close" },
  ]);
});

test("boxShape は線なしなら stroke を返さない", () => {
  const shape = boxShape(20, 10, { fill: "#ffffff", stroke: null, cornerRadii: corners(0) });
  assert.equal(shape.fillColor, "#ffffff");
  assert.equal(shape.stroke, null);
});

test("boxShape の線は内側に寄り、線幅は寸法で抑える", () => {
  const shape = boxShape(20, 10, { fill: null, stroke: { color: "#000000", width: 2 }, cornerRadii: corners(4) });
  assert.equal(shape.strokeWidth, 2);
  assert.deepEqual(shape.stroke, roundedRectPath(1, 1, 18, 8, corners(3)));
  const oversized = boxShape(20, 10, { fill: null, stroke: { color: "#000000", width: 40 }, cornerRadii: corners(4) });
  assert.equal(oversized.strokeWidth, 10);
  assert.deepEqual(oversized.stroke, roundedRectPath(5, 5, 10, 0, corners(0)));
});

test("ellipseShape の線は縦横を内側へ縮める", () => {
  const shape = ellipseShape(20, 10, { fill: "#ffffff", stroke: { color: "#000000", width: 2 } });
  assert.deepEqual(shape.fill, ellipsePath(10, 5, 10, 5));
  assert.deepEqual(shape.stroke, ellipsePath(10, 5, 9, 4));
  assert.equal(shape.strokeWidth, 2);
});

test("pathToString は SVG の d 文字列を返す", () => {
  assert.equal(pathToString(roundedRectPath(0, 0, 20, 10, corners(0))), "M 0 0 L 20 0 L 20 10 L 0 10 L 0 0 Z");
  assert.equal(pathToString(ellipsePath(10, 5, 10, 5)), "M 20 5 A 10 5 0 0 1 0 5 A 10 5 0 0 1 20 5 Z");
});
