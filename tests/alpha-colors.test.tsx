import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { ColorField } from "../src/pages/editor/components/molecules/ColorField/ColorField.tsx";
import { HEX_COLOR_PATTERN } from "../src/document/types.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { textMarkStyle } from "../src/pages/editor/canvasStyles.ts";
import { alphaByte, rgbColor, withAlphaByte, withRgbColor } from "../src/document/color.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, frame, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { setBorder, setFrameStyle, setNodeStyle, setTextMarkRange, setTextStyle } from "../src/document/commands/index.ts";

test("6桁の色は不透明のまま保持し、8桁の末尾はアルファとして編集する", () => {
  assert.equal(HEX_COLOR_PATTERN.test("#112233"), true);
  assert.equal(HEX_COLOR_PATTERN.test("#11223380"), true);
  for (const invalid of ["#123", "#1234", "#12345g80", "#1234567", "#123456789"]) assert.equal(HEX_COLOR_PATTERN.test(invalid), false);
  assert.equal(alphaByte("#112233"), 255);
  assert.equal(alphaByte("#11223300"), 0);
  assert.equal(withRgbColor("#11223380", "#aabbcc"), "#aabbcc80");
  assert.equal(withRgbColor("#112233", "#aabbcc"), "#aabbcc");
  assert.equal(withAlphaByte("#112233", 128), "#11223380");
  assert.equal(withAlphaByte("#11223380", 255), "#112233");
  assert.equal(rgbColor("#11223380"), "#112233");
  const legacy = document(frame({ children: [rectangle(), text()] }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(legacy)))), legacy);
  const markup = renderToStaticMarkup(<ColorField label="塗り" value="#11223380" fallback="#ffffff" onChange={() => {}} />);
  assert.match(markup, /type="color" value="#112233"/);
  assert.match(markup, /type="number"[^>]*value="128"/);
});

test("塗り・線・辺線・文字と部分装飾のアルファを保存し、Undo/Redoで保つ", () => {
  const initial = document(frame({ children: [rectangle({ style: { cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 } } }), text({ content: "Hello" })] }));
  const background = success(setFrameStyle(initial, "frame", { fill: "#101820cc" }));
  const shape = success(setNodeStyle(background, "rectangle", { fill: "#ff000080", stroke: { color: "#0000ff40", width: 2 } }));
  const bordered = success(setBorder(shape, "rectangle", { top: { color: "#abcdef80", width: 2 } }));
  const colored = success(setTextStyle(bordered, "text", { color: "#223344aa" }));
  const marked = success(setTextMarkRange(colored, "text", { content: "Hello", start: 0, end: 5, patch: { color: "#ffffff55" } }));
  const json = success(serializeDocument(marked));
  assert.match(json, /#ff000080/);
  assert.match(json, /#0000ff40/);
  assert.match(json, /#abcdef80/);
  assert.match(json, /#ffffff55/);
  assert.deepEqual(success(parseDocument(json)), marked);
  const history = commit(createHistory(initial), marked);
  assert.deepEqual(undo(history).present, initial);
  assert.deepEqual(redo(undo(history)).present, marked);
  assert.equal(setNodeStyle(initial, "rectangle", { fill: "#ff00008z" }).type, "Failure");
  assert.equal(parseDocument(JSON.stringify(document(rectangle({ style: { fill: "#ff00008z" } })))).type, "Failure");
});

test("SVGとPNGは同じ8桁色を塗り・線・文字へ渡す", async () => {
  const shape = rectangle({ style: { fill: "#11223380", stroke: { color: "#44556640", width: 2 } } });
  const label = text({ id: "label", content: "Hi", style: { color: "#778899aa" }, marks: [{ start: 0, end: 1, color: "#aabbcc55" }] });
  const masked = frame({ children: [rectangle({ id: "underlay", style: { fill: "#ffffff" } }),
    rectangle({ id: "mask", isMask: true }), shape, label] });
  const noOp = () => {};
  const markup = renderToStaticMarkup(<CanvasNode node={masked} selectedId={null}
    interaction={{ onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp }} />);
  assert.match(markup, /fill="#11223380"/);
  assert.match(markup, /stroke="#44556640"/);
  assert.equal(textMarkStyle(label, label.marks![0]).color, "#aabbcc55");
  assert.match(markup, /canvas-mask-group/);
  const calls: string[] = [];
  const ctx = { save() {}, restore() {}, translate() {}, beginPath() {}, rect() {}, clip() { calls.push("clip"); }, moveTo() {}, lineTo() {}, ellipse() {}, closePath() {},
    fillStyle: "", strokeStyle: "", fill() { calls.push(this.fillStyle); }, stroke() { calls.push(this.strokeStyle); },
    measureText: () => ({ width: 12, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 4 }),
    fillText() { calls.push(this.fillStyle); } };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(masked, { createCanvas: () => canvas as unknown as HTMLCanvasElement,
    loadImage: async () => ({}) as HTMLImageElement }));
  assert.ok(calls.indexOf("#ffffff") < calls.indexOf("#11223380"));
  assert.ok(calls.filter((call) => call === "clip").length >= 2);
  assert.ok(calls.includes("#11223380"));
  assert.ok(calls.includes("#44556640"));
  assert.ok(calls.includes("#aabbcc55"));
  assert.ok(calls.includes("#778899aa"));
});
