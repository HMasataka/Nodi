import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ErrorToast } from "../src/pages/editor/components/molecules/ErrorToast/ErrorToast.tsx";

test("警告のアイコン・文言・閉じるボタンを並べる", () => {
  const markup = renderToStaticMarkup(createElement(ErrorToast, { message: "画像を読み込めませんでした: cover.png", onClose: () => {} }));
  assert.match(markup, /^<div class="error-toast" role="alert"><svg class="icon error-toast-icon"/);
  assert.match(markup, /<p class="error-toast-message">画像を読み込めませんでした: cover.png<\/p>/);
  assert.match(markup, /class="icon-button error-toast-close" aria-label="閉じる"/);
});

test("暗い地で、キャンバスの右下の角から 12px に付け、パネルの開閉に追従する", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.error-toast \{\n {2}position: absolute;\n {2}right: var\(--space-12\);\n {2}bottom: var\(--space-12\);/);
  assert.match(css, /\.error-toast \{[^}]*width: 280px;[^}]*background: var\(--toast-surface\);/);
  assert.match(css, /--toast-surface: var\(--grey-900\);/);
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const stage = page.slice(page.indexOf('<div className="canvas-stage">'), page.indexOf("<Timeline"));
  assert.ok(stage.includes("<ErrorToast"), "トーストをキャンバスの列の中に置く");
});
