import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { parseDocument } from "../src/persistence/format.ts";
import { RENDER_COLORS } from "../src/rendering/colors.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { savePng } from "../src/export/savePng.ts";
import { wrapText } from "../src/document/textLayout.ts";
import { corners, ellipse as makeEllipse, frame as makeFrame, image as makeImage, rectangle as makeRectangle, text as makeText, success } from "./support/factories.ts";

function fakeCanvas(calls = []) {
  const ctx = {
    save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
    translate: (...args) => calls.push(["translate", ...args]),
    rotate: (...args) => calls.push(["rotate", ...args]),
    beginPath: () => calls.push(["beginPath"]),
    rect: (...args) => calls.push(["rect", ...args]),
    clip: () => calls.push(["clip"]),
    roundRect: (...args) => calls.push(["roundRect", ...args]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    bezierCurveTo: (...args) => calls.push(["bezierCurveTo", ...args]),
    closePath: () => calls.push(["closePath"]),
    ellipse: (...args) => calls.push(["ellipse", ...args]),
    fill: () => calls.push(["fill", ctx.fillStyle]), stroke: () => calls.push(["stroke"]),
    fillRect: (...args) => calls.push(["fillRect", ...args, ctx.fillStyle]),
    letterSpacing: "0px",
    measureText: (text) => ({ width: [...text].length * (8 + Number.parseFloat(ctx.letterSpacing ?? "0px")) }),
    fillText: (...args) => calls.push(["fillText", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    // グラデーション・影・ぼかし・画像フィルターの描画に使う。呼び出しは記録しない。
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    setTransform: () => {}, scale: () => {},
    getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
    putImageData: () => {},
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => ctx,
    toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
  };
  ctx.canvas = canvas;
  return { canvas, calls };
}

test("PNG は入れ子フレームと子の中心回転を save/restore 内で合成する", async () => {
  const child = makeRectangle({ x: 10, y: 20, width: 40, height: 20, rotation: 45 });
  const nested = makeFrame({ id: "nested", x: 30, y: 40, width: 100, height: 80, rotation: 90, children: [child] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(makeFrame({ children: [nested] }), { createCanvas: () => canvas, loadImage: async () => {} }));
  const transforms = calls.filter(([method]) => ["save", "restore", "translate", "rotate"].includes(method));
  assert.deepEqual(transforms, [
    ["save"], ["translate", 0, 0],
    ["save"], ["translate", 30, 40], ["translate", 50, 40], ["rotate", Math.PI / 2], ["translate", -50, -40],
    ["save"], ["translate", 10, 20], ["translate", 20, 10], ["rotate", Math.PI / 4], ["translate", -20, -10],
    ["restore"], ["restore"], ["restore"],
  ]);
});

test("回転したフレームは画像の角丸とフィットを保ち、辺線を子の後に描く", async () => {
  const picture = { naturalWidth: 30, naturalHeight: 10 };
  const child = makeImage({ width: 15, height: 10, rotation: 45,
    style: { cornerRadii: corners(2), fit: "contain", focalPoint: { x: 0.25, y: 0.75 } } });
  const frame = makeFrame({ width: 15, height: 10, rotation: 90,
    style: { cornerRadii: corners(0), border: { top: { color: "#112233", width: 2 } } }, children: [child] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => picture }));
  assert.deepEqual(calls.filter(([method]) => method === "rotate"), [["rotate", Math.PI / 2], ["rotate", Math.PI / 4]]);
  const imageIndex = calls.findIndex(([method]) => method === "drawImage");
  assert.deepEqual(calls[imageIndex], ["drawImage", picture, 0, 0, 30, 10, 0, 3.75, 15, 5]);
  assert.equal(calls.slice(0, imageIndex).filter(([method]) => method === "clip").length, 3);
  assert.ok(calls.findIndex(([method, color], index) => index > imageIndex && method === "fill" && color === "#112233") > imageIndex);
});

test("サンプルのフレームを寸法どおりに描き、編集 UI を含めない", async () => {
  const text = await readFile(new URL("../samples/studio.nodi", import.meta.url), "utf8");
  const sample = success(parseDocument(text));
  const frame = sample.children[0];
  const { canvas, calls } = fakeCanvas();
  const canvases = [canvas];
  const blob = success(await renderFramePng(frame, {
    createCanvas: () => canvases.shift() ?? fakeCanvas(calls).canvas,
    loadImage: async () => ({ naturalWidth: 320, naturalHeight: 200 }),
  }, { components: sample.components, spacing: sample.spacing }, sample.palette));
  assert.equal(canvas.width, 1440);
  assert.equal(canvas.height, 3780);
  assert.equal(blob.type, "image/png");
  assert.deepEqual(calls.find(([method]) => method === "fill"), ["fill", "#0e0f13"]);
  assert.ok(calls.some(([method]) => method === "moveTo"));
  assert.ok(calls.some(([method]) => method === "ellipse"));
  assert.ok(calls.some(([method]) => method === "closePath"));
  assert.ok(calls.some(([method]) => method === "drawImage"));
  const visibleText = calls.filter(([method]) => method === "fillText").map(([, value]) => value);
  assert.ok(visibleText.includes("ATLAS STUDIO"));
  assert.ok(!visibleText.includes("ナビゲーション"));
  assert.equal(calls.filter(([method]) => method === "save").length, calls.filter(([method]) => method === "restore").length);
});

test("重なった兄弟要素はレイヤー順に PNG へ描画する", async () => {
  const box = (id, fill) => makeRectangle({ id, name: id, width: 80, height: 80, style: { fill, stroke: null, cornerRadii: corners(0) } });
  const frame = makeFrame({ width: 100, height: 100, children: [box("back", "#123456"), box("front", "#abcdef")] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fill").map(([, color]) => color), ["#ffffff", "#123456", "#abcdef"]);
});

test("図形の線を領域内へ収め、テキストを編集画面の行ボックスに揃える", async () => {
  const frame = makeFrame({ width: 100, height: 100, children: [
    makeRectangle({ id: "rectangle", name: "枠", width: 20, height: 10, style: { fill: "#ffffff", stroke: { color: "#000000", width: 2 }, cornerRadii: corners(4) } }),
    makeEllipse({ id: "ellipse", name: "丸", width: 20, height: 10, style: { fill: "#ffffff", stroke: { color: "#000000", width: 2 } } }),
    makeText({ id: "text", name: "番号", width: 20, height: 26, content: "1", style: { color: "#000000", textAlign: "center" } }),
  ] });
  const { canvas, calls } = fakeCanvas();
  const ctx = canvas.getContext("2d");
  ctx.measureText = (text) => ({ width: text.length * 8, fontBoundingBoxAscent: 16, fontBoundingBoxDescent: 6 });
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  const ellipseCalls = calls.filter(([method]) => method === "ellipse");
  assert.ok(ellipseCalls.some(([, , , rx, ry]) => rx === 10 && ry === 5), "楕円の塗りは全幅・全高");
  assert.ok(ellipseCalls.some(([, , , rx, ry]) => rx === 9 && ry === 4), "楕円の内側線は線幅分だけ縮む");
  assert.equal(ctx.lineWidth, 2);
  assert.equal(ctx.textBaseline, "alphabetic");
  assert.deepEqual(calls.find(([method]) => method === "fillText"), ["fillText", "1", 10, 18.2]);
});

test("PNG のテキストは選択したフォントと太さ、標準フォントを描画する", async () => {
  const frame = makeFrame({ width: 200, height: 100, children: [
    makeText({ id: "text", name: "見出し", width: 180, height: 40, content: "Hello", style: { fontSize: 24,
      color: "#000000", fontFamily: "system", fontWeight: 700 } }),
  ] });
  const selected = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => selected.canvas, loadImage: async () => {} }));
  assert.match(selected.canvas.getContext("2d").font, /^700 24px system-ui,/);
  const legacy = fakeCanvas();
  success(await renderFramePng({ ...frame, children: [{ ...frame.children[0], style: { ...frame.children[0].style, fontFamily: "default", fontWeight: 400 } }] },
    { createCanvas: () => legacy.canvas, loadImage: async () => {} }));
  assert.match(legacy.canvas.getContext("2d").font, /^400 24px "Avenir Next",/);
});

test("PNG は行高と対応ブラウザの字間を複数行に反映する", async () => {
  const frame = makeFrame({ width: 200, height: 100, children: [
    makeText({ id: "text", name: "本文", width: 180, height: 80, content: "AB\nCD", style: { fontSize: 20,
      color: "#000000", lineHeight: 1.8, letterSpacing: 2 } }),
  ] });
  const { canvas, calls } = fakeCanvas();
  const ctx = canvas.getContext("2d");
  ctx.letterSpacing = "0px";
  ctx.measureText = (text) => ({ width: text.length * (8 + Number.parseFloat(ctx.letterSpacing)), fontBoundingBoxAscent: 20, fontBoundingBoxDescent: 7 });
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.equal(ctx.letterSpacing, "2px");
  assert.deepEqual(calls.filter(([method]) => method === "fillText"), [
    ["fillText", "AB", 2, 26.5], ["fillText", "CD", 2, 62.5],
  ]);
});

test("字間が増えると PNG の折り返し幅にも反映される", async () => {
  const frame = makeFrame({ width: 100, height: 80, children: [
    makeText({ id: "text", name: "本文", width: 20, height: 60, content: "AB", style: { color: "#000000", letterSpacing: 2 } }),
  ] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, line]) => line), ["A", "B"]);
  assert.ok(calls.some(([method, , , width, height]) => method === "rect" && width === 20 && height === 60));
});

