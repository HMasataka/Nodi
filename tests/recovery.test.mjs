import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, moveNode } from "../src/document/commands/index.ts";
import { commit, createHistory, isDirty, markSaved, undo } from "../src/document/history.ts";
import { saveDocumentFile } from "../src/persistence/documentFile.ts";
import { clearRecoveryDraft, readRecoveryDraft, writeRecoveryDraft } from "../src/persistence/recovery.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

function memoryRecovery() {
  let contents = null;
  return {
    get contents() { return contents; },
    set contents(value) { contents = value; },
    read: async () => contents,
    write: async (value) => { contents = value; },
    clear: async () => { contents = null; },
  };
}

test("未保存の編集を元ファイルとは別に復元し、保存・Undo と保存済み表示を保つ", async () => {
  const access = memoryRecovery();
  const original = success(addNode(createDocument(), { type: "rectangle", x: 0, y: 0, width: 40, height: 30 }));
  const edited = success(moveNode(original.document, original.node.id, 25, 10));
  const draft = { sourcePath: "/documents/original.nodi", document: edited };
  success(await writeRecoveryDraft(access, draft));
  assert.deepEqual(success(await readRecoveryDraft(access)), draft);

  // 復元後は元ファイルのパスを引き継がず、保存先の選択を待つ。
  let history = createHistory(draft.document);
  assert.equal(isDirty(history), true);
  history = commit(history, success(moveNode(history.present, original.node.id, 30, 10)));
  const writes = [];
  const savedPath = success(await saveDocumentFile({
    pickOpen: async () => null,
    pickSave: async () => "/documents/recovered.nodi",
    read: async () => "",
    write: async (path) => { writes.push(path); },
  }, history.present, null));
  assert.equal(savedPath, "/documents/recovered.nodi");
  assert.deepEqual(writes, ["/documents/recovered.nodi"]);
  history = markSaved(history);
  assert.equal(isDirty(history), false);
  assert.equal(isDirty(undo(history)), true);
  success(await clearRecoveryDraft(access));
  assert.equal(success(await readRecoveryDraft(access)), null);
});

test("破損した復元データを拒否し、明示的な破棄まで残す", async () => {
  const access = memoryRecovery();
  for (const contents of ["{", JSON.stringify({ version: 1, sourcePath: null, contents: '{"version":2,"children":[]}' })]) {
    access.contents = contents;
    assert.equal((await readRecoveryDraft(access)).type, "Failure");
    assert.equal(access.contents, contents);
  }
  success(await clearRecoveryDraft(access));
  assert.equal(access.contents, null);
  assert.equal(isDirty(createHistory(createDocument(), true)), false);
});

test("復元データの書き込み失敗は既存の退避内容を破棄しない", async () => {
  const access = memoryRecovery();
  const draft = { sourcePath: null, document: createDocument() };
  success(await writeRecoveryDraft(access, draft));
  const original = access.contents;
  access.write = async () => Promise.reject(new Error("ディスクエラー"));
  const failed = await writeRecoveryDraft(access, draft);
  assert.equal(failed.type, "Failure");
  assert.equal(access.contents, original);
});
