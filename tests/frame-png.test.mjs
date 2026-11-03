import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDocument } from "../src/persistence/format.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { savePng } from "../src/export/savePng.ts";
import { wrapText } from "../src/document/textLayout.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

function fakeCanvas() {
  const calls = [];
  const ctx = {
    save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
    translate: (...args) => calls.push(["translate", ...args]),
    beginPath: () => calls.push(["beginPath"]),
    rect: (...args) => calls.push(["rect", ...args]),
    clip: () => calls.push(["clip"]),
    roundRect: (...args) => calls.push(["roundRect", ...args]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    ellipse: (...args) => calls.push(["ellipse", ...args]),
    fill: () => calls.push(["fill", ctx.fillStyle]), stroke: () => calls.push(["stroke"]),
    fillRect: (...args) => calls.push(["fillRect", ...args, ctx.fillStyle]),
    letterSpacing: "0px",
    measureText: (text) => ({ width: [...text].length * (8 + Number.parseFloat(ctx.letterSpacing ?? "0px")) }),
    fillText: (...args) => calls.push(["fillText", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => ctx,
    toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
  };
  return { canvas, calls };
}

test("サンプルのフレームを寸法どおりに描き、編集 UI を含めない", async () => {
  const text = await readFile(new URL("../samples/studio.nodi", import.meta.url), "utf8");
  const frame = success(parseDocument(text)).children[0];
  const { canvas, calls } = fakeCanvas();
  const blob = success(await renderFramePng(frame, {
    createCanvas: () => canvas,
    loadImage: async () => ({ naturalWidth: 320, naturalHeight: 200 }),
  }));
  assert.equal(canvas.width, 960);
  assert.equal(canvas.height, 710);
  assert.equal(blob.type, "image/png");
  assert.deepEqual(calls.find(([method]) => method === "fillRect"), ["fillRect", 0, 0, 960, 710, "#fbfaf7"]);
  assert.deepEqual(calls.filter(([method]) => method === "fillRect").map((call) => call.at(-1)), ["#fbfaf7", "#ffffff", "#f6f3ec", "#f9f7f0"]);
  assert.ok(calls.some(([method]) => method === "roundRect"));
  assert.ok(calls.some(([method]) => method === "ellipse"));
  assert.ok(calls.some(([method]) => method === "drawImage"));
  const visibleText = calls.filter(([method]) => method === "fillText").map(([, value]) => value);
  assert.ok(visibleText.includes("ATLAS STUDIO"));
  assert.ok(!visibleText.includes("ナビゲーション"));
  assert.equal(calls.filter(([method]) => method === "save").length, calls.filter(([method]) => method === "restore").length);
});

test("重なった兄弟要素はレイヤー順に PNG へ描画する", async () => {
  const rectangle = (id, fill) => ({ id, name: id, type: "rectangle", x: 0, y: 0, width: 80, height: 80, fill, stroke: "#000000", strokeWidth: 0, cornerRadius: 0 });
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 100, height: 100, background: "#ffffff", clipContent: true, children: [rectangle("back", "#123456"), rectangle("front", "#abcdef")] };
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fill").map(([, color]) => color), ["#123456", "#abcdef"]);
});

test("図形の線を領域内へ収め、テキストを編集画面の行ボックスに揃える", async () => {
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 100, height: 100,
    background: "#ffffff", clipContent: true, children: [
      { id: "rectangle", name: "枠", type: "rectangle", x: 0, y: 0, width: 20, height: 10,
        fill: "#ffffff", stroke: "#000000", strokeWidth: 2, cornerRadius: 4 },
      { id: "ellipse", name: "丸", type: "ellipse", x: 0, y: 0, width: 20, height: 10,
        fill: "#ffffff", stroke: "#000000", strokeWidth: 2 },
      { id: "text", name: "番号", type: "text", x: 0, y: 0, width: 20, height: 26,
        content: "1", fontSize: 16, color: "#000000", textAlign: "center" },
    ] };
  const { canvas, calls } = fakeCanvas();
  const ctx = canvas.getContext("2d");
  ctx.measureText = (text) => ({ width: text.length * 8, fontBoundingBoxAscent: 16, fontBoundingBoxDescent: 6 });
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.find(([method]) => method === "roundRect"), ["roundRect", 1, 1, 18, 8, 3]);
  assert.deepEqual(calls.find(([method]) => method === "ellipse"), ["ellipse", 10, 5, 9, 4, 0, 0, Math.PI * 2]);
  assert.equal(ctx.textBaseline, "alphabetic");
  assert.deepEqual(calls.find(([method]) => method === "fillText"), ["fillText", "1", 10, 18.2]);
});

