import assert from "node:assert/strict";
import { test } from "vitest";

import { RENDER_COLORS } from "../src/rendering/colors.ts";
import { canvasSurfaceStyle, canvasWorldStyle, drawPreviewStyle, frameContentsStyle, frameNodeStyle,
  guideStyle, imageNodeStyle, selectionPreviewStyle, shapeNodeStyle, textLineStyle, textMarkStyle, textNodeStyle } from "../src/pages/editor/canvasStyles.ts";
import { corners, ellipse, frame, image, rectangle, text } from "./support/factories.ts";

const extent = { originX: 112, originY: 0, width: 1232, height: 932 };

test("キャンバスの面とワールドはズームと原点を反映する", () => {
  assert.deepEqual(canvasSurfaceStyle(extent, 2), {
    width: "max(100%, 2464px)", height: "max(100%, 1864px)", backgroundSize: "48px 48px",
  });
  assert.deepEqual(canvasWorldStyle(extent, 0.5), { transform: "translate(56px, 0px) scale(0.5)" });
});

test("選択範囲と描画プレビューは負の座標や逆方向の範囲でも正の矩形になる", () => {
  assert.deepEqual(selectionPreviewStyle({ start: { x: 120, y: 90 }, end: { x: 20, y: 140 } }), {
    left: 20, top: 90, width: 100, height: 50,
  });
  assert.deepEqual(drawPreviewStyle({ x: -20, y: 30, width: 40, height: 50 }, { x: 100, y: -10 }), {
    left: 80, top: 20, width: 40, height: 50,
  });
});

test("ガイドは向きに応じて位置と長さを入れ替える", () => {
  assert.deepEqual(guideStyle({ orientation: "vertical", position: 110, from: 20, to: 150 }),
    { left: 110, top: 20, height: 130 });
  assert.deepEqual(guideStyle({ orientation: "horizontal", position: 40, from: 10, to: 90 }),
    { top: 40, left: 10, width: 80 });
});

test("フレームとテキストは既定値とクリップ設定を反映する", () => {
  const frameNode = frame({ id: "frame", name: "画面", x: 10, y: 20, width: 300, height: 200, style: { fill: "#aabbcc" } });
  assert.deepEqual(frameNodeStyle(frameNode), { left: 10, top: 20, width: 300, height: 200, borderRadius: "0px 0px 0px 0px" });
  assert.deepEqual(frameContentsStyle(frameNode), { overflow: "hidden", borderRadius: "inherit" });
  assert.deepEqual(frameContentsStyle({ ...frameNode, clipContent: false }), { overflow: "visible", borderRadius: "inherit" });

  const textNode = text({ id: "text", name: "本文", width: 180, height: 60, content: "Hello", style: { fontSize: 20,
    color: "#1f2328", textAlign: "center" } });
  assert.deepEqual(textNodeStyle(textNode), {
    left: 0, top: 0, width: 180, height: 60, fontSize: 20, color: "#1f2328", textAlign: "center",
    lineHeight: 1.4, letterSpacing: "0px",
    fontFamily: '"Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif', fontWeight: 400,
  });
  assert.deepEqual(textNodeStyle({ ...textNode, style: { ...textNode.style, lineHeight: 1.8, letterSpacing: -0.5, fontFamily: "system", fontWeight: 700 } }), {
    left: 0, top: 0, width: 180, height: 60, fontSize: 20, color: "#1f2328", textAlign: "center",
    lineHeight: 1.8, letterSpacing: "-0.5px",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontWeight: 700,
  });
  assert.deepEqual(textLineStyle(textNode), { height: 28 });
});

test("部分装飾は色・太さ・下線・コード背景をスタイルへ変換する", () => {
  const textNode = text({ width: 180, height: 60, content: "Hello world", style: { color: "#1f2328" } });
  assert.deepEqual(textMarkStyle(textNode, { start: 6, end: 11, color: "#0969da", fontWeight: 700, underline: true }), {
    fontFamily: '"Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    fontWeight: 700, color: "#0969da", textDecorationLine: "underline",
    backgroundColor: undefined, borderRadius: undefined,
  });
  assert.deepEqual(textMarkStyle(textNode, { start: 0, end: 5, code: true }), {
    fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
    fontWeight: 400, color: "#1f2328", textDecorationLine: undefined,
    backgroundColor: RENDER_COLORS.codeBackground, borderRadius: 3,
  });
});

test("矩形と楕円は位置のみを持ち、見た目は共通パスへ委ねる", () => {
  const rectangleNode = rectangle({ id: "rect", name: "矩形", x: 1, y: 2, width: 30, height: 40,
    style: { fill: "#ffffff", stroke: { color: "#000000", width: 2 }, cornerRadii: corners(6) } });
  const ellipseNode = ellipse({ id: "ellipse", name: "楕円", x: 1, y: 2, width: 30, height: 40,
    style: { fill: "#ffffff", stroke: { color: "#000000", width: 2 } } });
  assert.deepEqual(shapeNodeStyle(rectangleNode), { left: 1, top: 2, width: 30, height: 40 });
  assert.deepEqual(shapeNodeStyle(ellipseNode), { left: 1, top: 2, width: 30, height: 40 });
  assert.deepEqual(imageNodeStyle(image({ x: 5, y: 6, width: 70, height: 80 })), { left: 5, top: 6, width: 70, height: 80, borderRadius: "0px 0px 0px 0px" });
});