test("PNG の本文も単語境界と空行を同じ行構成で描く", async () => {
  const frame = makeFrame({ width: 100, height: 120, children: [
    makeText({ id: "text", name: "本文", width: 52, height: 100, content: "Hello world\n\nABCDEF", style: { lineHeight: 1.5 } }),
  ] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, line]) => line), ["Hello", "world", "", "ABCDEF"]);
});

test("部分装飾の文字色・太さ・下線・コード背景を PNG に描く", async () => {
  const frame = makeFrame({ width: 200, height: 80, children: [
    makeText({ id: "text", name: "本文", width: 180, height: 45, content: "Hello world code", style: { color: "#1f2328" },
      marks: [{ start: 6, end: 11, color: "#0969da", fontWeight: 700, underline: true }, { start: 12, end: 16, code: true }] }),
  ] });
  const { canvas, calls } = fakeCanvas();
  const ctx = canvas.getContext("2d");
  ctx.fillText = (text, x, y) => calls.push(["fillText", text, x, y, ctx.font, ctx.fillStyle]);
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  const textCalls = calls.filter(([method]) => method === "fillText");
  assert.deepEqual(textCalls.map(([, text]) => text), ["Hello ", "world", " ", "code"]);
  assert.match(textCalls[1][4], /^700 16px/);
  assert.equal(textCalls[1][5], "#0969da");
  assert.match(textCalls[3][4], /monospace$/);
  assert.ok(calls.some(([method, color]) => method === "fill" && color === RENDER_COLORS.codeBackground));
  assert.ok(calls.some(([method]) => method === "lineTo"));
});

