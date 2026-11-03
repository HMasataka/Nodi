import assert from "node:assert/strict";
import test from "node:test";

import { layoutTextLines } from "../src/rendering/textLayout.ts";
import { addNode, createDocument, findNode, setTextContent, setTextMarks } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("装飾範囲は一つの本文内に保存され、Undo / Redo と旧文書を維持する", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "Hello 👩‍💻 world\nNext", x: 0, y: 0, width: 240, height: 80 }));
  const marks = [{ start: 6, end: 11, code: true }, { start: 12, end: 17, color: "#0969da", underline: true, fontWeight: 700 }];
  const styled = success(setTextMarks(created.document, created.node.id, marks));
  assert.deepEqual(findNode(styled, created.node.id).marks, marks);
  assert.deepEqual(success(parseDocument(success(serializeDocument(styled)))), styled);
  const history = commit(createHistory(created.document), styled);
  assert.equal(findNode(undo(history).present, created.node.id).marks, undefined);
  assert.deepEqual(findNode(redo(undo(history)).present, created.node.id).marks, marks);
  assert.equal(success(parseDocument(success(serializeDocument(created.document)))).children[0].marks, undefined);
  marks[0].start = 0;
  assert.equal(findNode(styled, created.node.id).marks[0].start, 6);
});

test("重複・逆順・文字の途中・空の装飾・不正なスタイルを文書を変えず拒否する", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "A👩‍💻B", x: 0, y: 0, width: 100, height: 40 }));
  const invalid = [
    [{ start: 1, end: 3, color: "#123456" }],
    [{ start: 0, end: 4, underline: true }, { start: 1, end: 6, code: true }],
    [{ start: 6, end: 7, code: true }, { start: 0, end: 1, underline: true }],
    [{ start: 0, end: 0, code: true }],
    [{ start: 0, end: 1 }],
    [{ start: 0, end: 1, color: "red" }],
    [{ start: 0, end: 1, fontWeight: 350 }],
    [{ start: 0, end: 1, underline: false }],
  ];
  for (const marks of invalid) {
    assert.equal(setTextMarks(created.document, created.node.id, marks).type, "Failure");
    assert.equal(parseDocument(JSON.stringify({ ...created.document, children: [{ ...created.node, marks }] })).type, "Failure");
  }
  assert.equal(findNode(created.document, created.node.id).marks, undefined);
});

test("本文の挿入・置換・削除で変更箇所の前後の装飾範囲を維持する", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "A👩‍💻B world", x: 0, y: 0, width: 180, height: 40 }));
  const styled = success(setTextMarks(created.document, created.node.id, [
    { start: 1, end: 6, code: true }, { start: 8, end: 13, color: "#0969da" },
  ]));
  const inserted = success(setTextContent(styled, created.node.id, "Hi A👩‍💻B world"));
  assert.deepEqual(findNode(inserted, created.node.id).marks, [
    { start: 4, end: 9, code: true }, { start: 11, end: 16, color: "#0969da" },
  ]);
  const replaced = success(setTextContent(inserted, created.node.id, "Hi A🧑‍💻B world"));
  assert.deepEqual(findNode(replaced, created.node.id).marks, findNode(inserted, created.node.id).marks);
  const deleted = success(setTextContent(replaced, created.node.id, "Hi AB world"));
  assert.deepEqual(findNode(deleted, created.node.id).marks, [{ start: 6, end: 11, color: "#0969da" }]);
  assert.equal(success(parseDocument(success(serializeDocument(deleted)))).children[0].marks[0].start, 6);
});

test("改行と結合絵文字をまたぐ装飾は両方の行へ引き継ぐ", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "A👩‍💻\nB", x: 0, y: 0, width: 120, height: 60 }));
  const styled = success(setTextMarks(created.document, created.node.id, [{ start: 1, end: 8, color: "#0969da" }]));
  const ctx = { font: "", letterSpacing: "0px", measureText: (text) => ({ width: [...text].length * 8 }) };
  const lines = layoutTextLines(ctx, styled.children[0]).lines;
  assert.deepEqual(lines.map(({ fragments }) => fragments.map(({ text }) => text)), [["A", "👩‍💻"], ["B"]]);
  assert.equal(lines[0].fragments[1].mark.color, "#0969da");
  assert.equal(lines[1].fragments[0].mark.color, "#0969da");
});

test("装飾中への挿入はスタイルを継ぎ、太さの違いで行の折り返しも変わる", () => {
  const created = success(addNode(createDocument(), { type: "text", content: "Hello world", x: 0, y: 0, width: 95, height: 60 }));
  const marks = [{ start: 6, end: 11, fontWeight: 700 }];
  const styled = success(setTextMarks(created.document, created.node.id, marks));
  const ctx = { font: "", letterSpacing: "0px", measureText(text) { return { width: [...text].length * (this.font.startsWith("700 ") ? 10 : 8) }; } };
  assert.deepEqual(layoutTextLines(ctx, created.node).lines.map(({ fragments }) => fragments.map(({ text }) => text).join("")), ["Hello world"]);
  assert.deepEqual(layoutTextLines(ctx, styled.children[0]).lines.map(({ fragments }) => fragments.map(({ text }) => text).join("")), ["Hello", "world"]);

  const middle = success(setTextMarks(created.document, created.node.id, [{ start: 1, end: 4, color: "#0969da" }]));
  const inserted = success(setTextContent(middle, created.node.id, "HelXlo world"));
  assert.deepEqual(inserted.children[0].marks, [{ start: 1, end: 5, color: "#0969da" }]);
});
