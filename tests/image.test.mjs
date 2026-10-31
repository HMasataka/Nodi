import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addNode, createDocument, deleteNode, duplicateNode, findNode, setNodeGeometry } from "../src/document/commands/index.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { commit, createHistory, undo } from "../src/document/history.ts";
import { readImageFile, validateImageFile } from "../src/ipc/imageFiles.ts";
import { createAgentApi } from "../src/agent/api.ts";

const source = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+R7sAAAAASUVORK5CYII=";
function success(result) { assert.equal(result.type, "Success"); return result.value; }

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
