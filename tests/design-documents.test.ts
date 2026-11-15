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

test("追加パネルはグレースケールと等幅・余白の規則を維持する", async () => {
  const loaded = parseDocument(await readFile(new URL("../designs/nodi.nodi", import.meta.url), "utf8"));
  if (loaded.type !== "Success") assert.fail("読み込みに失敗しました");
  const nodes = new Map<string, DocumentNode>();
  const palette = new Set(["#ffffff", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#525252", "#404040", "#171717", "#000000"]);
  function visit(items: DocumentNode[]) {
    for (const node of items) {
      nodes.set(node.id, node);
      if (node.type === "text") assert.ok(palette.has(node.style.color.toLowerCase()), node.id);
      if ("fill" in node.style && node.style.fill !== null) {
        assert.equal(typeof node.style.fill, "string", node.id);
        assert.ok(palette.has((node.style.fill as string).toLowerCase()), node.id);
      }
      if ("stroke" in node.style && node.style.stroke) assert.ok(palette.has(node.style.stroke.color.toLowerCase()), node.id);
      if (node.type === "frame") {
        for (const child of node.children) {
          assert.ok(child.x >= 0 && child.y >= 0 && child.x + child.width <= node.width && child.y + child.height <= node.height,
            `${node.id} の領域から ${child.id} がはみ出しています`);
        }
        visit(node.children);
      }
    }
  }
  visit(loaded.value.children);
  const widthMode = nodes.get("ed_width_mode_bg")!;
  const heightMode = nodes.get("ed_height_mode_bg")!;
  assert.equal(widthMode.width, 124);
  assert.equal(heightMode.width, 124);
  assert.equal(heightMode.x - (widthMode.x + widthMode.width), 12);
  const presets = ["pv_320", "pv_390", "pv_768", "pv_1024", "pv_1440"].map((id) => nodes.get(id)!);
  for (const [index, preset] of presets.entries()) {
    assert.equal(preset.width, 60);
    assert.equal(preset.x, 24 + index * 60);
    assert.equal(preset.y, 80);
  }
  assert.equal(nodes.get("ed_export_label")!.y - (nodes.get("ed_details")!.y + nodes.get("ed_details")!.height), 16);
  for (const id of ["ed_status_hint", "ed_status_right", "ed_layers_help", "ed_export_bg"]) assert.equal(nodes.has(id), false);
  const preview = nodes.get("ds_preview")!;
  const stage = nodes.get("pv_stage")!;
  const page = nodes.get("pv_page")!;
  assert.ok(loaded.value.children.some((node) => node.id === preview.id));
  assert.equal(stage.width, preview.width);
  assert.ok(stage.width * stage.height > preview.width * preview.height * 0.8);
  assert.equal(page.width, 1440 * 0.8);
  assert.equal(page.height, 840 * 0.8);
  assert.equal(nodes.get("am_left_bg")!.width, 240);
  assert.equal(nodes.get("ds_timeline")!.x, 240);
  assert.ok(nodes.has("am_hover") && nodes.has("am_add_animation") && nodes.has("am_layer_title"));
  for (const id of ["ds_export", "ds_size", "ds_trigger", "pv_scroll_label", "pv_scroll_track", "pv_scroll_progress", "pv_scroll_thumb", "pv_scroll_value"]) assert.equal(nodes.has(id), false);
  for (const [leftId, rightId, gap] of [
    ["pv_back", "pv_title", 16], ["pv_preset_bg", "pv_width_label", 16],
    ["pv_width_label", "pv_width_value", 8], ["pv_fit", "pv_fit_value", 8],
    ["pv_actual", "pv_actual_value", 8], ["tl_easing", "tl_easing_arrow", 8],
    ["am_preview", "am_save_bg", 16],
  ] as const) {
    const left = nodes.get(leftId)!;
    const right = nodes.get(rightId)!;
    assert.equal(right.x - (left.x + left.width), gap, `${leftId} / ${rightId} の間隔`);
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
    ["ed_export_label", "ed_export_arrow"], ["ed_preview_label", "ed_preview_icon"],
    ["ed_width_mode", "ed_width_mode_arrow"], ["ed_height_mode", "ed_height_mode_arrow"],
    ["ed_motion_label", "ed_motion_icon"], ["ed_motion_label", "ed_motion_arrow"],
    ["tl_heading", "tl_play"], ["tl_heading", "tl_stop"], ["tl_heading", "tl_collapse"],
    ["tl_trigger", "tl_trigger_arrow"], ["tl_easing", "tl_easing_arrow"],
    ["pv_title", "pv_close"], ["pv_time", "pv_play"],
    ["am_layer_desktop", "am_layer_toggle1"], ["am_layer_work", "am_layer_toggle2"], ["am_layer_card", "am_layer_toggle3"],
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
