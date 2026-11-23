import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";

import { frame, rectangle } from "./support/factories.ts";
import { layerIndent, LayersPanel } from "../src/pages/editor/components/organisms/LayersPanel/LayersPanel.tsx";

test("深さごとに 16px ずつ字下げする", () => {
  assert.deepEqual([0, 1, 2].map(layerIndent), [8, 24, 40]);
  const markup = renderToStaticMarkup(createElement(LayersPanel, {
    nodes: [frame({ id: "page", name: "ページ", children: [rectangle({ id: "card", name: "カード" })] })],
    selectedId: "card", onSelect: () => {}, onReorder: () => {},
  }));
  assert.match(markup, /class="layer-row" style="padding-left:8px" aria-pressed="false"><svg[^]*?<span class="layer-name">ページ<\/span>/);
  assert.match(markup, /class="layer-row is-selected" style="padding-left:24px" aria-pressed="true"><svg[^]*?<span class="layer-name">カード<\/span>/);
});

test("行は 28px 高で、選択中の行は淡い紫の地と濃い紫の文字にする", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.layer-row \{[^}]*height: 28px;[^}]*border-radius: var\(--radius-6\);/);
  assert.match(css, /\.layer-row\.is-selected \{\n {2}background: var\(--accent-soft\);\n {2}color: var\(--accent-ink\);/);
  assert.match(css, /--accent-soft: var\(--purple-050\);/);
  assert.match(css, /--accent-ink: var\(--purple-800\);/);
  assert.match(css, /\.layer-row\.is-selected \.icon \{ color: var\(--accent-strong\); \}/);
});
