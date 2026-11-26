import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { agentInputs } from "../src/agent/contracts.ts";
import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { FillEditor } from "../src/pages/editor/components/molecules/FillEditor/FillEditor.tsx";
import { renderFramePng } from "../src/export/framePng.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, ellipse, frame, rectangle, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { setFrameStyle, setNodeStyle } from "../src/document/commands/index.ts";

const gradient = { type: "linear" as const, start: { x: 0.25, y: 0 }, end: { x: 0.75, y: 1 }, stops: [
  { position: 0, color: "#11223380" }, { position: 0.4, color: "#ff0000" }, { position: 1, color: "#445566ff" },
] };

test("線形塗りの位置・色と既存単色を検証して保存・Undo/Redoする", () => {
  const original = document(frame({ children: [rectangle({ style: { cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 } } }), ellipse()] }));
  const framed = success(setFrameStyle(original, "frame", { fill: gradient }));
  const shaped = success(setNodeStyle(framed, "rectangle", { fill: gradient, border: { top: { color: "#abcdef", width: 2 } } }));
  const result = success(setNodeStyle(shaped, "ellipse", { fill: gradient }));
  const json = success(serializeDocument(result));
  assert.match(json, /"type": "linear"/);
  assert.deepEqual(success(parseDocument(json)), result);
  assert.deepEqual(success(parseDocument(success(serializeDocument(original)))), original);
  const history = commit(createHistory(original), result);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, result);
  assert.equal(agentInputs.set_shape_style.safeParse({ id: "rectangle", fill: gradient }).success, true);
  for (const invalid of [
    { ...gradient, stops: gradient.stops.slice(0, 1) },
    { ...gradient, stops: [...gradient.stops].reverse() },
    { ...gradient, start: gradient.end },
    { ...gradient, end: { x: 1.2, y: 0 } },
    { ...gradient, stops: [{ position: 0, color: "#invalid" }, ...gradient.stops.slice(1)] },
  ]) {
    assert.equal(setNodeStyle(original, "rectangle", { fill: invalid as typeof gradient }).type, "Failure");
    assert.equal(parseDocument(JSON.stringify(document(rectangle({ style: { fill: invalid as typeof gradient } })))).type, "Failure");
  }
});

test("SVGとPNGは同じローカル方向と半透明のストップを用いる", async () => {
  const node = frame({ width: 200, height: 100, rotation: 30, style: { fill: gradient }, children: [
    rectangle({ id: "mask", isMask: true }), rectangle({ id: "front", style: { fill: gradient } }),
  ] });
  const noOp = () => {};
  const markup = renderToStaticMarkup(<CanvasNode node={node} selectedId={null}
    interaction={{ onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp }} />);
  assert.match(markup, /<linearGradient[^>]*x1="50" y1="0" x2="150" y2="100" gradientUnits="userSpaceOnUse"/);
  assert.match(markup, /offset="0.4" stop-color="#ff0000"/);
  assert.match(markup, /stop-color="#11223380"/);
  assert.match(markup, /canvas-mask-group/);
  const gradients: { points: number[]; stops: [number, string][] }[] = [];
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, ellipse() {}, closePath() {},
    fillStyle: "", strokeStyle: "", fill() {}, stroke() {},
    createLinearGradient(...points: number[]) {
      const record = { points, stops: [] as [number, string][] };
      gradients.push(record);
      return { addColorStop(position: number, color: string) { record.stops.push([position, color]); } };
    } };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(node, { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({}) as HTMLImageElement }));
  assert.deepEqual(gradients[0], { points: [50, 0, 150, 100], stops: [[0, "#11223380"], [0.4, "#ff0000"], [1, "#445566ff"]] });
  assert.deepEqual(gradients[1].points, [25, 0, 75, 50]);
  assert.match(renderToStaticMarkup(<FillEditor fill={gradient} onChange={() => {}} />), /帯をクリックすると色の位置を足します/);
});
