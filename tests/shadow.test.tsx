import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { agentInputs } from "../src/agent/contracts.ts";
import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { setShadow } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, ellipse, frame, image, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const shadow = { color: "#11223380", offsetX: 4, offsetY: -3, blur: 8 };

test("外側影を検証し、既存文書・Wire・Undo/Redo・MCPに反映する", () => {
  const original = document(frame({ children: [rectangle(), ellipse(), image(), text()] }));
  assert.doesNotMatch(success(serializeDocument(original)), /"shadow"/);
  assert.deepEqual(success(parseDocument(success(serializeDocument(original)))), original);
  let styled = original;
  for (const id of ["frame", "rectangle", "ellipse", "image", "text"]) styled = success(setShadow(styled, id, shadow));
  const json = success(serializeDocument(styled));
  assert.deepEqual(success(parseDocument(json)), styled);
  assert.deepEqual(undo(commit(createHistory(original), styled)).present, original);
  assert.deepEqual(redo(undo(commit(createHistory(original), styled))).present, styled);
  assert.equal(success(setShadow(styled, "rectangle", { ...shadow })) === styled, true);
  assert.equal(success(setShadow(styled, "rectangle", null)).children[0].type, "frame");
  for (const invalid of [{ ...shadow, color: "red" }, { ...shadow, blur: -1 }, { ...shadow, offsetX: Infinity }]) {
    assert.equal(setShadow(original, "frame", invalid).type, "Failure");
    assert.equal(parseDocument(JSON.stringify(document(frame({ shadow: invalid })))).type, "Failure");
  }
  assert.equal(agentInputs.set_shadow.safeParse({ id: "frame", shadow }).success, true);
  let current = original;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null,
    apply(next) { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_shadow", { id: "frame", shadow }).ok, true);
  assert.deepEqual(current.children[0].shadow, shadow);
  assert.equal(dispatchAgentRequest(api, "set_shadow", { id: "frame", shadow: null }).ok, true);
  assert.equal(current.children[0].shadow, null);
});

test("SVGとPNGは透過画像・文字・フレームのシルエットへ影を一度ずつ適用する", async () => {
  const rotated = rectangle({ id: "rotated", rotation: 90, shadow: { ...shadow, offsetX: 4, offsetY: 0 } });
  const nested = frame({ id: "nested", shadow, opacity: 0.5, style: { fill: "#ffffff80" }, children: [
    rectangle({ id: "mask", isMask: true, shadow }),
    rotated, image({ id: "transparent", shadow }), text({ id: "label", content: "Hi", shadow }),
  ] });
  const root = frame({ style: { fill: null }, children: [nested] });
  const noOp = () => {};
  const markup = renderToStaticMarkup(<CanvasNode node={nested} selectedId={null}
    interaction={{ onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp }} />);
  assert.match(markup, /filter:drop-shadow\(4px -3px 8px #11223380\)/);
  assert.match(markup, /opacity:0.5/);
  assert.match(markup, /canvas-mask-group/);
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
      beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, ellipse() {}, closePath() {},
      fill() { calls.push({ canvas: id, kind: "fill" }); }, stroke() {},
      fillText() { calls.push({ canvas: id, kind: "text" }); }, measureText: () => ({ width: 12, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 4 }),
      drawImage() { calls.push({ canvas: id, kind: "image", filter: this.filter, alpha: this.globalAlpha }); },
    };
    Object.assign(canvas, { getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) });
    return canvas;
  }
  success(await renderFramePng(root, { createCanvas, loadImage: async () => ({ naturalWidth: 10, naturalHeight: 10 }) as HTMLImageElement }));
  assert.ok(calls.some((call) => call.kind === "text"));
  assert.ok(calls.some((call) => call.kind === "image" && call.filter?.includes("drop-shadow(0px 4px 8px #11223380)")));
  assert.ok(calls.some((call) => call.kind === "image" && call.filter === `drop-shadow(4px -3px 8px ${shadow.color})` && call.alpha === 0.5));
  assert.equal(calls.filter((call) => call.filter?.startsWith("drop-shadow(")).length, 4);
});
