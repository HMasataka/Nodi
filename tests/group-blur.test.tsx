import assert from "node:assert/strict";
import { test } from "vitest";

import { agentInputs } from "../src/agent/contracts.ts";
import { blurPixels } from "../src/document/blur.ts";
import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { frameNodeStyle } from "../src/pages/editor/canvasStyles.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { setBlur } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, ellipse, frame, image, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("全体ぼかしは既定0を省略し、全種別で保存・Undo/Redo・MCP経由の編集を行える", () => {
  const original = document(frame({ children: [rectangle(), ellipse(), image(), text()] }));
  assert.doesNotMatch(success(serializeDocument(original)), /"blur"/);
  assert.deepEqual(success(parseDocument(success(serializeDocument(original)))), original);
  let updated = original;
  for (const id of ["frame", "rectangle", "ellipse", "image", "text"]) updated = success(setBlur(updated, id, 2.5));
  const json = success(serializeDocument(updated));
  assert.deepEqual(success(parseDocument(json)), updated);
  const history = commit(createHistory(original), updated);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, updated);
  assert.equal(success(setBlur(updated, "frame", 2.5)) === updated, true);
  for (const invalid of [-1, NaN, Infinity]) {
    assert.equal(setBlur(original, "frame", invalid).type, "Failure");
    assert.equal(parseDocument(JSON.stringify(document(frame({ blur: invalid })))).type, "Failure");
  }
  assert.equal(agentInputs.set_blur.safeParse({ id: "frame", blur: -1 }).success, false);
  let current = original;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null,
    apply(next) { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_blur", { id: "frame", blur: 3 }).ok, true);
  assert.equal(current.children[0].blur, 3);
  assert.equal(frameNodeStyle(frame({ blur: 2, shadow: { color: "#00000080", offsetX: 1, offsetY: 2, blur: 4 } })).filter,
    "blur(2px) drop-shadow(1px 2px 4px #00000080)");
});

test("ガウスぼかしは乗算済みアルファで透明な縁を処理する", () => {
  const input = new Uint8ClampedArray(3 * 3 * 4);
  input.set([0, 0, 255, 0], 0); // 透明ピクセルに残る青はにじませない。
  input.set([255, 0, 0, 255], (1 * 3 + 1) * 4);
  const output = blurPixels(input, 3, 3, 1);
  assert.ok(output[(1 * 3 + 1) * 4 + 3] < 255);
  assert.ok(output[3] > 0);
  for (let index = 0; index < output.length; index += 4) {
    assert.equal(output[index], 255);
    assert.equal(output[index + 1], 0);
    assert.equal(output[index + 2], 0);
  }
  assert.deepEqual(blurPixels(input, 3, 3, 0), input);
});

test("PNGはフレームと子を先にぼかし、続いて影・親クリップ・不透明度を適用する", async () => {
  const calls: { canvas: number; kind: string; filter?: string; alpha?: number }[] = [];
  let nextId = 0;
  function createCanvas(): HTMLCanvasElement {
    const id = ++nextId;
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    const stack: { alpha: number; filter: string }[] = [];
    const ctx = {
      canvas, globalAlpha: 1, filter: "none", fillStyle: "", strokeStyle: "",
      save() { stack.push({ alpha: this.globalAlpha, filter: this.filter }); },
      restore() { const previous = stack.pop()!; this.globalAlpha = previous.alpha; this.filter = previous.filter; },
      translate() {}, rotate() {}, setTransform() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      beginPath() {}, rect() {}, clip() { calls.push({ canvas: id, kind: "clip" }); },
      moveTo() {}, lineTo() {}, ellipse() {}, closePath() {}, fill() { calls.push({ canvas: id, kind: "fill" }); }, stroke() {},
      fillText() { calls.push({ canvas: id, kind: "text" }); }, measureText: () => ({ width: 6, fontBoundingBoxAscent: 6, fontBoundingBoxDescent: 2 }),
      drawImage() { calls.push({ canvas: id, kind: "composite", filter: this.filter, alpha: this.globalAlpha }); },
      getImageData(_x: number, _y: number, width: number, height: number) {
        const data = new Uint8ClampedArray(width * height * 4);
        data.set([255, 0, 0, 255], (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4);
        return { data };
      },
      putImageData(data: { data: Uint8ClampedArray }) {
        calls.push({ canvas: id, kind: data.data.some((value) => value > 0 && value < 255) ? "blurred" : "unblurred" });
      },
    };
    Object.assign(canvas, { getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) });
    return canvas;
  }
  const nested = frame({ id: "nested", width: 12, height: 12, blur: 1, opacity: 0.5,
    shadow: { color: "#11223380", offsetX: 2, offsetY: 1, blur: 3 }, children: [
      rectangle({ id: "mask", isMask: true, blur: 9 }), text({ id: "label", content: "Hi", width: 8, height: 8 }),
      image({ id: "picture", width: 6, height: 6 }),
    ] });
  const root = frame({ width: 20, height: 20, style: { fill: null }, children: [nested] });
  success(await renderFramePng(root, { createCanvas, loadImage: async () => ({ naturalWidth: 6, naturalHeight: 6 }) as HTMLImageElement }));
  assert.ok(calls.some((call) => call.canvas === 2 && call.kind === "text"));
  assert.ok(calls.some((call) => call.canvas === 2 && call.kind === "blurred"));
  assert.ok(calls.findIndex((call) => call.kind === "blurred") < calls.findIndex((call) => call.canvas === 1 && call.kind === "composite"));
  assert.ok(calls.some((call) => call.canvas === 1 && call.kind === "composite" && call.alpha === 0.5 && call.filter === "drop-shadow(2px 1px 3px #11223380)"));
  assert.ok(!calls.some((call) => call.filter?.includes("blur(1px)")));
});