test("PNG のテキストは選択したフォントと太さを使い、旧形式は標準フォントへ戻す", async () => {
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 200, height: 100,
    background: "#ffffff", clipContent: true, children: [
      { id: "text", name: "見出し", type: "text", x: 0, y: 0, width: 180, height: 40,
        content: "Hello", fontSize: 24, color: "#000000", textAlign: "left", fontFamily: "system", fontWeight: 700 },
    ] };
  const selected = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => selected.canvas, loadImage: async () => {} }));
  assert.match(selected.canvas.getContext("2d").font, /^700 24px system-ui,/);
  const legacy = fakeCanvas();
  success(await renderFramePng({ ...frame, children: [{ ...frame.children[0], fontFamily: undefined, fontWeight: undefined }] },
    { createCanvas: () => legacy.canvas, loadImage: async () => {} }));
  assert.match(legacy.canvas.getContext("2d").font, /^400 24px "Avenir Next",/);
});

test("PNG は行高と対応ブラウザの字間を複数行に反映する", async () => {
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 200, height: 100,
    background: "#ffffff", clipContent: true, children: [
      { id: "text", name: "本文", type: "text", x: 0, y: 0, width: 180, height: 80,
        content: "AB\nCD", fontSize: 20, color: "#000000", textAlign: "left", lineHeight: 1.8, letterSpacing: 2 },
    ] };
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
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 100, height: 80,
    background: "#ffffff", clipContent: true, children: [
      { id: "text", name: "本文", type: "text", x: 0, y: 0, width: 20, height: 60,
        content: "AB", fontSize: 16, color: "#000000", textAlign: "left", letterSpacing: 2 },
    ] };
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, line]) => line), ["A", "B"]);
  assert.ok(calls.some(([method, , , width, height]) => method === "rect" && width === 20 && height === 60));
});

test("PNG の本文も単語境界と空行を同じ行構成で描く", async () => {
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 100, height: 120,
    background: "#ffffff", clipContent: true, children: [
      { id: "text", name: "本文", type: "text", x: 0, y: 0, width: 52, height: 100,
        content: "Hello world\n\nABCDEF", fontSize: 16, color: "#000000", textAlign: "left", lineHeight: 1.5 },
    ] };
  const { canvas, calls } = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, line]) => line), ["Hello", "world", "", "ABCDEF"]);
});

test("部分装飾の文字色・太さ・下線・コード背景を PNG に描く", async () => {
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 200, height: 80,
    background: "#ffffff", clipContent: true, children: [
      { id: "text", name: "本文", type: "text", x: 0, y: 0, width: 180, height: 45,
        content: "Hello world code", fontSize: 16, color: "#1f2328", textAlign: "left",
        marks: [{ start: 6, end: 11, color: "#0969da", fontWeight: 700, underline: true }, { start: 12, end: 16, code: true }] },
    ] };
  const { canvas, calls } = fakeCanvas();
  const ctx = canvas.getContext("2d");
  ctx.fillText = (text, x, y) => calls.push(["fillText", text, x, y, ctx.font, ctx.fillStyle]);
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  const textCalls = calls.filter(([method]) => method === "fillText");
  assert.deepEqual(textCalls.map(([, text]) => text), ["Hello ", "world", " ", "code"]);
  assert.match(textCalls[1][4], /^700 16px/);
  assert.equal(textCalls[1][5], "#0969da");
  assert.match(textCalls[3][4], /monospace$/);
  assert.ok(calls.some(([method, color]) => method === "fill" && color === "#f6f8fa"));
  assert.ok(calls.some(([method]) => method === "lineTo"));
});

