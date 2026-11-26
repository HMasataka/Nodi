import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";

import { ActionChip } from "../src/pages/editor/components/molecules/ActionChip/ActionChip.tsx";

const props = { zoom: 1, rightPanelOpen: true, onToggleRightPanel: () => {}, previewing: false, canPreview: true, onTogglePreview: () => {} };

test("倍率をズームに合わせて百分率で出す", () => {
  assert.match(renderToStaticMarkup(createElement(ActionChip, props)), /<output class="action-chip-zoom" aria-label="倍率">100%<\/output>/);
  assert.match(renderToStaticMarkup(createElement(ActionChip, { ...props, zoom: 1.2345 })), />123%<\/output>/);
  assert.match(renderToStaticMarkup(createElement(ActionChip, { ...props, zoom: 0.25 })), />25%<\/output>/);
});

test("末尾のボタンで右パネルを開閉し、プレビューのアイコンはフレームを選んでいるときだけ押せ、プレビュー中は押された状態にする", () => {
  const open = renderToStaticMarkup(createElement(ActionChip, props));
  assert.match(open, /aria-expanded="true" type="button" class="icon-button" aria-label="右パネルを閉じる"/);
  assert.match(open, /<button title="プレビュー" type="button" class="icon-button" aria-label="プレビュー" aria-pressed="false"/);
  assert.match(renderToStaticMarkup(createElement(ActionChip, { ...props, canPreview: false })), /<button disabled=""[^>]*aria-label="プレビュー"/);
  assert.match(renderToStaticMarkup(createElement(ActionChip, { ...props, previewing: true, canPreview: false })), /aria-label="プレビューを終える"[^>]*aria-pressed="true"/);
  assert.match(renderToStaticMarkup(createElement(ActionChip, { ...props, rightPanelOpen: false })), /aria-label="右パネルを開く"/);
});

test("チップはキャンバスの列の中で右上から 12px に置く", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.action-chip \{ right: var\(--space-12\); \}/);
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const stage = page.slice(page.indexOf('<div className="canvas-stage">'), page.indexOf("<Timeline"));
  assert.ok(stage.includes("<ActionChip"));
  assert.doesNotMatch(page, /panel-toggles/);
});
