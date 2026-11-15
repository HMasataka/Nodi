import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import type { DocumentNode } from "../src/document/types.ts";
import { resolveDocumentInstances } from "../src/document/instances.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

async function load() {
  const result = parseDocument(await readFile(new URL("../designs/nodi.nodi", import.meta.url), "utf8"));
  if (result.type === "Failure") assert.fail(String(result.error));
  return result.value;
}

test("デザイン文書の共通定義・参照・上書きを保存して再読込できる", async () => {
  const document = await load();
  const saved = serializeDocument(document);
  if (saved.type === "Failure") assert.fail(String(saved.error));
  assert.deepEqual(parseDocument(saved.value), { type: "Success", value: document });
  assert.ok(document.components.length > 20);
  assert.deepEqual(document.spacing.map(({ value }) => value), [0, 4, 8, 12, 16, 20, 24, 32]);
  const usages = new Map<string, number>();
  function visit(node: DocumentNode) {
    if (node.type === "instance") usages.set(node.componentRef, (usages.get(node.componentRef) ?? 0) + 1);
    if (node.type === "frame") {
      assert.ok(node.paddingRef && node.gapRef, `${node.name}: 共通余白を参照していません`);
      node.children.forEach(visit);
    }
  }
  document.children.forEach(visit);
  document.components.forEach(({ node }) => visit(node));
  for (const ref of ["header", "footer", "button", "primary", "input", "row", "token", "projectCard"])
    assert.ok((usages.get(ref) ?? 0) >= 2, `${ref} が共通化されていません`);
});

test("インスタンスと共通余白を解決した全画面で子要素が領域内に収まる", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  function visit(node: DocumentNode) {
    assert.notEqual(node.type, "instance", `${node.name}: 未解決の参照`);
    if (node.type !== "frame") return;
    for (const child of node.children) {
      assert.ok(child.x >= -0.01 && child.y >= -0.01 && child.x + child.width <= node.width + 0.01 && child.y + child.height <= node.height + 0.01,
        `${node.name} (${node.width}×${node.height}) から ${child.name} (${child.x},${child.y},${child.width},${child.height}) がはみ出しました`);
      visit(child);
    }
  }
  document.children.forEach(visit);
});

test("ポップオーバーは編集画面の入力欄に隣接し、画面間で共通シェルを保持する", async () => {
  const document = await load();
  const screens = new Map(document.children.map((node) => [node.id, node]));
  for (const id of ["screen_editor", "screen_spacing_picker", "screen_spacing_edit", "screen_instance", "screen_multi"]) {
    const screen = screens.get(id);
    assert.equal(screen?.type, "frame");
    if (screen?.type !== "frame") continue;
    for (const ref of ["header", "footer", "tools"])
      assert.ok(screen.children.some((node) => node.type === "instance" && node.componentRef === ref), `${id}: ${ref}`);
  }
  const resolved = resolveDocumentLayout(resolveDocumentInstances(document));
  const editor = resolved.children.find(({ id }) => id === "screen_spacing_picker");
  assert.equal(editor?.type, "frame");
  if (editor?.type !== "frame") return;
  const picker = editor.children.find(({ name }) => name === "Overlay / Spacing picker")!;
  assert.equal(picker.x + picker.width, 1420);
  const focus = editor.children.find((node) => node.name === "Selection outline" && node.width === 260)!;
  assert.equal(picker.y - (focus.y + focus.height), 8);
  assert.equal(screens.has("ds_reference_details"), false);
});

test("共通部品の左右余白とセクション末尾、カードの上下余白を揃える", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  function visit(node: DocumentNode) {
    if (node.type !== "frame") return;
    const first = node.children[0];
    const last = node.children[node.children.length - 1];
    if (first && last && ["Control / Value", "Control / Menu row", "Control / Reference field", "Navigation / Layer row", "Navigation / Selected row"].includes(node.name)) {
      assert.equal(first.x, node.width - last.x - last.width, `${node.name}: 左右の内側余白`);
    }
    if (first && last && node.name.startsWith("Content /")) {
      assert.equal(first.y, node.height - last.y - last.height, `${node.name}: 上下の内側余白`);
    }
    if (last && node.name.startsWith("Inspector / ") && !["Inspector / frame", "Inspector / instance", "Inspector / multi", "Inspector / icon", "Inspector / motion"].includes(node.name)) {
      assert.equal(last.y + last.height, node.height, `${node.name}: 不要な末尾余白`);
    }
    if (first && last && node.name.startsWith("Overlay /")) {
      assert.equal(first.y, 12);
      assert.equal(node.height - last.y - last.height, 12, `${node.name}: 下余白`);
    }
    node.children.forEach(visit);
  }
  document.children.forEach(visit);
});
