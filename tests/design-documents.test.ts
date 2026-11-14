import assert from "node:assert/strict";
import { test } from "vitest";
import { readdir, readFile } from "node:fs/promises";

import type { DocumentNode } from "../src/document/types.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("デザイン文書を現行形式で開いて保存し直せる", async () => {
  const directory = new URL("../designs/", import.meta.url);
  for (const name of (await readdir(directory)).filter((name) =>
    name.endsWith(".nodi"),
  )) {
    const loaded = parseDocument(
      await readFile(new URL(name, directory), "utf8"),
    );
    assert.equal(loaded.type, "Success", `${name} を読み込めません`);
    if (loaded.type !== "Success") assert.fail("読み込みに失敗しました");
    const saved = serializeDocument(loaded.value);
    assert.equal(saved.type, "Success", `${name} を保存できません`);
    if (saved.type !== "Success") assert.fail("保存に失敗しました");
    assert.deepEqual(parseDocument(saved.value), loaded);
  }
});

test("エディタのラベルとアイコンの行中央を揃える", async () => {
  const loaded = parseDocument(await readFile(new URL("../designs/nodi.nodi", import.meta.url), "utf8"));
  if (loaded.type !== "Success") assert.fail("読み込みに失敗しました");
  const nodes = new Map<string, DocumentNode>();
  function visit(items: DocumentNode[]) {
    for (const node of items) {
      nodes.set(node.id, node);
      if (node.type === "frame") visit(node.children);
    }
  }
  visit(loaded.value.children);
  const pairs = [
    ["ed_brand", "ed_file_menu"], ["ed_layers_title", "ed_layers_more"],
    ["ed_inspector_name", "ed_inspector_more"], ["ed_tool_import", "ed_tool_import_plus"],
    ["ed_tool_import", "ed_tool_import_more"], ["ed_layout_align_value", "ed_layout_align_toggle"],
    ["ed_clip_label", "ed_clip_box"], ["ed_effects", "ed_effects_toggle"],
    ["ed_effects", "ed_effects_plus"], ["ed_details", "ed_details_toggle"], ["ed_export_label", "ed_export_icon"],
    ...["root", "header", "intro", "work", "active", "second", "footer", "other"].flatMap((name) =>
      [[`ed_layer_${name}`, `ed_layer_${name}_toggle`], [`ed_layer_${name}`, `ed_layer_${name}_icon`]]),
    ...["image", "title", "description"].map((name) => [`ed_layer_${name}`, `ed_layer_${name}_icon`]),
  ];
  for (const [labelId, iconId] of pairs) {
    const label = nodes.get(labelId);
    const icon = nodes.get(iconId);
    assert.ok(label?.type === "text" && icon, `${labelId} / ${iconId}`);
    // CanvasNode の文字内側余白2pxと1行目の行高から中央を算出。
    const center = label.y + 2 + label.style.fontSize * label.style.lineHeight / 2;
    assert.ok(Math.abs(center - (icon.y + icon.height / 2)) < 0.01, `${labelId} と ${iconId} の中央が不一致`);
  }
});
