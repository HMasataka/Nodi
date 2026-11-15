import assert from "node:assert/strict";
import { test } from "vitest";

import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { createComponent, createDocument, duplicateComponent, removeComponent, renameComponent } from "../src/document/commands/index.ts";
import { document, frame, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("フレームと子要素からコンポーネントを作成し、子ツリーへ新しい ID を割り当てる", () => {
  const source = frame({ id: "frame1", children: [rectangle({ id: "rect1" }), text({ id: "label1" })] });
  const created = success(createComponent(document(source), { sourceId: "frame1", name: "ボタン" }));
  assert.match(created.component.id, /^cp_/);
  assert.equal(created.component.name, "ボタン");
  assert.notEqual(created.component.node.id, "frame1");
  assert.notEqual(created.component.node.children[0].id, "rect1");
  assert.notEqual(created.component.node.children[1].id, "label1");
  assert.deepEqual(created.document.components, [created.component]);
  // 元のフレームは文書ツリーに残り、変更されない。
  assert.equal(created.document.children[0].id, "frame1");
  assert.equal(created.document.children[0].name, "画面");
});

test("コンポーネントを名前変更・削除・複製できる", () => {
  const base = success(createComponent(document(frame({ id: "frame1" })), { sourceId: "frame1", name: "ボタン" }));

  const renamed = success(renameComponent(base.document, base.component.id, "主ボタン"));
  assert.equal(renamed.components[0].name, "主ボタン");

  const duplicated = success(duplicateComponent(renamed, base.component.id));
  assert.notEqual(duplicated.component.id, base.component.id);
  assert.equal(duplicated.component.name, "主ボタン のコピー");
  assert.notEqual(duplicated.component.node.id, base.component.node.id);
  assert.equal(duplicated.document.components.length, 2);

  const again = success(duplicateComponent(duplicated.document, base.component.id));
  assert.equal(again.component.name, "主ボタン のコピー 2");

  const removed = success(removeComponent(again.document, base.component.id));
  assert.equal(removed.components.length, 2);
});

test("不正な名前・存在しない ID・フレーム以外の作成元を拒否する", () => {
  const base = success(createComponent(
    document(frame({ id: "frame1" }), rectangle({ id: "rect1" })),
    { sourceId: "frame1", name: "ボタン" },
  )).document;
  assert.equal(createComponent(base, { sourceId: "frame1", name: "  " }).type, "Failure");
  assert.equal(createComponent(base, { sourceId: "missing", name: "ボタン" }).type, "Failure");
  assert.equal(createComponent(base, { sourceId: "rect1", name: "ボタン" }).type, "Failure");
  assert.equal(renameComponent(base, "missing", "名前").type, "Failure");
  assert.equal(renameComponent(base, "missing", "  ").type, "Failure");
  assert.equal(removeComponent(base, "missing").type, "Failure");
  assert.equal(duplicateComponent(base, "missing").type, "Failure");
});

test("空のコンポーネントは保存時に省略し、コンポーネントのない既存文書を読み込める", () => {
  assert.deepEqual(createDocument().components, []);
  const wire = JSON.parse(success(serializeDocument(document())));
  assert.equal(Object.hasOwn(wire, "components"), false);
  assert.deepEqual(success(parseDocument(JSON.stringify({ version: 1, children: [] }))), document());
});

test("コンポーネントを保存・再読込して round-trip する", () => {
  const original = success(createComponent(
    document(frame({ id: "frame1", children: [rectangle({ id: "rect1" })] })),
    { sourceId: "frame1", name: "カード" },
  )).document;
  const before = structuredClone(original);
  const json = success(serializeDocument(original));
  const wire = JSON.parse(json);
  assert.equal(wire.components.length, 1);
  assert.equal(wire.components[0].id, original.components[0].id);
  assert.equal(wire.components[0].name, "カード");
  assert.deepEqual(success(parseDocument(json)), original);
  assert.deepEqual(original, before);
  assert.equal(success(serializeDocument(success(parseDocument(json)))), json);
});

test("コンポーネントの ID 重複・子ツリーの ID 重複・空の名前・未知項目を拒否する", () => {
  const node = frame({ id: "croot", children: [text({ id: "ctext" })] });
  const valid = { id: "cp1", name: "ボタン", node };
  const invalid = [
    { version: 1, children: [], components: [valid, { ...valid, name: "別名" }] },
    { version: 1, children: [], components: [{ ...valid, name: "  " }] },
    { version: 1, children: [], components: [{ ...valid, extra: true }] },
    { version: 1, children: [], components: [{ ...valid, node: { ...node, children: [{ ...node.children[0], id: "croot" }] } }] },
  ];
  for (const doc of invalid) {
    assert.equal(parseDocument(JSON.stringify(doc)).type, "Failure", JSON.stringify(doc));
  }
});

test("コンポーネントの編集は Undo / Redo で保持される", () => {
  const original = document(frame({ id: "frame1" }));
  const withComponent = success(createComponent(original, { sourceId: "frame1", name: "ボタン" })).document;
  const history = commit(createHistory(original), withComponent);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, withComponent);
});

test("同じ値の名前変更は文書参照を変えない", () => {
  const created = success(createComponent(document(frame({ id: "frame1" })), { sourceId: "frame1", name: "ボタン" }));
  const base = created.document;
  assert.equal(success(renameComponent(base, created.component.id, "ボタン")), base);
});
