import assert from "node:assert/strict";
import test from "node:test";

import { resolvedTextFont } from "../src/document/textFonts.ts";
import { addNode, createDocument, findNode, moveNode, setTextContent, setTextStyle } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("フレーム内のテキストを編集・移動して保存・Undo / Redo できる", () => {
  const frame = success(addNode(createDocument(), { type: "frame", name: "画面", x: 0, y: 0, width: 400, height: 300 }));
  const text = success(addNode(frame.document, { type: "text", parentId: frame.node.id, name: "見出し", content: "Hello", x: 20, y: 50, width: 240, height: 48 }));
  const edited = success(setTextContent(text.document, text.node.id, "Hello\nNodi"));
  const moved = success(moveNode(edited, text.node.id, 30, 60));
  assert.equal(findNode(moved, text.node.id).name, "見出し");
  assert.equal(findNode(moved, text.node.id).content, "Hello\nNodi");
  assert.deepEqual(success(parseDocument(success(serializeDocument(moved)))), moved);
  const history = commit(createHistory(text.document), edited);
  assert.equal(findNode(undo(history).present, text.node.id).content, "Hello");
  assert.equal(findNode(redo(undo(history)).present, text.node.id).content, "Hello\nNodi");
});

test("本文の空文字は有効で、欠落や別型は拒否する", () => {
  const created = success(addNode(createDocument(), { type: "text", x: 0, y: 0, width: 100, height: 40 }));
  assert.equal(created.node.content, "テキスト");
  const empty = success(setTextContent(created.document, created.node.id, ""));
  assert.equal(findNode(empty, created.node.id).content, "");
  const missing = { ...created.document, children: [{ ...created.node, content: undefined }] };
  assert.equal(parseDocument(JSON.stringify(missing)).type, "Failure");
  assert.equal(setTextContent(created.document, created.node.id, 42).type, "Failure");
  assert.equal(setTextContent(created.document, "missing", "a").type, "Failure");
});

test("文字のサイズ・色・揃えは保存・Undo / Redo で維持され、不正値を拒否する", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "見出し", x: 0, y: 0, width: 90, height: 30 }));
  const styled = success(setTextStyle(created.document, created.node.id, { fontSize: 24, color: "#aabbcc", textAlign: "center" }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(styled)))), styled);
  const history = commit(createHistory(created.document), styled);
  assert.equal(findNode(undo(history).present, created.node.id).fontSize, 16);
  assert.equal(findNode(redo(undo(history)).present, created.node.id).textAlign, "center");
  for (const patch of [{ fontSize: 0 }, { color: "red" }, { textAlign: "justify" }]) {
    assert.equal(setTextStyle(created.document, created.node.id, patch).type, "Failure");
  }
});

test("旧形式の文字は従来のフォントで読み込み、フォントと太さの変更は保存・Undoできる", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "Hello", x: 0, y: 0, width: 200, height: 48 }));
  const legacyNode = { ...created.node };
  delete legacyNode.fontFamily;
  delete legacyNode.fontWeight;
  const legacy = { version: 1, children: [legacyNode] };
  const loaded = success(parseDocument(JSON.stringify(legacy)));
  assert.deepEqual(success(parseDocument(success(serializeDocument(loaded)))), loaded);
  assert.deepEqual(resolvedTextFont(legacyNode), resolvedTextFont(created.node));

  const styled = success(setTextStyle(loaded, legacyNode.id, { fontFamily: "system", fontWeight: 700 }));
  assert.equal(findNode(styled, legacyNode.id).fontFamily, "system");
  assert.equal(findNode(styled, legacyNode.id).fontWeight, 700);
  assert.deepEqual(success(parseDocument(success(serializeDocument(styled)))), styled);
  const history = commit(createHistory(loaded), styled);
  assert.equal(findNode(undo(history).present, legacyNode.id).fontFamily, undefined);
  assert.equal(findNode(redo(undo(history)).present, legacyNode.id).fontWeight, 700);
});

test("対応しないフォントや不正な太さは文書を変更せず拒否する", () => {
  const created = success(addNode(createDocument(), { type: "text", x: 0, y: 0, width: 100, height: 40 }));
  assert.equal(created.node.fontFamily, "default");
  assert.equal(created.node.fontWeight, 400);
  for (const patch of [{ fontFamily: "unknown" }, { fontWeight: 0 }, { fontWeight: 350 }, { fontWeight: 1000 }, { fontWeight: NaN }, { fontWeight: "700" }]) {
    assert.equal(setTextStyle(created.document, created.node.id, patch).type, "Failure");
  }
  for (const patch of [{ fontFamily: "unknown" }, { fontWeight: 350 }, { fontWeight: "700" }]) {
    assert.equal(parseDocument(JSON.stringify({ ...created.document, children: [{ ...created.node, ...patch }] })).type, "Failure");
  }
  assert.equal(findNode(created.document, created.node.id).fontWeight, 400);
});
