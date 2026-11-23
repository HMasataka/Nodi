import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNodes } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { createAgentApi } from "../src/agent/api.ts";
import { DEFAULT_IMAGE_FILTERS } from "../src/document/types.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { LayersPanel } from "../src/pages/editor/components/organisms/LayersPanel/LayersPanel.tsx";
import { renderFramePng } from "../src/export/framePng.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { corners, document, ellipse, frame, image, rectangle, success } from "./support/factories.ts";
import { deleteNode, duplicateNode, reorderNode, setMask } from "../src/document/commands/index.ts";
import { maskGroups, maskPath } from "../src/document/masks.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { pathToString, tracePath } from "../src/document/shapePath.ts";

const mask = rectangle({ id: "mask", name: "mask", x: 10, y: 20, width: 40, height: 20, rotation: 90, isMask: true,
  style: { fill: "#ff0000", cornerRadii: corners(4) } });
const first = rectangle({ id: "first", name: "first", style: { fill: "#112233" } });
const secondMask = ellipse({ id: "second-mask", isMask: true, x: 60, y: 30, width: 30, height: 20, rotation: 45 });
const second = rectangle({ id: "second", name: "second", style: { fill: "#445566" } });

test("各マスクは次のマスクまでの兄弟だけをクリップし、空グループも保持する", () => {
  const before = rectangle({ id: "before" });
  assert.deepEqual(maskGroups([before, mask, first, secondMask, second]).map(({ mask: item, children }) =>
    [item?.id ?? null, children.map((node) => node.id)]), [[null, ["before"]], ["mask", ["first"]], ["second-mask", ["second"]]]);
  assert.deepEqual(maskGroups([mask, secondMask]).map(({ mask: item, children }) => [item?.id, children]),
    [["mask", []], ["second-mask", []]]);
  assert.deepEqual(maskGroups([first, second]).map(({ mask: item, children }) => [item, children.map((node) => node.id)]),
    [[null, ["first", "second"]]]);
});

test("回転・角丸した矩形と楕円のマスクパスを同じコマンドからSVGとCanvasに渡す", () => {
  const rectangular = maskPath(mask);
  const oval = maskPath(secondMask);
  assert.match(pathToString(rectangular), /A 4 4 90/);
  assert.match(pathToString(oval), /A 15 10 45/);
  const calls: unknown[][] = [];
  tracePath({ beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, ellipse: (...args: unknown[]) => calls.push(args) } as unknown as CanvasRenderingContext2D, oval);
  assert.equal(calls[0][4], Math.PI / 4);
  assert.equal(calls.length, 2);
});

test("未選択のマスクは描かず、選択時だけ輪郭とレイヤー上の表示を出す", () => {
  const interaction = { onNodePointerDown() {}, onResizePointerDown() {}, onNodePointerMove() {}, onNodePointerUp() {}, onImageError() {} };
  const nodes = [mask, first, secondMask, second];
  const hidden = renderToStaticMarkup(<CanvasNodes nodes={nodes} selectedId={null} interaction={interaction} />);
  assert.equal((hidden.match(/class="canvas-mask-group"/g) ?? []).length, 2);
  assert.doesNotMatch(hidden, /aria-label="mask"/);
  assert.doesNotMatch(hidden, /fill="#ff0000"/);
  assert.ok(hidden.indexOf('aria-label="first"') < hidden.indexOf('aria-label="second"'));
  const selected = renderToStaticMarkup(<CanvasNodes nodes={nodes} selectedId="mask" interaction={interaction} />);
  assert.match(selected, /class="canvas-node canvas-mask is-selected"/);
  assert.match(selected, /stroke-dasharray="4 3"/);
  assert.match(selected, /class="resize-handle"/);
  const layers = renderToStaticMarkup(<LayersPanel nodes={nodes} selectedId={null} onSelect={() => {}} onReorder={() => {}} />);
  assert.equal((layers.match(/layer-badge/g) ?? []).length, 2);
});

