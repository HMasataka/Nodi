import assert from "node:assert/strict";
import { test } from "vitest";

import { addPaletteColor, createDocument, duplicatePaletteColor, removePaletteColor, renamePaletteColor, setPaletteColor } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, paletteColor, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("パレット色を作成・名前変更・色変更・削除できる", () => {
  const created = success(addPaletteColor(document(), { name: "アクセント", color: "#ff0000" }));
  assert.match(created.color.id, /^pc_/);
  assert.equal(created.color.name, "アクセント");
  assert.equal(created.color.color, "#ff0000");
  assert.deepEqual(created.document.palette, [created.color]);

  const renamed = success(renamePaletteColor(created.document, created.color.id, "主色"));
  assert.equal(renamed.palette[0].name, "主色");
  assert.equal(renamed.palette[0].color, "#ff0000");

  const recolored = success(setPaletteColor(renamed, created.color.id, "#00ff0080"));
  assert.equal(recolored.palette[0].color, "#00ff0080");

  const removed = success(removePaletteColor(recolored, created.color.id));
  assert.deepEqual(removed.palette, []);
});

test("同名の色を許可し、参照に使う ID は一意になる", () => {
  const first = success(addPaletteColor(document(), { name: "赤", color: "#ff0000" }));
  const second = success(addPaletteColor(first.document, { name: "赤", color: "#00ff00" }));
  assert.equal(second.document.palette.length, 2);
  assert.notEqual(second.document.palette[0].id, second.document.palette[1].id);
});

test("複製は新しい ID とコピー名を割り当て、色は引き継ぐ", () => {
  const source = success(addPaletteColor(document(), { name: "青", color: "#0000ff80" }));
  const duplicated = success(duplicatePaletteColor(source.document, source.color.id));
  assert.notEqual(duplicated.color.id, source.color.id);
  assert.equal(duplicated.color.name, "青 のコピー");
  assert.equal(duplicated.color.color, "#0000ff80");
  assert.equal(duplicated.document.palette.length, 2);

  const again = success(duplicatePaletteColor(duplicated.document, source.color.id));
  assert.equal(again.color.name, "青 のコピー 2");
});

test("不正な名前・色と存在しない ID を拒否する", () => {
  const base = success(addPaletteColor(document(), { name: "アクセント", color: "#ff0000" })).document;
  assert.equal(addPaletteColor(base, { name: "  ", color: "#ff0000" }).type, "Failure");
  assert.equal(addPaletteColor(base, { name: "色", color: "red" }).type, "Failure");
  assert.equal(addPaletteColor(base, { name: "色", color: "#12345" }).type, "Failure");
  assert.equal(renamePaletteColor(base, "missing", "名前").type, "Failure");
  assert.equal(renamePaletteColor(base, "missing", "  ").type, "Failure");
  assert.equal(setPaletteColor(base, "missing", "#000000").type, "Failure");
  assert.equal(setPaletteColor(base, "missing", "black").type, "Failure");
  assert.equal(removePaletteColor(base, "missing").type, "Failure");
  assert.equal(duplicatePaletteColor(base, "missing").type, "Failure");
});

test("空のパレットは保存時に省略し、パレットのない既存文書を読み込める", () => {
  assert.deepEqual(createDocument().palette, []);
  const wire = JSON.parse(success(serializeDocument(document())));
  assert.equal(Object.hasOwn(wire, "palette"), false);
  assert.deepEqual(success(parseDocument(JSON.stringify({ version: 1, children: [] }))), document());
});

test("パレットを保存・再読込して round-trip する", () => {
  const withFirst = success(addPaletteColor(document(), { name: "背景", color: "#ffffff" }));
  const original = success(addPaletteColor(withFirst.document, { name: "文字", color: "#272b2980" })).document;
  const before = structuredClone(original);
  const json = success(serializeDocument(original));
  assert.deepEqual(JSON.parse(json).palette, original.palette);
  assert.deepEqual(success(parseDocument(json)), original);
  assert.deepEqual(original, before);
  assert.equal(success(serializeDocument(success(parseDocument(json)))), json);
});

test("パレットの ID 重複・空の名前・不正な色・未知項目を拒否する", () => {
  const base = paletteColor();
  const invalid = [
    { version: 1, children: [], palette: [base, paletteColor({ id: base.id, name: "別名" })] },
    { version: 1, children: [], palette: [{ ...base, name: "  " }] },
    { version: 1, children: [], palette: [{ ...base, color: "red" }] },
    { version: 1, children: [], palette: [{ ...base, color: "#12345" }] },
    { version: 1, children: [], palette: [{ ...base, extra: true }] },
  ];
  for (const doc of invalid) {
    assert.equal(parseDocument(JSON.stringify(doc)).type, "Failure", JSON.stringify(doc));
  }
});

test("パレットの編集は Undo / Redo で保持される", () => {
  const original = document();
  const withColor = success(addPaletteColor(original, { name: "主色", color: "#ff0000" })).document;
  const history = commit(createHistory(original), withColor);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, withColor);
});

test("同じ値のパレット編集は文書参照を変えない", () => {
  const created = success(addPaletteColor(document(), { name: "主色", color: "#ff0000" }));
  const base = created.document;
  assert.equal(success(renamePaletteColor(base, created.color.id, "主色")), base);
  assert.equal(success(setPaletteColor(base, created.color.id, "#ff0000")), base);
});
