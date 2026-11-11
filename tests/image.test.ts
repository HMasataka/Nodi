import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "vitest";
import { tmpdir } from "node:os";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { imageContentStyle } from "../src/pages/editor/canvasStyles.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { addNode, createDocument, deleteNode, duplicateNode, findNode, setImageStyle, setNodeGeometry } from "../src/document/commands/index.ts";
import { commit, createHistory, undo } from "../src/document/history.ts";
import { failure, frame, image, success } from "./support/factories.ts";
import { imageObjectPosition, imagePlacement } from "../src/document/imagePlacement.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { readImageFile, validateImageFile } from "../src/ipc/imageFiles.ts";

const source = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+R7sAAAAASUVORK5CYII=";
test("フレーム内の画像は移動・サイズ変更・複製・削除・Undo ができる", () => {
  const frame = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 300, height: 200 }));
  const added = success(addNode(frame.document, { type: "image", source, parentId: frame.node.id, x: 10, y: 20, width: 100, height: 80 }));
  const resized = success(setNodeGeometry(added.document, added.node.id, { x: 30, y: 40, width: 200, height: 120 }));
  const copied = success(duplicateNode(resized, added.node.id));
  assert.notEqual(copied.node.id, added.node.id);
  assert.equal(copied.node.source, source);
  const api = createAgentApi({ getDocument: () => copied.document, getHistory: () => createHistory(copied.document), getSelectedId: () => null, apply: () => {} });
  assert.equal(success(api.getElement(copied.node.id)).source, source);
  assert.equal(success(api.getState()).elements.find((item) => item.id === copied.node.id).source, undefined);
  const deleted = success(deleteNode(copied.document, added.node.id));
  assert.equal(findNode(deleted, added.node.id), undefined);
  assert.equal(undo(commit(createHistory(copied.document), deleted)).present, copied.document);
});