test("PNGはマスクを塗らず、兄弟ごとにクリップを解除して次のマスクへ進む", async () => {
  const calls: unknown[][] = [];
  const ctx = { save: () => calls.push(["save"]), restore: () => calls.push(["restore"]), translate() {}, rotate() {},
    beginPath() {}, rect() {}, clip: () => calls.push(["clip"]), moveTo() {}, lineTo() {}, ellipse() {}, closePath() {},
    fillStyle: "", fill() { calls.push(["fill", this.fillStyle]); }, stroke() {} };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(frame({ children: [first, mask, second, secondMask, rectangle({ id: "last", style: { fill: "#778899" } })] }),
    { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({}) as HTMLImageElement }));
  assert.deepEqual(calls.filter(([kind]) => kind === "fill").map(([, color]) => color), ["#ffffff", "#112233", "#445566", "#778899"]);
  assert.equal(calls.filter(([kind]) => kind === "clip").length, 4);
  assert.equal(calls.filter(([kind]) => kind === "save").length, calls.filter(([kind]) => kind === "restore").length);
});

test("回転マスク内の画像フィルターはオフスクリーン処理後もクリップを維持する", async () => {
  const calls: string[] = [];
  const pixelData = { data: new Uint8ClampedArray([100, 50, 0, 128, 0, 0, 0, 0]) };
  const offscreen = { width: 0, height: 0, getContext: () => ({ scale() {}, drawImage: () => calls.push("offscreen.drawImage"),
    getImageData: () => pixelData, putImageData: () => calls.push("putImageData") }) };
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, rect() {}, closePath() {}, moveTo() {}, lineTo() {},
    clip: () => calls.push("clip"), fill() {}, drawImage: (source: unknown) => { assert.equal(source, offscreen); calls.push("drawImage"); } };
  const child = image({ width: 2, height: 1, style: { filters: { ...DEFAULT_IMAGE_FILTERS, brightness: 0.5 } } });
  const root = frame({ width: 2, height: 1, children: [rectangle({ id: "clip", width: 2, height: 1, isMask: true, rotation: 90,
    style: { cornerRadii: corners(0) } }), child] });
  let canvasCount = 0;
  success(await renderFramePng(root, { createCanvas: () => ++canvasCount === 1
    ? { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) } as unknown as HTMLCanvasElement
    : offscreen as unknown as HTMLCanvasElement,
  loadImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }) as HTMLImageElement }));
  assert.equal(canvasCount, 2);
  assert.equal(calls.slice(0, calls.indexOf("drawImage")).filter((call) => call === "clip").length, 4);
  assert.deepEqual(calls.slice(-3), ["offscreen.drawImage", "putImageData", "drawImage"]);
  assert.deepEqual(Array.from(pixelData.data), [50, 25, 0, 128, 0, 0, 0, 0]);
});

test("マスクを外す・削除・複製・並べ替えると対象グループが変わり、Undoで戻る", () => {
  const original = document(mask, first, second);
  const disabled = success(setMask(original, "mask", false));
  assert.deepEqual(maskGroups(disabled.children).map(({ mask: item, children }) => [item, children.length]), [[null, 3]]);
  assert.deepEqual(maskGroups(success(deleteNode(original, "mask")).children).map(({ mask: item }) => item), [null]);
  const duplicated = success(duplicateNode(original, "mask"));
  assert.equal(duplicated.node.isMask, true);
  assert.notEqual(duplicated.node.id, mask.id);
  assert.deepEqual(maskGroups(success(reorderNode(original, "mask", "front")).children).map(({ mask: item, children }) =>
    [item?.id ?? null, children.length]), [[null, 2], ["mask", 0]]);
  const history = commit(createHistory(original), disabled);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, disabled);
});

test("Wireではマスクだけtrueを保存し、MCPで設定と解除ができる", () => {
  const original = document(rectangle(), ellipse());
  const json = success(serializeDocument(original));
  assert.equal(Object.hasOwn(JSON.parse(json).children[0], "isMask"), false);
  assert.deepEqual(success(parseDocument(json)), original);
  const enabled = success(setMask(original, "rectangle", true));
  assert.equal(JSON.parse(success(serializeDocument(enabled))).children[0].isMask, true);
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...JSON.parse(json).children[0], isMask: false }] })).type, "Failure");
  assert.equal(setMask(original, "missing", true).type, "Failure");
  assert.equal(setMask(document(frame()), "frame", true).type, "Failure");
  let current = original;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_mask", { id: "rectangle", isMask: true }).ok, true);
  assert.equal(success(api.getElement("rectangle")).isMask, true);
  assert.equal(dispatchAgentRequest(api, "set_mask", { id: "rectangle", isMask: false }).ok, true);
  assert.equal(success(api.getElement("rectangle")).isMask, false);
  assert.equal(dispatchAgentRequest(api, "set_mask", { id: "rectangle", isMask: "true" }).ok, false);
});
