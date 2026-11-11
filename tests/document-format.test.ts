import assert from "node:assert/strict";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { corners, document, ellipse, frame, image, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { setFrameStyle, setNodeStyle } from "../src/document/commands/index.ts";

test("v1 の Wire 形式を再帰的に正規化し、既定値だけを保存から除く", () => {
  const original = document(frame({ children: [
    rectangle({ style: { fill: null, stroke: null, cornerRadii: corners(0) } }),
    ellipse({ style: { stroke: null } }), text(), image(),
    frame({ id: "nested", style: { fill: null }, clipContent: false }),
  ] }));
  const before = structuredClone(original);
  const json = success(serializeDocument(original));
  const wire = JSON.parse(json);
  assert.equal(wire.version, 1);
  const root = wire.children[0];
  assert.deepEqual(root.style, { fill: "#ffffff" });
  assert.equal(Object.hasOwn(root, "clipContent"), false);
  assert.deepEqual(root.children[0].style, { fill: null });
  assert.deepEqual(root.children[1].style, { fill: "#f3d9c8" });
  assert.deepEqual(root.children[2].style, { fontSize: 16, color: "#272b29", textAlign: "left" });
  assert.deepEqual(root.children[3].style, {});
  assert.equal(root.children[4].clipContent, false);
  assert.deepEqual(success(parseDocument(json)), original);
  assert.deepEqual(original, before);
  assert.equal(success(serializeDocument(success(parseDocument(json)))), json);
});

test("非既定値と明示的な null を保持し、ゼロ幅の線を null に変えない", () => {
  const original = document(frame({ clipContent: false, style: { fill: null, stroke: { color: "#123456", width: 0 },
    cornerRadii: { topLeft: 0, topRight: 2, bottomRight: 4, bottomLeft: 8 } }, children: [
    text({ style: { fontFamily: "monospace", fontWeight: 700, lineHeight: 2, letterSpacing: -1 } }),
  ] }));
  const json = success(serializeDocument(original));
  const { border: _border, ...wireStyle } = original.children[0].style;
  assert.deepEqual(JSON.parse(json).children[0].style, wireStyle);
  assert.deepEqual(success(parseDocument(json)), original);
  const explicit = document(rectangle({ style: { stroke: null, cornerRadii: corners(0) } }));
  assert.deepEqual(success(parseDocument(JSON.stringify(explicit))), explicit);
});

test("旧開発版の平坦な v1 と version 2 を拒否する", () => {
  const { style, ...base } = rectangle();
  const legacy = { ...base, fill: style.fill, stroke: "#d9bbaa", strokeWidth: 1, cornerRadius: 2 };
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [legacy] })).type, "Failure");
  assert.equal(parseDocument(JSON.stringify({ version: 2, children: [] })).type, "Failure");
});

test("ノード・style・stroke・cornerRadii・画像の器の未知項目を拒否する", () => {
  const box = rectangle();
  const invalidNodes = [
    { ...box, fill: "#ffffff" },
    { ...box, style: { ...box.style, cornerRadius: 2 } },
    { ...box, style: { ...box.style, stroke: { color: "#000000", width: 1, align: "outside" } } },
    { ...box, style: { ...box.style, cornerRadii: { ...corners(0), extra: 0 } } },
    { ...ellipse(), style: { ...ellipse().style, cornerRadii: corners(0) } },
    { ...text(), style: { ...text().style, fill: null } },
    { ...image(), style: { opacity: 1 } },
    { ...frame(), background: "#ffffff" },
  ];
  for (const node of invalidNodes) {
    const invalid = { version: 1, children: [node] };
    assert.equal(parseDocument(JSON.stringify(invalid)).type, "Failure");
    assert.equal(serializeDocument(invalid).type, "Failure");
  }
});

test("不足した必須スタイルと不正な入れ子値を既定値で隠さない", () => {
  const box = rectangle();
  for (const style of [undefined, {}, { ...box.style, fill: undefined }, { ...box.style, stroke: {} },
    { ...box.style, stroke: { color: "red", width: 1 } }, { ...box.style, stroke: { color: "#123456", width: -1 } },
    { ...box.style, cornerRadii: null }, { ...box.style, cornerRadii: { topLeft: 1 } },
    { ...box.style, cornerRadii: corners(-1) }]) {
    assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...box, style }] })).type, "Failure");
  }
});

test("塗りと線を null にする編集は Undo / Redo・保存で維持される", () => {
  const original = document(frame({ children: [rectangle(), ellipse()] }));
  let edited = success(setNodeStyle(original, "rectangle", { fill: null, stroke: null }));
  edited = success(setNodeStyle(edited, "ellipse", { fill: null, stroke: null }));
  edited = success(setFrameStyle(edited, "frame", { fill: null, stroke: { color: "#123456", width: 2 }, cornerRadii: corners(4) }));
  const history = commit(createHistory(original), edited);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, edited);
  assert.deepEqual(success(parseDocument(success(serializeDocument(edited)))), edited);
  assert.equal(edited.children[0].children[0].style.fill, null);
  assert.equal(edited.children[0].children[1].style.stroke, null);
  assert.equal(original.children[0].children[0].style.fill, "#f3d9c8");
});

test("MCP 用の入れ子 style を変更しても文書や履歴を変更しない", () => {
  const history = createHistory(document(rectangle()));
  const api = createAgentApi({ getDocument: () => history.present, getHistory: () => history, getSelectedId: () => null, apply: () => assert.fail("読み取り専用") });
  const reference = success(api.getElement("rectangle"));
  reference.style.stroke.width = 99;
  reference.style.cornerRadii.topLeft = 99;
  const actual = success(api.getElement("rectangle"));
  assert.equal(actual.style.stroke.width, 1);
  assert.equal(actual.style.cornerRadii.topLeft, 2);
  assert.equal(Object.hasOwn(actual, "fill"), false);
});

test("スタイルの省略パッチは既存値を維持し、入れ子入力を文書と共有しない", () => {
  const original = document(rectangle(), frame());
  assert.deepEqual(success(setNodeStyle(original, "rectangle", { fill: undefined, stroke: undefined, cornerRadii: undefined })), original);
  assert.deepEqual(success(setFrameStyle(original, "frame", { fill: undefined, clipContent: undefined })), original);
  const patch = { stroke: { color: "#123456", width: 3 }, cornerRadii: corners(7) };
  const edited = success(setNodeStyle(original, "rectangle", patch));
  patch.stroke.width = 99;
  patch.cornerRadii.topLeft = 99;
  assert.equal(edited.children[0].style.stroke.width, 3);
  assert.equal(edited.children[0].style.cornerRadii.topLeft, 7);
});