test("字間に未対応の Canvas でも負の字間と中央揃えを描画する", async () => {
  const frame = makeFrame({ width: 100, height: 50, children: [
    makeText({ id: "text", name: "見出し", width: 100, height: 30, content: "AB", style: { color: "#000000",
      textAlign: "center", letterSpacing: -1 } }),
  ] });
  const { canvas, calls } = fakeCanvas();
  delete canvas.getContext("2d").letterSpacing;
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, character, x]) => [character, x]), [["A", 43], ["B", 50]]);
});

test("字間の代替描画でも結合した絵文字を一文字として扱う", async () => {
  const frame = makeFrame({ width: 100, height: 50, children: [
    makeText({ id: "text", name: "絵文字", width: 100, height: 30, content: "👩‍💻A", style: { color: "#000000",
      textAlign: "center", letterSpacing: 1 } }),
  ] });
  const { canvas, calls } = fakeCanvas();
  delete canvas.getContext("2d").letterSpacing;
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, character]) => character), ["👩‍💻", "A"]);
});

test("入れ子フレームの背景を先に描き、クリップ設定ごとに子要素を切り替える", async () => {
  const child = makeRectangle({ id: "child", name: "はみ出す矩形", x: 90, y: 80, width: 40, height: 40,
    style: { fill: "#112233", stroke: null, cornerRadii: corners(0) } });
  const nested = makeFrame({ id: "nested", name: "内側", x: 10, y: 20, width: 100, height: 100,
    style: { fill: "#aabbcc" }, children: [child] });
  const frame = makeFrame({ id: "root", name: "外側", width: 200, height: 200,
    style: { fill: "#123456" }, children: [nested] });
  const clipped = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => clipped.canvas, loadImage: async () => {} }));
  assert.deepEqual(clipped.calls.filter(([method]) => method === "fill"), [
    ["fill", "#123456"], ["fill", "#aabbcc"], ["fill", "#112233"],
  ]);
  assert.equal(clipped.calls.filter(([method]) => method === "clip").length, 3);
  assert.ok(clipped.calls.findIndex(([method, color]) => method === "fill" && color === "#aabbcc") < clipped.calls.findIndex(([method, color]) => method === "fill" && color === "#112233"));

  const visible = fakeCanvas();
  success(await renderFramePng({ ...frame, children: [{ ...nested, clipContent: false }] }, {
    createCanvas: () => visible.canvas, loadImage: async () => {},
  }));
  assert.equal(visible.calls.filter(([method]) => method === "clip").length, 2);
  assert.equal(visible.calls.filter(([method]) => method === "fill")[1].at(-1), "#aabbcc");
});

