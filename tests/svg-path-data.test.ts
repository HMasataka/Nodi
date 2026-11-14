import assert from "node:assert/strict";
import { test } from "vitest";

import { parseSvgPathData } from "../src/document/svgPathData.ts";
import { success } from "./support/factories.ts";

const unitBox = { x: 0, y: 0, width: 1, height: 1 };

test("相対命令の制御点はすべて命令開始点から解決し、Sは直前の3次制御点を反転する", () => {
  assert.deepEqual(success(parseSvgPathData("M10 20 c1 2 3 4 5 6 s2 3 4 5", unitBox)), [
    { kind: "move", x: 10, y: 20 },
    { kind: "cubic", x1: 11, y1: 22, x2: 13, y2: 24, x: 15, y: 26 },
    { kind: "cubic", x1: 17, y1: 28, x2: 17, y2: 29, x: 19, y: 31 },
  ]);
  assert.deepEqual(success(parseSvgPathData("M0 0 Q3 6 6 0 T12 0", unitBox)), [
    { kind: "move", x: 0, y: 0 },
    { kind: "cubic", x1: 2, y1: 4, x2: 4, y2: 4, x: 6, y: 0 },
    { kind: "cubic", x1: 8, y1: -4, x2: 10, y2: -4, x: 12, y: 0 },
  ]);
});

test("線・move・closeや異なる種類の曲線を越えて制御点を引き継がない", () => {
  const afterLine = success(parseSvgPathData("M0 0 C1 1 2 2 3 3 L4 4 S5 5 6 6", unitBox));
  assert.deepEqual(afterLine[3], { kind: "cubic", x1: 4, y1: 4, x2: 5, y2: 5, x: 6, y: 6 });
  const afterMove = success(parseSvgPathData("M0 0 Q3 6 6 0 M10 10 T16 10", unitBox));
  assert.deepEqual(afterMove[3], { kind: "cubic", x1: 10, y1: 10, x2: 12, y2: 10, x: 16, y: 10 });
  const afterClose = success(parseSvgPathData("M0 0 C1 1 2 2 3 3 L4 0 Z M10 10 S12 12 14 14", unitBox));
  assert.deepEqual(afterClose[5], { kind: "cubic", x1: 10, y1: 10, x2: 12, y2: 12, x: 14, y: 14 });
  const quadraticToCubic = success(parseSvgPathData("M0 0 Q3 6 6 0 S9 9 12 0", unitBox));
  assert.deepEqual(quadraticToCubic[2], { kind: "cubic", x1: 6, y1: 0, x2: 9, y2: 9, x: 12, y: 0 });
  const cubicToQuadratic = success(parseSvgPathData("M0 0 C1 1 2 2 3 3 T9 3", unitBox));
  assert.deepEqual(cubicToQuadratic[2], { kind: "cubic", x1: 3, y1: 3, x2: 5, y2: 3, x: 9, y: 3 });
});

test("省略記法・指数・区切りなしの符号を解釈し、閉路後の相対moveは始点を基準にする", () => {
  assert.deepEqual(success(parseSvgPathData("m10 20 10 0 0 10z m5 5h2v3", { x: 10, y: 20, width: 10, height: 10 })), [
    { kind: "move", x: 0, y: 0 }, { kind: "line", x: 1, y: 0 }, { kind: "line", x: 1, y: 1 }, { kind: "close" },
    { kind: "move", x: 0.5, y: 0.5 }, { kind: "line", x: 0.7, y: 0.5 }, { kind: "line", x: 0.7, y: 0.8 },
  ]);
  assert.deepEqual(success(parseSvgPathData("M1e1-2e1 L.5-.5", unitBox)), [
    { kind: "move", x: 10, y: -20 }, { kind: "line", x: 0.5, y: -0.5 },
  ]);
});

test("失敗時のエラー区分と命令上限を維持し、解析状態を次の呼び出しへ持ち越さない", () => {
  const invalid = [
    ["M0 0 A1 1 0 0 0 1 1", "未対応のSVGパス命令です: A"],
    ["M0 0 L", "SVGパスのL命令に座標がありません"],
    ["M0 0 L1", "SVGパスの座標が不足しています"],
    ["M0 0 C1 2", "SVGパスの曲線座標が不足しています"],
    ["M0 0 L1e999 0", "SVGパスの座標は有限値で指定してください"],
  ];
  for (const [source, message] of invalid) {
    const result = parseSvgPathData(source, unitBox);
    assert.equal(result.type, "Failure");
    if (result.type !== "Failure") assert.fail("失敗を期待しました");
    assert.equal(result.error.message, message);
    assert.deepEqual(success(parseSvgPathData("M0 0 L1 1", unitBox)), [{ kind: "move", x: 0, y: 0 }, { kind: "line", x: 1, y: 1 }]);
  }
  assert.equal(success(parseSvgPathData(`M0 0 ${"L1 1 ".repeat(2047)}`, unitBox)).length, 2048);
  assert.equal(parseSvgPathData(`M0 0 ${"L1 1 ".repeat(2048)}`, unitBox).type, "Failure");
});