test("画像を埋め込んだ .nodi は単体で移動しても読み込める", async () => {
  const added = success(addNode(createDocument(), { type: "image", source, x: 0, y: 0, width: 100, height: 80 }));
  const directory = await mkdtemp(join(tmpdir(), "nodi-image-"));
  try {
    const first = join(directory, "first.nodi");
    const moved = join(directory, "moved.nodi");
    await writeFile(first, success(serializeDocument(added.document)));
    await copyFile(first, moved);
    const loaded = success(parseDocument(await readFile(moved, "utf8")));
    assert.equal(loaded.children[0].source, source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("外部パス・不正画像・未対応形式を拒否する", () => {
  const current = createDocument();
  assert.equal(addNode(current, { type: "image", source: "file:///missing.png", x: 0, y: 0, width: 20, height: 20 }).type, "Failure");
  assert.equal(addNode(current, { type: "image", source: "", x: 0, y: 0, width: 20, height: 20 }).type, "Failure");
  assert.equal(validateImageFile({ type: "text/plain", size: 100 }).type, "Failure");
  assert.equal(validateImageFile({ type: "image/png", size: 6_000_000 }).type, "Failure");
  assert.equal(validateImageFile({ type: "image/svg+xml", size: 100 }).type, "Success");
  assert.deepEqual(current, createDocument());
});

test("画像のデコードに失敗した場合は追加前に失敗を返す", async () => {
  const originalReader = globalThis.FileReader;
  const originalImage = globalThis.Image;
  globalThis.FileReader = class {
    readAsDataURL() { this.result = source; queueMicrotask(() => this.onload()); }
  };
  globalThis.Image = class {
    set src(_) { queueMicrotask(() => this.onerror()); }
  };
  try {
    const result = await readImageFile({ type: "image/png", size: 100 });
    assert.equal(result.type, "Failure");
    assert.match(result.error.message, /画像を表示できません/);
  } finally {
    globalThis.FileReader = originalReader;
    globalThis.Image = originalImage;
  }
});

test("cover は焦点を元画像の切り抜き位置に反映し、DOM の object-position と一致する", () => {
  const node = image({ width: 100, height: 100, style: { focalPoint: { x: 0.25, y: 0.75 } } });
  assert.deepEqual(imagePlacement(400, 200, node.width, node.height, node.style),
    { sx: 50, sy: 0, sw: 200, sh: 200, dx: 0, dy: 0, dw: 100, dh: 100 });
  assert.deepEqual(imageContentStyle(node), { objectFit: "cover", objectPosition: "25% 75%" });
  assert.equal(imageObjectPosition(node.style), "25% 75%");
  assert.deepEqual(imagePlacement(200, 400, 100, 100, { ...node.style, focalPoint: { x: 0, y: 1 } }),
    { sx: 0, sy: 200, sw: 200, sh: 200, dx: 0, dy: 0, dw: 100, dh: 100 });
});

test("contain は画像全体を保ったまま余白位置を焦点に揃え、fill は焦点を無視する", () => {
  const style = { fit: "contain", focalPoint: { x: 0.25, y: 1 } } as const;
  assert.deepEqual(imagePlacement(400, 200, 100, 100, style),
    { sx: 0, sy: 0, sw: 400, sh: 200, dx: 0, dy: 50, dw: 100, dh: 50 });
  assert.deepEqual(imagePlacement(200, 400, 100, 100, style),
    { sx: 0, sy: 0, sw: 200, sh: 400, dx: 12.5, dy: 0, dw: 50, dh: 100 });
  assert.deepEqual(imagePlacement(400, 200, 100, 100, { ...style, fit: "fill" }),
    { sx: 0, sy: 0, sw: 400, sh: 200, dx: 0, dy: 0, dw: 100, dh: 100 });
  assert.deepEqual(imageContentStyle(image({ style })), { objectFit: "contain", objectPosition: "25% 100%" });
});

test("PNG は DOM と同じ焦点配置を用い、contain の余白を背景色で描く", async () => {
  for (const fit of ["cover", "contain", "fill"] as const) {
    const node = image({ width: 100, height: 100, style: { fit, focalPoint: { x: 0.25, y: 1 } } });
    const calls = [];
    const ctx = { save() {}, restore() {}, translate() {}, beginPath() {}, rect() {}, clip() {},
      moveTo() {}, lineTo() {}, closePath() {}, fill() {}, fillRect: (...args) => calls.push(["fillRect", ...args]),
      drawImage: (...args) => calls.push(["drawImage", ...args]) };
    const picture = { naturalWidth: 400, naturalHeight: 200 };
    const result = await renderFramePng(frame({ width: 100, height: 100, children: [node] }), {
      createCanvas: () => ({ getContext: () => ctx, toBlob: (callback) => callback(new Blob(["png"])) }),
      loadImage: async () => picture,
    });
    success(result);
    const placement = imagePlacement(400, 200, 100, 100, node.style);
    assert.deepEqual(calls.find(([method]) => method === "drawImage"),
      ["drawImage", picture, placement.sx, placement.sy, placement.sw, placement.sh, placement.dx, placement.dy, placement.dw, placement.dh]);
    assert.deepEqual(calls.filter(([method]) => method === "fillRect"), fit === "contain" ? [["fillRect", 0, 0, 100, 100]] : []);
  }
});

test("旧画像は cover・中央で正規化し、既定値は保存せず再読込できる", () => {
  const legacy = { version: 1, children: [{ ...image(), style: {} }] };
  const loaded = success(parseDocument(JSON.stringify(legacy)));
  assert.deepEqual(loaded.children[0].style, image().style);
  const compact = JSON.parse(success(serializeDocument(loaded)));
  assert.deepEqual(compact.children[0].style, {});
  assert.deepEqual(success(parseDocument(JSON.stringify(compact))), loaded);
  const styled = success(setImageStyle(loaded, "image", { fit: "contain", focalPoint: { x: 0, y: 1 } }));
  assert.deepEqual(JSON.parse(success(serializeDocument(styled))).children[0].style, { fit: "contain", focalPoint: { x: 0, y: 1 } });
});

test("画像スタイルは不正値と画像以外への編集を拒否し、MCP から変更・参照できる", () => {
  const initial = { version: 1, children: [image()] };
  for (const style of [{ fit: "invalid" }, { focalPoint: { x: -0.1, y: 0.5 } }, { focalPoint: { x: 0.5, y: 1.1 } },
    { focalPoint: { x: null, y: 0.5 } }, { focalPoint: { x: 0.5 } }, { focalPoint: { x: 0.5, y: 0.5, z: 1 } }]) {
    assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...image(), style }] })).type, "Failure");
    assert.equal(setImageStyle(initial, "image", style).type, "Failure");
  }
  assert.match(failure(setImageStyle(initial, "missing", { fit: "fill" })).message, /画像が見つかりません/);
  let current = initial;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null,
    apply: (document) => { current = document; } });
  assert.equal(dispatchAgentRequest(api, "set_image_style", { id: "image", fit: "contain", focalPoint: { x: 0, y: 1 } }).ok, true);
  assert.deepEqual(success(api.getElement("image")).style, { ...image().style, fit: "contain", focalPoint: { x: 0, y: 1 } });
  assert.equal(dispatchAgentRequest(api, "set_image_style", { id: "image", focalPoint: { x: 2, y: 0 } }).ok, false);
  assert.equal(dispatchAgentRequest(api, "set_image_style", { id: "image", bogus: true }).ok, false);
});