test("本文は枠幅で折り返し、画像が読めなければ失敗を返す", async () => {
  assert.deepEqual(wrapText("ABC\nDEF", 16, (value) => value.length * 8), ["AB", "C", "DE", "F"]);
  const text = await readFile(new URL("../samples/studio.nodi", import.meta.url), "utf8");
  const sample = success(parseDocument(text));
  const frame = sample.children[0];
  const rendered = await renderFramePng(frame, {
    createCanvas: () => fakeCanvas().canvas,
    loadImage: async () => Promise.reject(new Error("画像なし")),
  }, { components: sample.components, spacing: sample.spacing }, sample.palette);
  assert.equal(rendered.type, "Failure");
  assert.match(rendered.error.message, /画像なし/);
  assert.equal(frame.children.length > 0, true);
});

test("塗りなし・線なしのフレームと図形は PNG に色を描かない", async () => {
  const frame = makeFrame({ style: { fill: null, stroke: null }, children: [
    makeRectangle({ style: { fill: null, stroke: null } }),
    makeEllipse({ style: { fill: null, stroke: null } }),
  ] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => ["fill", "fillRect", "stroke"].includes(method)), []);
});

test("フレームの線と4隅は PNG に反映し、子要素の原点をずらさない", async () => {
  const frame = makeFrame({ x: 80, y: 90, width: 100, height: 80, style: {
    fill: null, stroke: { color: "#123456", width: 4 },
    cornerRadii: { topLeft: 4, topRight: 6, bottomRight: 8, bottomLeft: 10 },
  }, children: [makeRectangle({ x: 10, y: 20, style: { fill: null, stroke: null } })] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "translate"), [["translate", 0, 0], ["translate", 10, 20]]);
  assert.ok(calls.some(([method, x, y]) => method === "moveTo" && x === 4 && y === 2), "内側線は線幅の半分だけ内側へ寄る");
  assert.equal(canvas.getContext("2d").strokeStyle, "#123456");
  assert.equal(calls.filter(([method]) => method === "stroke").length, 1);
});

