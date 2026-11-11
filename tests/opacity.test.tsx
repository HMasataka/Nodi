import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { agentInputs } from "../src/agent/contracts.ts";
import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { setOpacity } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, ellipse, frame, image, rectangle, success, text } from "./support/factories.ts";
import { frameNodeStyle, shapeNodeStyle } from "../src/pages/editor/canvasStyles.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("既存文書を不透明度1で読み、0〜1を検証して保存・Undo/Redoする", () => {
  const original = document(frame({ children: [rectangle(), ellipse(), text(), image()] }));
  const json = success(serializeDocument(original));
  assert.doesNotMatch(json, /"opacity"/);
  assert.deepEqual(success(parseDocument(json)), original);
  let updated = original;
  for (const [id, opacity] of [["frame", 0], ["rectangle", 0.3], ["ellipse", 0.6], ["text", 0.8], ["image", 0.5]] as const) {
    updated = success(setOpacity(updated, id, opacity));
  }
  const saved = success(serializeDocument(updated));
  assert.match(saved, /"opacity": 0/);
  assert.deepEqual(success(parseDocument(saved)), updated);
  const history = commit(createHistory(original), updated);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, updated);
  assert.equal(setOpacity(updated, "frame", 0.2).type, "Success");
  assert.equal(success(setOpacity(updated, "frame", 0)) === updated, true);
  for (const value of [-0.01, 1.01, NaN, Infinity]) assert.equal(setOpacity(updated, "frame", value).type, "Failure");
  assert.equal(parseDocument(json.replace('"type": "frame",', '"type": "frame", "opacity": 1.5,')).type, "Failure");
  assert.equal(agentInputs.set_opacity.safeParse({ id: "frame", opacity: -1 }).success, false);
  assert.equal(agentInputs.set_opacity.safeParse({ id: "frame", opacity: 0.5 }).success, true);
  let current = original;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current),
    getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_opacity", { id: "frame", opacity: 0.4 }).ok, true);
  assert.equal(current.children[0].opacity, 0.4);
  assert.equal(dispatchAgentRequest(api, "set_opacity", { id: "frame", opacity: 2 }).ok, false);
  assert.equal(shapeNodeStyle(rectangle({ opacity: 0.5 })).opacity, 0.5);
  assert.equal(frameNodeStyle(frame({ opacity: 0 })).opacity, 0);
  assert.match(renderToStaticMarkup(<div style={frameNodeStyle(frame({ opacity: 0.5 }))} />), /opacity:0.5/);
});

test("PNGは重なった子とフレーム背景を先に描き、グループに一度だけ不透明度を掛ける", async () => {
  const calls: { canvas: number; operation: string; color?: string; alpha?: number; source?: number }[] = [];
  let nextId = 0;
  function createCanvas(): HTMLCanvasElement {
    const id = ++nextId;
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    const stack: number[] = [];
    const ctx = {
      canvas, globalAlpha: 1, fillStyle: "", strokeStyle: "",
      save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop()!; },
      translate() {}, rotate() {}, setTransform() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      beginPath() {}, rect() {}, clip() { calls.push({ canvas: id, operation: "clip" }); },
      moveTo() {}, lineTo() {}, ellipse() {}, closePath() {},
      fill() { calls.push({ canvas: id, operation: "fill", color: this.fillStyle }); },
      stroke() { calls.push({ canvas: id, operation: "stroke", color: this.strokeStyle }); },
      drawImage(source: HTMLCanvasElement) { calls.push({ canvas: id, operation: "composite", source: (source as HTMLCanvasElement & { id: number }).id, alpha: this.globalAlpha }); },
    };
    Object.assign(canvas, { id, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) });
    return canvas;
  }
  const content = frame({ id: "content", opacity: 0.5, rotation: 30, style: { fill: "#ff0000" }, children: [
    rectangle({ id: "mask", isMask: true, opacity: 0, style: { fill: "#000000" } }),
    rectangle({ id: "front", opacity: 0.25, style: { fill: "#0000ff80" } }),
    rectangle({ id: "back", style: { fill: "#00ff00" } }),
  ] });
  const root = frame({ style: { fill: "#ffffff" }, children: [content] });
  success(await renderFramePng(root, { createCanvas, loadImage: async () => ({}) as HTMLImageElement }));
  const composite = calls.filter((call) => call.operation === "composite");
  assert.deepEqual(composite, [
    { canvas: 2, operation: "composite", source: 3, alpha: 0.25 },
    { canvas: 1, operation: "composite", source: 2, alpha: 0.5 },
  ]);
  assert.ok(calls.findIndex((call) => call.canvas === 1 && call.color === "#ffffff") < calls.findIndex((call) => call.operation === "composite"));
  assert.ok(calls.some((call) => call.canvas === 2 && call.color === "#ff0000"));
  assert.ok(calls.some((call) => call.canvas === 3 && call.color === "#0000ff80"));
  assert.ok(calls.some((call) => call.canvas === 2 && call.color === "#00ff00"));
  assert.ok(!calls.some((call) => call.color === "#000000"));
  assert.ok(calls.some((call) => call.canvas === 2 && call.operation === "clip"));
});
