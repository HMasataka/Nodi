import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseDocument } from "../src/persistence/format.ts";
import { renderFramePng, wrapText } from "../src/export/framePng.ts";
import { savePng } from "../src/export/savePng.ts";

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
    ellipse: (...args) => calls.push(["ellipse", ...args]),
    fill: () => calls.push(["fill"]), stroke: () => calls.push(["stroke"]),
    fillRect: (...args) => calls.push(["fillRect", ...args, ctx.fillStyle]),
    measureText: (text) => ({ width: [...text].length * 8 }),
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
