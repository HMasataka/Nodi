import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { IconButton } from "../src/pages/editor/components/atoms/IconButton/IconButton.tsx";
import { Menu, type MenuEntry, nextMenuIndex } from "../src/pages/editor/components/molecules/Menu/Menu.tsx";

const entries: MenuEntry[] = [
  { type: "item", label: "名前を変更", onSelect: () => {} },
  { type: "item", label: "複製", shortcut: "⌘D", onSelect: () => {} },
  { type: "separator" },
  { type: "item", label: "PNG に書き出す", disabled: true, onSelect: () => {} },
  { type: "item", label: "ID をコピー", onSelect: () => {} },
  { type: "note", content: "node_8f3a2c" },
];

const render = (defaultOpen: boolean) => renderToStaticMarkup(createElement(Menu, { label: "操作", entries, defaultOpen,
  trigger: (props) => createElement(IconButton, { ...props, icon: "more", label: "その他の操作" }) }));

test("閉じているときは開くボタンだけを出し、メニューの関係を aria で示す", () => {
  const markup = render(false);
  assert.match(markup, /<button aria-haspopup="menu" aria-expanded="false" aria-controls="[^"]+" type="button" class="icon-button" aria-label="その他の操作"/);
  assert.doesNotMatch(markup, /role="menu"/);
});

test("項目・区切り・ショートカット表記・補足の行を出す", () => {
  const markup = render(true);
  const [, controls] = markup.match(/aria-controls="([^"]+)"/) ?? [];
  assert.match(markup, /aria-expanded="true"/);
  assert.match(markup, new RegExp(`<div id="${controls}" role="menu" aria-label="操作" class="menu menu-start">`));
  assert.match(markup, /<button type="button" role="menuitem" class="menu-item" tabindex="-1"><span class="menu-item-label">複製<\/span><kbd class="menu-item-shortcut">⌘D<\/kbd><\/button>/);
  assert.match(markup, /<div role="separator" class="menu-separator"><\/div>/);
  assert.match(markup, /tabindex="-1" disabled=""><span class="menu-item-label">PNG に書き出す/);
  assert.match(markup, /<div role="presentation" class="menu-note">node_8f3a2c<\/div>/);
});

test("矢印キーは選べる項目だけを回り込みながら移り、Home と End で端へ移る", () => {
  const enabled = [0, 1, 4];
  assert.equal(nextMenuIndex("ArrowDown", 1, enabled), 4);
  assert.equal(nextMenuIndex("ArrowDown", 4, enabled), 0);
  assert.equal(nextMenuIndex("ArrowUp", 0, enabled), 4);
  assert.equal(nextMenuIndex("ArrowDown", -1, enabled), 0);
  assert.equal(nextMenuIndex("ArrowUp", -1, enabled), 4);
  assert.equal(nextMenuIndex("Home", 4, enabled), 0);
  assert.equal(nextMenuIndex("End", 0, enabled), 4);
  assert.equal(nextMenuIndex("Enter", 0, enabled), null);
  assert.equal(nextMenuIndex("ArrowDown", -1, []), null);
});
