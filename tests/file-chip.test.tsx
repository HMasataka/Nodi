import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";

import { FileChip } from "../src/pages/editor/components/molecules/FileChip/FileChip.tsx";

const props = { fileName: "Website.nodi", filePath: "/tmp/Website.nodi", leftPanelOpen: true, onToggleLeftPanel: () => {} };

test("ファイル名を出し、未保存のときだけファイル名の直後に点を出す", () => {
  const saved = renderToStaticMarkup(createElement(FileChip, { ...props, isDirty: false }));
  assert.match(saved, /<div class="file-chip-trigger" title="\/tmp\/Website.nodi"><span class="file-chip-name">Website.nodi<\/span><svg/);
  assert.doesNotMatch(saved, /file-chip-unsaved/);
  const dirty = renderToStaticMarkup(createElement(FileChip, { ...props, isDirty: true }));
  assert.match(dirty, /<span class="file-chip-name">Website.nodi<\/span><span class="file-chip-unsaved" role="img" aria-label="未保存の変更があります"><\/span>/);
});

test("先頭のボタンで左パネルを開閉し、開閉の状態を aria-expanded と操作名で示す", () => {
  const open = renderToStaticMarkup(createElement(FileChip, { ...props, isDirty: false }));
  assert.match(open, /aria-expanded="true" type="button" class="icon-button" aria-label="左パネルを閉じる"/);
  const closed = renderToStaticMarkup(createElement(FileChip, { ...props, isDirty: false, leftPanelOpen: false }));
  assert.match(closed, /aria-expanded="false" type="button" class="icon-button" aria-label="左パネルを開く"/);
});

test("チップはキャンバスの列の中で左上から 12px に置く", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.canvas-chip \{[^}]*position: absolute;[^}]*top: var\(--space-12\);/);
  assert.match(css, /\.file-chip \{ left: var\(--space-12\); \}/);
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const stage = page.slice(page.indexOf('<div className="canvas-stage">'), page.indexOf("<Timeline"));
  assert.ok(stage.includes("<Canvas") && stage.includes("<FileChip"));
});
