import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import type { DocumentNode } from "../src/document/types.ts";
import { resolveDocumentInstances } from "../src/document/instances.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const screenIds = ["screen_panels_open", "screen_panels_closed"];

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
  for (const ref of ["fileChip", "actionChip", "floatingTools", "artboard", "projectCard"])
    assert.ok((usages.get(ref) ?? 0) >= 2, `${ref} が共通化されていません`);
});

test("メイン画面の案だけを並べ、すべて同じ選択状態を示す", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  assert.deepEqual(document.children.map(({ id }) => id), screenIds);
  for (const screen of document.children) {
    assert.equal(screen.type, "frame");
    if (screen.type !== "frame") continue;
    assert.equal(screen.width, 1440);
    assert.equal(screen.height, 960);
    const artboard = screen.children.find((child) => child.type === "frame" && child.name === "Canvas / Selected work");
    const outline = screen.children.find(({ name }) => name === "Selection outline");
    assert.ok(artboard && outline, `${screen.name}: アートボードか選択枠がありません`);
    assert.deepEqual([outline.x - artboard.x, outline.y - artboard.y, outline.width, outline.height], [32, 104, 300, 308], `${screen.name}: 選択枠がカードと一致しません`);
  }
});

test("ファイルと操作のチップは、パネルの開閉に合わせてキャンバスの上端の角に付く", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  for (const [id, canvasLeft, canvasRight] of [["screen_panels_open", 240, 1160], ["screen_panels_closed", 0, 1440]] as const) {
    const screen = document.children.find((child) => child.id === id);
    if (screen?.type !== "frame") assert.fail(`${id} がありません`);
    const file = screen.children.find(({ name }) => name === "Canvas overlay / File")!;
    const actions = screen.children.find(({ name }) => name === "Canvas overlay / Actions")!;
    assert.deepEqual([file.x - canvasLeft, file.y], [12, 12], `${id}: ファイルのチップ`);
    assert.deepEqual([canvasRight - actions.x - actions.width, actions.y], [12, 12], `${id}: 操作のチップ`);
  }
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
