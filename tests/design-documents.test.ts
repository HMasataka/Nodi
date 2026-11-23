import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import type { DocumentNode } from "../src/document/types.ts";
import { resolveDocumentInstances } from "../src/document/instances.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const screenIds = ["screen_panels_open", "screen_panels_closed", "screen_timeline_open", "screen_file_menu", "screen_assets", "screen_dialog", "screen_toast"];

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
  for (const ref of ["fileChip_false_false", "actionChip", "floatingTools_false", "animationRow", "artboard", "projectCard", "colorRow_false", "spacingRow"])
    assert.ok((usages.get(ref) ?? 0) >= 2, `${ref} が共通化されていません`);
});

test("メイン画面の案だけを並べ、すべて同じ選択状態を示す", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  assert.deepEqual(document.children.map(({ id }) => id), [...screenIds, "sheet_inspector", "sheet_dialogs"]);
  for (const screen of document.children.filter(({ id }) => screenIds.includes(id))) {
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

test("ファイルメニューはファイルのチップの直下に開き、チップは未保存の印を持つ", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  const screen = document.children.find((child) => child.id === "screen_file_menu");
  if (screen?.type !== "frame") assert.fail("screen_file_menu がありません");
  const chip = screen.children.find(({ name }) => name === "Canvas overlay / File")!;
  const menu = screen.children.find(({ name }) => name === "Canvas overlay / File menu")!;
  assert.deepEqual([menu.x, menu.y], [chip.x, chip.y + chip.height + 8]);
  const unsaved: string[] = [];
  const visit = (node: DocumentNode) => { if (node.name === "Unsaved") unsaved.push(node.id); if (node.type === "frame") node.children.forEach(visit); };
  visit(chip);
  assert.equal(unsaved.length, 1);
});

test("アセットはコンポーネント・色・余白の順に並べ、行の「⋯」メニューはパネルの右隣に行の上端をそろえて開く", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  const screen = document.children.find((child) => child.id === "screen_assets");
  if (screen?.type !== "frame") assert.fail("screen_assets がありません");
  const panel = screen.children.find(({ name }) => name === "Shell / Assets panel");
  if (panel?.type !== "frame") assert.fail("アセットのパネルがありません");
  assert.deepEqual([panel.x, panel.y, panel.width, panel.height], [0, 0, 240, 960]);
  assert.deepEqual(panel.children.filter(({ name }) => name !== "Divider").slice(1).map(({ name }) => name), ["コンポーネント", "色", "余白"]);
  const find = (node: DocumentNode, name: string, x = 0, y = 0): { x: number; y: number; node: DocumentNode } | null => {
    const position = { x: x + node.x, y: y + node.y, node };
    if (node.name === name) return position;
    if (node.type !== "frame") return null;
    for (const child of node.children) { const found = find(child, name, position.x, position.y); if (found) return found; }
    return null;
  };
  const highlighted = find(panel, "Assets / Component row / Highlighted");
  if (highlighted?.node.type !== "frame") assert.fail("強調した行がありません");
  const menu = screen.children.find(({ name }) => name === "Assets / Component menu")!;
  assert.deepEqual([menu.x, menu.y], [panel.x + panel.width + 4, highlighted.y]);
});

test("ダイアログは幕の上で画面の中央に開き、主となる操作を右端に置く", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  const screen = document.children.find((child) => child.id === "screen_dialog");
  if (screen?.type !== "frame") assert.fail("screen_dialog がありません");
  const [scrim, dialog] = screen.children.slice(-2);
  assert.deepEqual([scrim.name, scrim.x, scrim.y, scrim.width, scrim.height], ["Scrim", 0, 0, 1440, 960]);
  assert.ok(dialog.name.startsWith("Dialog /"));
  assert.deepEqual([dialog.x, dialog.y], [(1440 - dialog.width) / 2, (960 - dialog.height) / 2]);
  const sheet = document.children.find((child) => child.id === "sheet_dialogs");
  if (sheet?.type !== "frame") assert.fail("sheet_dialogs がありません");
  const dialogs = sheet.children.filter(({ name }) => name.startsWith("Dialog /"));
  assert.equal(dialogs.length, 4);
  for (const node of dialogs) {
    if (node.type !== "frame") assert.fail(node.name);
    const actions = node.children.at(-1);
    if (actions?.type !== "frame") assert.fail(`${node.name}: 操作の行がありません`);
    assert.equal(actions.children.at(-1)?.name, "Control / Button / Primary", node.name);
    assert.equal(actions.children.filter(({ name }) => name === "Control / Button / Primary").length, 1, node.name);
  }
});

test("エラーのトーストはキャンバスの右下の角に付き、作成ツールと重ならない", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  const screen = document.children.find((child) => child.id === "screen_toast");
  if (screen?.type !== "frame") assert.fail("screen_toast がありません");
  const toast = screen.children.find(({ name }) => name === "Canvas overlay / Toast")!;
  const tools = screen.children.find(({ name }) => name === "Canvas overlay / Tools")!;
  assert.deepEqual([1160 - toast.x - toast.width, 960 - toast.y - toast.height], [12, 12]);
  assert.ok(tools.x + tools.width <= toast.x || toast.y + toast.height <= tools.y, "作成ツールと重なっています");
});

test("タイムラインはパネルの間のキャンバス下端を占め、作成ツールはその上に付く", async () => {
  const document = resolveDocumentLayout(resolveDocumentInstances(await load()));
  const screen = document.children.find((child) => child.id === "screen_timeline_open");
  if (screen?.type !== "frame") assert.fail("screen_timeline_open がありません");
  const timeline = screen.children.find(({ name }) => name === "Timeline / Fade in")!;
  const tools = screen.children.find(({ name }) => name === "Canvas overlay / Tools")!;
  assert.deepEqual([timeline.x, timeline.x + timeline.width, timeline.y + timeline.height], [240, 1160, 960]);
  assert.equal(timeline.y - (tools.y + tools.height), 12);
});

test("プロパティは要素の種類によらず共通の節を同じ順で並べる", async () => {
  const document = await load();
  const kinds = ["frame", "text", "image", "rectangle", "path", "instance"];
  for (const kind of kinds) {
    const definition = document.components.find(({ id }) => id === `inspector_${kind}`);
    if (definition?.node.type !== "frame") assert.fail(`inspector_${kind} がありません`);
    const sections = definition.node.children.filter(({ name }) => name !== "Divider").map(({ name }) => name);
    assert.deepEqual([sections[0], sections[1]], ["Selection", "位置とサイズ"], kind);
    assert.deepEqual(sections.slice(-2), ["効果", "アニメーション"], kind);
  }
  const panel = document.components.find(({ id }) => id === "inspectorPanel")?.node;
  assert.ok(panel?.type === "frame" && panel.children.some((node) => node.type === "instance" && node.componentRef === "inspector_frame"));
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
