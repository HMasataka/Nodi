import assert from "node:assert/strict";
import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { borderPaths, pathToString } from "../src/document/shapePath.ts";
import { corners, document, ellipse, failure, frame, rectangle, resolveHex, success } from "./support/factories.ts";
import { documentSchema, parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { setBorder, setFrameStyle, setNodeStyle } from "../src/document/commands/index.ts";

const border = {
  top: { color: "#112233", width: 2 }, right: { color: "#223344", width: 3 },
  bottom: { color: "#334455", width: 4 }, left: { color: "#445566", width: 5 },
};

test("四辺をそれぞれ異なる内側台形にし、省略・幅0の辺は描かない", () => {
  assert.deepEqual(borderPaths(20, 10, border, resolveHex).map(({ side, color, commands }) => [side, color, pathToString(commands)]), [
    ["top", "#112233", "M 0 0 L 20 0 L 17 2 L 5 2 Z"],
    ["right", "#223344", "M 20 0 L 20 10 L 17 6 L 17 2 Z"],
    ["bottom", "#334455", "M 20 10 L 0 10 L 5 6 L 17 6 Z"],
    ["left", "#445566", "M 0 10 L 0 0 L 5 2 L 5 6 Z"],
  ]);
  assert.deepEqual(borderPaths(20, 10, { right: border.right, top: { color: "#ffffff", width: 0 } }, resolveHex).map(({ side }) => side), ["right"]);
  assert.equal(pathToString(borderPaths(10, 10, { top: border.top, bottom: { ...border.bottom, width: 12 } }, resolveHex)[0].commands), "M 0 0 L 10 0 L 10 1.667 L 0 1.667 Z");
});

test("保存時に空の辺線を省略し、片辺と既存の均一線を保持する", () => {
  const original = document(frame(), rectangle({ style: { cornerRadii: corners(0), border: { top: border.top } } }));
  const serialized = success(serializeDocument(original));
  const wire = JSON.parse(serialized);
  assert.equal(wire.version, 1);
  assert.equal(wire.children[0].style.border, undefined);
  assert.deepEqual(wire.children[1].style.border, { top: border.top });
  assert.deepEqual(wire.children[1].style.stroke, original.children[1].style.stroke);
  assert.deepEqual(success(parseDocument(serialized)), original);
  assert.deepEqual(success(parseDocument(JSON.stringify({ version: 1, children: [{ ...wire.children[0], style: { fill: null } }] }))).children[0].style.border, {});
});

test("楕円・不正な辺・角丸との併用をコマンドと永続化で拒否する", () => {
  const doc = document(rectangle(), frame({ id: "frame" }));
  assert.match(failure(setBorder(doc, "rectangle", { top: border.top })).message, /角丸/);
  const flat = success(setNodeStyle(doc, "rectangle", { cornerRadii: corners(0) }));
  const edited = success(setBorder(flat, "rectangle", { top: border.top }));
  assert.equal(setNodeStyle(edited, "rectangle", { cornerRadii: corners(1) }).type, "Failure");
  assert.deepEqual(success(setBorder(edited, "rectangle", {})).children[0].style.border, {});
  assert.equal(setFrameStyle(success(setBorder(doc, "frame", border)), "frame", { cornerRadii: corners(1) }).type, "Failure");
  for (const invalid of [{ top: { color: "red", width: 2 } }, { left: { color: "#ffffff", width: -1 } }, { top: { color: "#ffffff", width: Infinity } }, { diagonal: border.top }]) {
    assert.equal(setBorder(flat, "rectangle", invalid).type, "Failure");
    assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...flat.children[0], style: { ...flat.children[0].style, border: invalid } }] })).type, "Failure");
  }
  assert.equal(serializeDocument({ ...edited, children: [{ ...edited.children[0], style: { ...edited.children[0].style, cornerRadii: corners(1) } }] }).type, "Failure");
  const roundedBorder = { version: 1, children: [{ ...edited.children[0], style: { ...edited.children[0].style, cornerRadii: corners(1) } }] };
  assert.equal(parseDocument(JSON.stringify(roundedBorder)).type, "Failure");
  const parsed = documentSchema.safeParse(roundedBorder);
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.ok(parsed.error.issues.some((issue) => issue.message.includes("角丸")));
  const ellipseWire = { ...flat.children[0], type: "ellipse", style: { fill: null, stroke: null, border } };
  assert.equal(setBorder(document(ellipse()), "ellipse", border).type, "Failure");
  assert.equal(setNodeStyle(document(ellipse()), "ellipse", { border }).type, "Failure");
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [ellipseWire] })).type, "Failure");
});

test("SVG の辺色とパスは PNG と同じ順で、フレームの子要素より上に描かれる", async () => {
  const child = rectangle({ id: "child", style: { fill: "#abcdef", stroke: null, cornerRadii: corners(0), border } });
  const root = frame({ width: 20, height: 10, style: { fill: "#ffffff", stroke: { color: "#000000", width: 1 }, border }, children: [child] });
  const svg = renderToStaticMarkup(<CanvasNode node={root} selectedId={null} interaction={{ onNodePointerDown() {}, onResizePointerDown() {}, onNodePointerMove() {}, onNodePointerUp() {}, onImageError() {} }} />);
  assert.ok(svg.indexOf("frame-contents") < svg.lastIndexOf("canvas-border"));
  for (const edge of borderPaths(20, 10, border, resolveHex)) assert.ok(svg.includes(`d="${pathToString(edge.commands)}" fill="${edge.color}"`));
  const calls: unknown[][] = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, clip() {}, rect() {}, beginPath() {}, closePath() {},
    moveTo(x: number, y: number) { calls.push(["move", x, y]); },
    lineTo(x: number, y: number) { calls.push(["line", x, y]); },
    fillStyle: "", fill() { calls.push(["fill", this.fillStyle]); },
    strokeStyle: "", lineWidth: 0, stroke() { calls.push(["stroke", this.strokeStyle]); },
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(root, { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({}) as HTMLImageElement }));
  const colors = calls.filter(([kind]) => kind === "fill" || kind === "stroke").map(([, color]) => color);
  assert.deepEqual(colors, ["#ffffff", "#000000", "#abcdef", ...Object.values(border).map((edge) => edge.color), ...Object.values(border).map((edge) => edge.color)]);
  assert.ok(calls.some(([kind, x, y]) => kind === "line" && x === 17 && y === 2));
});

test("MCP set_border は矩形・フレームだけに適用して参照にも反映する", () => {
  let current = document(rectangle({ style: { cornerRadii: corners(0) } }), frame());
  const api = createAgentApi({ getDocument: () => current, getHistory: () => ({}) as never, getSelectedId: () => null, apply: (updated) => { current = updated; } });
  const response = dispatchAgentRequest(api, "set_border", { id: "rectangle", border: { top: border.top } });
  assert.equal(response.ok, true);
  assert.deepEqual(success(api.getElement("rectangle")).border, { top: border.top });
  assert.equal(dispatchAgentRequest(api, "set_border", { id: "frame", border: border }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_border", { id: "rectangle", border: { top: { color: "red", width: 1 } } }).ok, false);
  assert.equal(dispatchAgentRequest(api, "set_border", { id: "rectangle", border: { diagonal: border.top } }).ok, false);
  assert.deepEqual(current.children[0].style.border, { top: border.top });
});
