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

const gradient = { type: "radial" as const, center: { x: 0.25, y: 0.75 }, radius: 0.4, stops: [
  { position: 0, color: "#ff000080" }, { position: 0.5, color: "#112233" }, { position: 1, color: "#0000ff" },
] };

test("放射状塗りの半径・中心・ストップを検証し、単色と線形塗りも維持する", () => {
  const original = document(frame({ children: [rectangle(), ellipse()] }));
  const updated = success(setNodeStyle(success(setFrameStyle(original, "frame", { fill: gradient })), "ellipse", { fill: gradient }));
  const json = success(serializeDocument(updated));
  assert.match(json, /"type": "radial"/);
  assert.deepEqual(success(parseDocument(json)), updated);
  assert.deepEqual(success(parseDocument(success(serializeDocument(original)))), original);
  const history = commit(createHistory(original), updated);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, updated);
  assert.equal(agentInputs.set_frame_style.safeParse({ id: "frame", fill: gradient }).success, true);
  for (const invalid of [
    { ...gradient, radius: 0 }, { ...gradient, radius: 1.1 }, { ...gradient, center: { x: -0.1, y: 0.5 } },
    { ...gradient, stops: gradient.stops.slice(0, 1) }, { ...gradient, stops: [...gradient.stops].reverse() },
    { ...gradient, stops: [{ position: 0, color: "#xyz" }, ...gradient.stops.slice(1)] },
  ]) {
    assert.equal(setNodeStyle(original, "rectangle", { fill: invalid as typeof gradient }).type, "Failure");
    assert.equal(parseDocument(JSON.stringify(document(rectangle({ style: { fill: invalid as typeof gradient } })))).type, "Failure");
  }
});

test("SVGとPNGは短辺基準の円形半径と同じ色ストップを使う", async () => {
  const node = frame({ width: 200, height: 100, rotation: 35, style: { fill: gradient }, children: [
    rectangle({ id: "mask", isMask: true }), ellipse({ id: "front", style: { fill: gradient } }),
  ] });
  const noOp = () => {};
  const markup = renderToStaticMarkup(<CanvasNode node={node} selectedId={null}
    interaction={{ onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp }} />);
  assert.match(markup, /<radialGradient[^>]*cx="50" cy="75" r="40" gradientUnits="userSpaceOnUse"/);
  assert.match(markup, /offset="0.5" stop-color="#112233"/);
  assert.match(markup, /stop-color="#ff000080"/);
  assert.match(markup, /canvas-mask-group/);
  const gradients: { points: number[]; stops: [number, string][] }[] = [];
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, ellipse() {}, closePath() {},
    fillStyle: "", strokeStyle: "", fill() {}, stroke() {},
    createRadialGradient(...points: number[]) {
      const record = { points, stops: [] as [number, string][] };
      gradients.push(record);
      return { addColorStop(position: number, color: string) { record.stops.push([position, color]); } };
    } };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(node, { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({}) as HTMLImageElement }));
  assert.deepEqual(gradients[0], { points: [50, 75, 0, 50, 75, 40], stops: [[0, "#ff000080"], [0.5, "#112233"], [1, "#0000ff"]] });
  assert.deepEqual(gradients[1].points, [25, 75, 0, 25, 75, 40]);
  assert.match(renderToStaticMarkup(<FillEditor fill={gradient} onChange={() => {}} />), />半径<\/label>/);
});