test("字間に未対応の Canvas でも負の字間と中央揃えを描画する", async () => {
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 100, height: 50,
    background: "#ffffff", clipContent: true, children: [
      { id: "text", name: "見出し", type: "text", x: 0, y: 0, width: 100, height: 30,
        content: "AB", fontSize: 16, color: "#000000", textAlign: "center", letterSpacing: -1 },
    ] };
  const { canvas, calls } = fakeCanvas();
  delete canvas.getContext("2d").letterSpacing;
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, character, x]) => [character, x]), [["A", 43], ["B", 50]]);
});

test("字間の代替描画でも結合した絵文字を一文字として扱う", async () => {
  const frame = { id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 100, height: 50,
    background: "#ffffff", clipContent: true, children: [
      { id: "text", name: "絵文字", type: "text", x: 0, y: 0, width: 100, height: 30,
        content: "👩‍💻A", fontSize: 16, color: "#000000", textAlign: "center", letterSpacing: 1 },
    ] };
  const { canvas, calls } = fakeCanvas();
  delete canvas.getContext("2d").letterSpacing;
  success(await renderFramePng(frame, { createCanvas: () => canvas, loadImage: async () => {} }));
  assert.deepEqual(calls.filter(([method]) => method === "fillText").map(([, character]) => character), ["👩‍💻", "A"]);
});

test("入れ子フレームの背景を先に描き、クリップ設定ごとに子要素を切り替える", async () => {
  const child = { id: "child", name: "はみ出す矩形", type: "rectangle", x: 90, y: 80, width: 40, height: 40,
    fill: "#112233", stroke: "#445566", strokeWidth: 0, cornerRadius: 0 };
  const nested = { id: "nested", name: "内側", type: "frame", x: 10, y: 20, width: 100, height: 100,
    background: "#aabbcc", clipContent: true, children: [child] };
  const frame = { id: "root", name: "外側", type: "frame", x: 0, y: 0, width: 200, height: 200,
    background: "#123456", clipContent: true, children: [nested] };
  const clipped = fakeCanvas();
  success(await renderFramePng(frame, { createCanvas: () => clipped.canvas, loadImage: async () => {} }));
  assert.deepEqual(clipped.calls.filter(([method]) => method === "fillRect"), [
    ["fillRect", 0, 0, 200, 200, "#123456"],
    ["fillRect", 0, 0, 100, 100, "#aabbcc"],
  ]);
  assert.equal(clipped.calls.filter(([method]) => method === "clip").length, 2);
  assert.ok(clipped.calls.findIndex(([method, , , width]) => method === "rect" && width === 100) < clipped.calls.findIndex(([method]) => method === "roundRect"));

  const visible = fakeCanvas();
  success(await renderFramePng({ ...frame, children: [{ ...nested, clipContent: false }] }, {
    createCanvas: () => visible.canvas, loadImage: async () => {},
  }));
  assert.equal(visible.calls.filter(([method]) => method === "clip").length, 1);
  assert.equal(visible.calls.filter(([method]) => method === "fillRect")[1].at(-1), "#aabbcc");
});

test("本文は枠幅で折り返し、画像が読めなければ失敗を返す", async () => {
  assert.deepEqual(wrapText("ABC\nDEF", 16, (value) => value.length * 8), ["AB", "C", "DE", "F"]);
  const text = await readFile(new URL("../samples/studio.nodi", import.meta.url), "utf8");
  const frame = success(parseDocument(text)).children[0];
  const rendered = await renderFramePng(frame, {
    createCanvas: () => fakeCanvas().canvas,
    loadImage: async () => Promise.reject(new Error("画像なし")),
  });
  assert.equal(rendered.type, "Failure");
  assert.match(rendered.error.message, /画像なし/);
  assert.equal(frame.children.length > 0, true);
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
