import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { paletteColor } from "./support/factories.ts";
import { AssetsPanel, type AssetsPanelProps, colorMenuEntries, parseAlphaInput, parseHexInput } from "../src/pages/editor/components/organisms/AssetsPanel/AssetsPanel.tsx";

const noop = () => {};
const props: AssetsPanelProps = {
  components: [], onPlaceInstance: noop, onRenameComponent: noop, onDuplicateComponent: noop, onRemoveComponent: noop,
  palette: [paletteColor({ id: "ink", name: "Ink", color: "#171717" }), paletteColor({ id: "veil", name: "Veil", color: "#ffffff80" })],
  onCreatePalette: noop, onImportPalette: noop, onRenamePalette: noop, onRecolorPalette: noop, onDuplicatePalette: noop, onDeletePalette: noop,
};

test("見出しに名前・件数・取り込み・追加を置き、行に見本・名前・HEX を並べる", () => {
  const markup = renderToStaticMarkup(createElement(AssetsPanel, props));
  const section = markup.slice(markup.indexOf('aria-label="色"'));
  assert.match(section, /<h2 class="asset-header-title">色<span class="asset-header-count">2<\/span><\/h2><div class="asset-header-actions"><button[^>]*aria-label="色を取り込む"[^]*?aria-label="色を追加"/);
  assert.match(section, /<span class="asset-swatch" style="background:#171717" aria-hidden="true"><\/span><button type="button" class="asset-row-name" aria-pressed="false">Ink<\/button><span class="asset-row-value">#171717<\/span>/);
  assert.match(section, /style="background:#ffffff80"[^]*?>Veil<\/button><span class="asset-row-value">#FFFFFF<\/span>/);
  assert.doesNotMatch(section, /asset-color-editor/);
});

test("色がないときは使い方を案内する", () => {
  assert.match(renderToStaticMarkup(createElement(AssetsPanel, { ...props, palette: [] })), /<span class="asset-header-count">0<\/span>[^]*名前付きの色を登録すると/);
});

test("HEX は # の有無を問わず6桁だけを受け付け、アルファを残す", () => {
  assert.equal(parseHexInput("#171717", "A3A3A3"), "#a3a3a3");
  assert.equal(parseHexInput("#17171780", "#e5e5e5"), "#e5e5e580");
  assert.equal(parseHexInput("#171717", "fff"), null);
  assert.equal(parseHexInput("#171717", "zzzzzz"), null);
});

test("アルファは 0〜255 の整数だけを受け付け、255 は不透明として省く", () => {
  assert.equal(parseAlphaInput("#171717", "128"), "#17171780");
  assert.equal(parseAlphaInput("#17171780", "255"), "#171717");
  assert.equal(parseAlphaInput("#171717", "0"), "#17171700");
  assert.equal(parseAlphaInput("#171717", "256"), null);
  assert.equal(parseAlphaInput("#171717", "1.5"), null);
  assert.equal(parseAlphaInput("#171717", ""), null);
});

test("色の「⋯」メニューに名前を変更・複製・削除を並べ、それぞれの操作を呼ぶ", () => {
  const calls: string[] = [];
  const entries = colorMenuEntries({ rename: () => calls.push("rename"), duplicate: () => calls.push("duplicate"), remove: () => calls.push("remove") });
  assert.deepEqual(entries.map((entry) => entry.type === "item" ? entry.label : entry.type), ["名前を変更", "複製", "separator", "削除"]);
  for (const entry of entries) if (entry.type === "item") entry.onSelect();
  assert.deepEqual(calls, ["rename", "duplicate", "remove"]);
});
