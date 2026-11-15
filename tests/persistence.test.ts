import assert from "node:assert/strict";
import { serializeDocument } from "../src/persistence/format.ts";
import { test } from "vitest";

import { addNode, createDocument, moveNode, renameNode } from "../src/document/commands/index.ts";
import { commit, createHistory, isDirty } from "../src/document/history.ts";
import { failure, success } from "./support/factories.ts";
import { openDocumentFile, parseDocumentContents, readDocumentContents, readPathDocument, saveDocumentFile } from "../src/persistence/documentFile.ts";

function memoryFiles() {
  const files = new Map();
  let selectedOpen = null;
  let saveDialogCount = 0;
  return {
    files,
    select(path) { selectedOpen = path; },
    get saveDialogCount() { return saveDialogCount; },
    pickOpen: async () => selectedOpen,
    pickSave: async (defaultPath) => { assert.equal(defaultPath, "untitled.nodi"); saveDialogCount++; return "design.nodi"; },
    read: async (path) => {
      if (!files.has(path)) return Promise.reject(new Error("ファイルがありません"));
      return files.get(path);
    },
    write: async (path, contents) => { files.set(path, contents); },
  };
}

test("編集した文書を保存して読み直すと名前・ID・位置が一致する", async () => {
  const access = memoryFiles();
  const created = success(addNode(createDocument(), {
    type: "rectangle", name: "ログインボタン", x: 24, y: 40, width: 200, height: 48,
  }));
  const moved = success(moveNode(created.document, created.node.id, 80, 96));
  const document = success(renameNode(moved, created.node.id, "送信ボタン"));

  assert.equal(success(await saveDocumentFile(access, document, null)), "design.nodi");
  access.select("design.nodi");
  assert.deepEqual(success(await openDocumentFile(access)).document, document);
  assert.equal(success(await saveDocumentFile(access, document, "design.nodi")), "design.nodi");
  assert.equal(access.saveDialogCount, 1);
});

test("キャンセル時は読み書きをせず、開く前の文書を変更しない", async () => {
  const access = memoryFiles();
  const current = createDocument();
  access.pickSave = async () => null;
  assert.equal(success(await openDocumentFile(access)), null);
  assert.equal(success(await saveDocumentFile(access, current, null)), null);
  assert.equal(access.files.size, 0);
  assert.deepEqual(current, createDocument());
});

test("不正なファイルや読み書きエラーは失敗を返し、元の文書を維持する", async () => {
  const access = memoryFiles();
  const current = success(addNode(createDocument(), {
    type: "rectangle", x: 0, y: 0, width: 10, height: 10,
  })).document;
  access.files.set("broken.nodi", '{"version":2,"children":[]}');
  access.select("broken.nodi");
  assert.match(failure(await openDocumentFile(access)).message, /version/);
  access.select("missing.nodi");
  assert.match(failure(await openDocumentFile(access)).message, /ファイルがありません/);
  access.write = async () => Promise.reject(new Error("書き込めません"));
  assert.match(failure(await saveDocumentFile(access, current, "design.nodi")).message, /書き込めません/);
  assert.equal(current.children.length, 1);
  assert.equal(access.files.get("broken.nodi"), '{"version":2,"children":[]}');
});

test("上書き中の失敗で既存ファイルを維持し、保存済み状態にしない", async () => {
  const access = memoryFiles();
  const initial = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 10, height: 10 }));
  access.files.set("design.nodi", JSON.stringify(initial.document));
  const previous = access.files.get("design.nodi");
  const history = commit(createHistory(initial.document, true), success(moveNode(initial.document, initial.node.id, 20, 30)));
  access.write = async () => Promise.reject(new Error("置換前に失敗"));
  assert.equal((await saveDocumentFile(access, history.present, "design.nodi")).type, "Failure");
  assert.equal(access.files.get("design.nodi"), previous);
  assert.equal(isDirty(history), true);
});

test("開いたファイルの生内容を返し、外部変更の検知に使える", async () => {
  const access = memoryFiles();
  const document = success(addNode(createDocument(), { type: "rectangle", name: "ボタン", x: 0, y: 0, width: 10, height: 10 })).document;
  const serialized = success(serializeDocument(document));
  access.files.set("design.nodi", serialized);
  access.select("design.nodi");
  const opened = success(await openDocumentFile(access));
  assert.deepEqual(opened.document, document);
  assert.equal(opened.contents, serialized);
});

test("readPathDocument は指定パスを読み込み、文書と生内容を返す", async () => {
  const access = memoryFiles();
  const document = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 10, height: 10 })).document;
  const serialized = success(serializeDocument(document));
  access.files.set("design.nodi", serialized);
  const loaded = success(await readPathDocument(access, "design.nodi"));
  assert.deepEqual(loaded.document, document);
  assert.equal(loaded.contents, serialized);
});

test("readDocumentContents は生の内容を返す", async () => {
  const access = memoryFiles();
  access.files.set("design.nodi", '{"version":1,"children":[]}');
  assert.equal(success(await readDocumentContents(access, "design.nodi")), '{"version":1,"children":[]}');
});

test("parseDocumentContents は不正な内容を失敗として返す", () => {
  assert.match(failure(parseDocumentContents('{"version":2,"children":[]}')).message, /version/);
  assert.match(failure(parseDocumentContents("not json")).message, /JSON/);
});

test("保存した内容は読み直しと一致し、自前の保存を外部変更と誤認しない", async () => {
  const access = memoryFiles();
  const document = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 10, height: 10 })).document;
  const path = success(await saveDocumentFile(access, document, null));
  const contents = success(await readDocumentContents(access, path));
  assert.equal(contents, success(serializeDocument(document)));
});
