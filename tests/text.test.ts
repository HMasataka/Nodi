import assert from "node:assert/strict";
import { test } from "vitest";

import { resolvedTextFont } from "../src/document/textFonts.ts";
import { success } from "./support/factories.ts";
import { addNode, createDocument, findNode, moveNode, setTextContent, setTextStyle } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

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
  assert.equal(findNode(undo(history).present, created.node.id).style.fontSize, 16);
  assert.equal(findNode(redo(undo(history)).present, created.node.id).style.textAlign, "center");
  for (const patch of [{ fontSize: 0 }, { color: "red" }, { textAlign: "justify" }]) {
    assert.equal(setTextStyle(created.document, created.node.id, patch).type, "Failure");
  }
});

test("省略した文字スタイルを補完し、フォントと太さの変更は保存・Undoできる", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "Hello", x: 0, y: 0, width: 200, height: 48 }));
  const legacyNode = structuredClone(created.node);
  delete legacyNode.style.fontFamily;
  delete legacyNode.style.fontWeight;
  delete legacyNode.style.lineHeight;
  delete legacyNode.style.letterSpacing;
  const legacy = { version: 1, children: [legacyNode] };
  const loaded = success(parseDocument(JSON.stringify(legacy)));
  assert.deepEqual(success(parseDocument(success(serializeDocument(loaded)))), loaded);
  assert.deepEqual(resolvedTextFont(loaded.children[0].style), resolvedTextFont(created.node.style));

  const styled = success(setTextStyle(loaded, legacyNode.id, { fontFamily: "system", fontWeight: 700 }));
  assert.equal(findNode(styled, legacyNode.id).style.fontFamily, "system");
  assert.equal(findNode(styled, legacyNode.id).style.fontWeight, 700);
  assert.deepEqual(success(parseDocument(success(serializeDocument(styled)))), styled);
  const history = commit(createHistory(loaded), styled);
  assert.equal(findNode(undo(history).present, legacyNode.id).style.fontFamily, "default");
  assert.equal(findNode(redo(undo(history)).present, legacyNode.id).style.fontWeight, 700);
});

test("行高と負の字間は保存・Undo / Redo で維持し、省略値を補完する", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "First\nSecond", x: 0, y: 0, width: 200, height: 70 }));
  assert.equal(created.node.style.lineHeight, 1.4);
  assert.equal(created.node.style.letterSpacing, 0);
  const legacy = { ...created.document, children: [{ ...created.node, style: { ...created.node.style, lineHeight: undefined, letterSpacing: undefined } }] };
  const parsed = success(parseDocument(JSON.stringify(legacy)));
  assert.equal(parsed.children[0].style.lineHeight, 1.4);
  const styled = success(setTextStyle(parsed, created.node.id, { lineHeight: 1.75, letterSpacing: -0.5 }));
  assert.equal(styled.children[0].style.lineHeight, 1.75);
  assert.equal(styled.children[0].style.letterSpacing, -0.5);
  assert.deepEqual(success(parseDocument(success(serializeDocument(styled)))), styled);
  const history = commit(createHistory(parsed), styled);
  assert.equal(findNode(undo(history).present, created.node.id).style.lineHeight, 1.4);
  assert.equal(findNode(redo(undo(history)).present, created.node.id).style.letterSpacing, -0.5);
});

test("行高のゼロ・負値と字間の非有限値を拒否し、元の文書を変更しない", () => {
  const created = success(addNode(createDocument(), { type: "text", x: 0, y: 0, width: 100, height: 40 }));
  for (const patch of [{ lineHeight: 0 }, { lineHeight: -1 }, { lineHeight: Infinity }, { lineHeight: NaN },
    { letterSpacing: Infinity }, { letterSpacing: NaN }, { letterSpacing: "wide" }]) {
    assert.equal(setTextStyle(created.document, created.node.id, patch).type, "Failure");
  }
  for (const patch of [{ lineHeight: 0 }, { lineHeight: -1 }, { letterSpacing: "wide" }]) {
    assert.equal(parseDocument(JSON.stringify({ ...created.document, children: [{ ...created.node, style: { ...created.node.style, ...patch } }] })).type, "Failure");
  }
  assert.equal(created.document.children[0].style.lineHeight, 1.4);
});

test("対応しないフォントや不正な太さは文書を変更せず拒否する", () => {
  const created = success(addNode(createDocument(), { type: "text", x: 0, y: 0, width: 100, height: 40 }));
  assert.equal(created.node.style.fontFamily, "default");
  assert.equal(created.node.style.fontWeight, 400);
  for (const patch of [{ fontFamily: "unknown" }, { fontWeight: 0 }, { fontWeight: 350 }, { fontWeight: 1000 }, { fontWeight: NaN }, { fontWeight: "700" }]) {
    assert.equal(setTextStyle(created.document, created.node.id, patch).type, "Failure");
  }
  for (const patch of [{ fontFamily: "unknown" }, { fontWeight: 350 }, { fontWeight: "700" }]) {
    assert.equal(parseDocument(JSON.stringify({ ...created.document, children: [{ ...created.node, style: { ...created.node.style, ...patch } }] })).type, "Failure");
  }
  assert.equal(findNode(created.document, created.node.id).style.fontWeight, 400);
});
