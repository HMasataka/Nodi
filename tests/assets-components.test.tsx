import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { frame } from "./support/factories.ts";
import { AssetsPanel, type AssetsPanelProps, componentMenuEntries } from "../src/pages/editor/components/organisms/AssetsPanel/AssetsPanel.tsx";

const noop = () => {};
const components = [
  { id: "card", name: "Project card", node: frame({ id: "card-root" }) },
  { id: "nav", name: "Nav link", node: frame({ id: "nav-root" }) },
];
const props: AssetsPanelProps = { components, onPlaceInstance: noop, onRenameComponent: noop, onDuplicateComponent: noop, onRemoveComponent: noop,
  palette: [], onCreatePalette: noop, onImportPalette: noop, onRenamePalette: noop, onRecolorPalette: noop, onDuplicatePalette: noop, onDeletePalette: noop };
const render = (overrides: Partial<AssetsPanelProps> = {}) => renderToStaticMarkup(createElement(AssetsPanel, { ...props, ...overrides }));

test("見出しに名前と件数を置き、コンポーネントを行に並べる", () => {
  const markup = render();
  assert.match(markup, /<h2 class="asset-header-title">コンポーネント<span class="asset-header-count">2<\/span><\/h2>/);
  const names = [...markup.matchAll(/class="asset-row-name" aria-pressed="(?:true|false)">([^<]+)</g)].map(([, name]) => name);
  assert.deepEqual(names, ["Project card", "Nav link"]);
  assert.doesNotMatch(markup, /is-active/);
  assert.doesNotMatch(markup, /をキャンバスに配置/);
});

test("インスタンスの参照元の行を強調し、配置のボタンと「⋯」を出す", () => {
  const markup = render({ highlightedComponentId: "nav" });
  assert.match(markup, /class="asset-row component-row is-active"><svg[^]*?aria-pressed="true">Nav link<\/button><div class="asset-row-actions">/);
  assert.match(markup, /aria-label="Nav linkをキャンバスに配置"/);
  assert.match(markup, /aria-haspopup="menu"[^>]*aria-label="Nav linkの操作"/);
  assert.equal(markup.match(/is-active/g)?.length, 1);
});

test("コンポーネントがないときは作り方を案内する", () => {
  assert.match(render({ components: [] }), /<span class="asset-header-count">0<\/span>[^]*コンポーネントを作成/);
});

test("「⋯」メニューにキャンバスに配置・名前を変更・複製・削除を並べ、それぞれの操作を呼ぶ", () => {
  const calls: string[] = [];
  const entries = componentMenuEntries({ place: () => calls.push("place"), rename: () => calls.push("rename"),
    duplicate: () => calls.push("duplicate"), remove: () => calls.push("remove") });
  assert.deepEqual(entries.map((entry) => entry.type === "item" ? entry.label : entry.type), ["キャンバスに配置", "名前を変更", "複製", "separator", "削除"]);
  for (const entry of entries) if (entry.type === "item") entry.onSelect();
  assert.deepEqual(calls, ["place", "rename", "duplicate", "remove"]);
});

test("行の「⋯」メニューはパネルの右隣 8px に、開いたボタンの高さで開く", async () => {
  const { besidePanel } = await import("../src/pages/editor/components/organisms/AssetsPanel/AssetsPanel.tsx");
  const panel = { getBoundingClientRect: () => ({ right: 240 }) };
  const opener = { closest: (selector: string) => selector === "aside" ? panel : null, getBoundingClientRect: () => ({ top: 132, right: 220 }) };
  assert.deepEqual(besidePanel(opener as never), { top: 132, left: 248 });
});