test("フレームの子と画像を正規化した4隅のパスでクリップする", async () => {
  const radii = { topLeft: 20, topRight: 10, bottomRight: 5, bottomLeft: 0 };
  const child = makeImage({ width: 15, height: 10, style: { cornerRadii: radii, fit: "contain", focalPoint: { x: 0.25, y: 0.75 } } });
  const frame = makeFrame({ width: 15, height: 10, style: { cornerRadii: radii, stroke: null }, children: [child] });
  const { canvas, calls } = fakeCanvas();
  const picture = { naturalWidth: 30, naturalHeight: 10 };
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => picture }));
  const arcs = calls.filter(([method]) => method === "ellipse");
  assert.deepEqual(arcs.map(([, , , rx]) => rx), [5, 2.5, 10, 5, 2.5, 10, 5, 2.5, 10]);
  assert.equal(calls.filter(([method]) => method === "clip").length, 3);
  assert.deepEqual(calls.find(([method]) => method === "drawImage"), ["drawImage", picture, 0, 0, 30, 10, 0, 3.75, 15, 5]);
  assert.ok(calls.findIndex(([method]) => method === "drawImage") > calls.findLastIndex(([method]) => method === "clip"));
  assert.equal(calls.filter(([method]) => method === "save").length, calls.filter(([method]) => method === "restore").length);
});

test("PNG は自動レイアウトを解決してから描画する", async () => {
  const frame = makeFrame({ layoutMode: "horizontal", padding: 0, gap: 0, width: 100, height: 50, children: [
    makeRectangle({ id: "fixed", width: 20, height: 10 }),
    makeRectangle({ id: "fill", widthConstraint: { mode: "fill" }, height: 10 }),
  ] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "translate"), [["translate", 0, 0], ["translate", 0, 0], ["translate", 20, 0]]);
});

test("PNG は指定時刻のアニメーションを適用して描画する", async () => {
  const child = makeRectangle({ id: "r", x: 0, y: 0, width: 10, height: 10, animations: [
    { id: "a1", name: "移動", trigger: "load", duration: 1000, delay: 0, repeat: 1,
      tracks: [{ property: "x", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 100, easing: "linear" }] }] },
  ] });
  const frame = makeFrame({ width: 100, height: 50, children: [child] });
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }, { timeMs: 500 }));
  assert.deepEqual(calls.filter(([method]) => method === "translate"), [["translate", 0, 0], ["translate", 50, 0]]);
});

test("PNG の保存・キャンセル・書き込み失敗を区別する", async () => {
  const blob = new Blob(["png"], { type: "image/png" });
  const writes = [];
  const access = { pickSave: async (name) => { assert.equal(name, "画面.png"); return "/tmp/画面.png"; }, write: async (path, bytes) => { writes.push({ path, bytes: [...bytes] }); } };
  assert.equal(success(await savePng(access, blob, "画面.png")), "/tmp/画面.png");
  assert.deepEqual(writes, [{ path: "/tmp/画面.png", bytes: [112, 110, 103] }]);
  assert.equal(success(await savePng({ ...access, pickSave: async () => null }, blob, "画面.png")), null);
  assert.equal(writes.length, 1);
  const failed = await savePng({ ...access, write: async () => Promise.reject(new Error("ディスクエラー")) }, blob, "画面.png");
  assert.equal(failed.type, "Failure");
  assert.match(failed.error.message, /ディスクエラー/);
});
