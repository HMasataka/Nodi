import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AssetsPanel, type AssetsPanelProps, nextSpacingName, parseSpacingInput, spacingMenuEntries } from "../src/pages/editor/components/organisms/AssetsPanel/AssetsPanel.tsx";

const noop = () => {};
const props: AssetsPanelProps = {
  components: [], onPlaceInstance: noop, onRenameComponent: noop, onDuplicateComponent: noop, onRemoveComponent: noop,
  palette: [], onCreatePalette: noop, onImportPalette: noop, onRenamePalette: noop, onRecolorPalette: noop, onDuplicatePalette: noop, onDeletePalette: noop,
  spacing: [{ id: "inset", name: "Card / Inset", value: 24 }, { id: "gap", name: "Card / Gap", value: 16 }],
  spacingUsages: { inset: 3 }, onCreateSpacing: noop, onRenameSpacing: noop, onSetSpacing: noop, onRemoveSpacing: noop,
};

test("見出しに名前・件数・追加を置き、行に名前と px 値を並べる", () => {
  const markup = renderToStaticMarkup(createElement(AssetsPanel, props));
  const section = markup.slice(markup.indexOf('aria-label="余白"'));
  assert.match(section, /<h2 class="asset-header-title">余白<span class="asset-header-count">2<\/span><\/h2><div class="asset-header-actions"><button[^>]*aria-label="余白を追加"/);
  assert.match(section, /aria-pressed="false">Card \/ Inset<\/button><span class="asset-row-value">24<\/span>/);
  assert.match(section, /aria-pressed="false">Card \/ Gap<\/button><span class="asset-row-value">16<\/span>/);
});

test("追加する余白の名前は使われていない番号を選ぶ", () => {
  assert.equal(nextSpacingName([]), "余白 1");
  assert.equal(nextSpacingName([{ id: "a", name: "余白 1", value: 8 }, { id: "b", name: "余白 3", value: 8 }]), "余白 2");
});

test("px 値は 0 以上の数だけを受け付ける", () => {
  assert.equal(parseSpacingInput("12"), 12);
  assert.equal(parseSpacingInput(" 4.5 "), 4.5);
  assert.equal(parseSpacingInput("0"), 0);
  assert.equal(parseSpacingInput("-1"), null);
  assert.equal(parseSpacingInput(""), null);
  assert.equal(parseSpacingInput("abc"), null);
});

test("「⋯」メニューに名前を変更・削除を並べ、参照されている余白には固定されることを添える", () => {
  const calls: string[] = [];
  const used = spacingMenuEntries(3, { rename: () => calls.push("rename"), remove: () => calls.push("remove") });
  assert.deepEqual(used.map((entry) => entry.type === "item" ? entry.label : entry.type), ["名前を変更", "separator", "削除", "note"]);
  const note = used.at(-1);
  assert.ok(note?.type === "note" && String(note.content).includes("3 箇所で使用中"));
  for (const entry of used) if (entry.type === "item") entry.onSelect();
  assert.deepEqual(calls, ["rename", "remove"]);
  assert.equal(spacingMenuEntries(0, { rename: noop, remove: noop }).some((entry) => entry.type === "note"), false);
});

test("プロパティから余白の編集を外す", async () => {
  const inspector = await readFile(new URL("../src/pages/editor/components/organisms/Inspector/Inspector.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(inspector, /SpacingTokenEditor|onCreateSpacingToken/);
});
