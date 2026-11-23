import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";

import { shortcutLabel } from "../src/pages/editor/shortcuts.ts";
import { FileChip, type FileChipProps } from "../src/pages/editor/components/molecules/FileChip/FileChip.tsx";

const noop = () => {};
const props: FileChipProps = { fileName: "Website.nodi", filePath: "/tmp/Website.nodi", isDirty: false, isBusy: false, canUndo: true, canRedo: false,
  leftPanelOpen: true, onToggleLeftPanel: noop, onOpen: noop, onSave: noop, onImportSvg: async () => {}, onUndo: noop, onRedo: noop };
const render = (overrides: Partial<FileChipProps> = {}) => renderToStaticMarkup(createElement(FileChip, { ...props, ...overrides }));

test("ファイル名を出し、未保存のときだけファイル名の直後に点を出す", () => {
  const saved = render();
  assert.match(saved, /class="file-chip-trigger" title="\/tmp\/Website.nodi"><span class="file-chip-name">Website.nodi<\/span><svg/);
  assert.doesNotMatch(saved, /file-chip-unsaved/);
  assert.match(render({ isDirty: true }), /<span class="file-chip-name">Website.nodi<\/span><span class="file-chip-unsaved" role="img" aria-label="未保存の変更があります"><\/span>/);
});

test("先頭のボタンで左パネルを開閉し、開閉の状態を aria-expanded と操作名で示す", () => {
  assert.match(render(), /aria-expanded="true" type="button" class="icon-button" aria-label="左パネルを閉じる"/);
  assert.match(render({ leftPanelOpen: false }), /aria-expanded="false" type="button" class="icon-button" aria-label="左パネルを開く"/);
});

test("ファイル名のボタンでファイルメニューを開く", () => {
  assert.match(render(), /<button aria-haspopup="menu" aria-expanded="false" aria-controls="[^"]+" type="button" class="file-chip-trigger"/);
  assert.doesNotMatch(render(), /role="menu"/);
});

test("ファイルメニューに文書の情報と操作をデザインの順に並べ、表記はショートカットの実装と一致させる", () => {
  const markup = render({ defaultMenuOpen: true, isDirty: true });
  assert.match(markup, /<span class="file-menu-name">Website.nodi<\/span><span class="file-menu-path">\/tmp\/Website.nodi<\/span><span class="file-menu-status">未保存の変更があります<\/span>/);
  const labels = [...markup.matchAll(/<span class="menu-item-label">([^<]+)<\/span>/g)].map(([, label]) => label);
  assert.deepEqual(labels, ["開く…", "保存", "SVG パスを取り込む…", "元に戻す", "やり直す"]);
  const shortcuts = [...markup.matchAll(/<kbd class="menu-item-shortcut">([^<]+)<\/kbd>/g)].map(([, label]) => label);
  assert.deepEqual(shortcuts, [shortcutLabel("open"), shortcutLabel("save"), shortcutLabel("undo"), shortcutLabel("redo")]);
  assert.equal(markup.match(/role="separator"/g)?.length, 3);
});

test("実行できない項目は無効にする", () => {
  const disabledLabels = (markup: string) => [...markup.matchAll(/disabled=""><span class="menu-item-label">([^<]+)</g)].map(([, label]) => label);
  assert.deepEqual(disabledLabels(render({ defaultMenuOpen: true })), ["やり直す"]);
  assert.deepEqual(disabledLabels(render({ defaultMenuOpen: true, isBusy: true, canUndo: false, canRedo: true })), ["開く…", "保存", "元に戻す"]);
  assert.match(render({ defaultMenuOpen: true, filePath: null }), /<span class="file-menu-path">まだ保存されていません<\/span>/);
});

test("チップはキャンバスの列の中で左上から 12px に置く", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.canvas-chip \{[^}]*position: absolute;[^}]*top: var\(--space-12\);/);
  assert.match(css, /\.file-chip \{ left: var\(--space-12\); \}/);
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const stage = page.slice(page.indexOf('<div className="canvas-stage">'), page.indexOf("<Timeline"));
  assert.ok(stage.includes("<Canvas") && stage.includes("<FileChip"));
});
