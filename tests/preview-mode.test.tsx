import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { frame, rectangle } from "./support/factories.ts";
import { parsePreviewWidth, PREVIEW_WIDTHS, PreviewStage, resolvePreviewFrame } from "../src/pages/editor/components/organisms/PreviewStage/PreviewStage.tsx";

test("選択中のフレームを左上の原点に置き直し、指定の幅で自動レイアウトを解いて描く", () => {
  const card = frame({ id: "card", name: "Card", x: 300, y: 80, width: 300, height: 200, layoutMode: "vertical", padding: 10,
    children: [rectangle({ id: "fill", width: 50, height: 20, widthConstraint: { mode: "fill" } })] });
  const resolved = resolvePreviewFrame(card, 390, []);
  assert.deepEqual([resolved.x, resolved.y, resolved.width], [0, 0, 390]);
  assert.equal(resolved.children[0].width, 370);
  const markup = renderToStaticMarkup(<PreviewStage frame={card} spacing={[]} onClose={() => {}} />);
  assert.match(markup, /<section class="preview-mode" aria-label="プレビュー">/);
  assert.match(markup, /class="canvas-chip preview-bar">.*<button type="button" class="icon-button" aria-label="プレビューを閉じる"/);
  assert.match(markup, /class="preview-caption">Card · 300 px</);
  assert.doesNotMatch(markup, /resize-handle|is-selected/);
});

test("プレビュー中は作成ツールを出さず、フレームを選んでいるときだけプレビューに入る", async () => {
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  assert.match(page, /const previewFrame = previewing && selected\?\.type === "frame" \? selected : null;/);
  assert.match(page, /\{!previewFrame && <FloatingTools /);
  assert.match(page, /\{previewFrame && <PreviewStage frame=\{previewFrame\}/);
});

test("上中央に 320・390・768・1024・1440 の切り換えと幅の入力欄を置き、今の幅を選ぶ", () => {
  assert.deepEqual([...PREVIEW_WIDTHS], [320, 390, 768, 1024, 1440]);
  assert.equal(parsePreviewWidth("390"), 390);
  assert.equal(parsePreviewWidth("0"), null);
  assert.equal(parsePreviewWidth(""), null);
  const markup = renderToStaticMarkup(<PreviewStage frame={frame({ name: "Card", width: 390 })} spacing={[]} onClose={() => {}} />);
  assert.deepEqual([...markup.matchAll(/role="radio"[^>]*aria-checked="(true|false)"[^>]*>(\d+)</g)].map(([, checked, label]) => `${label}:${checked}`),
    ["320:false", "390:true", "768:false", "1024:false", "1440:false"]);
  assert.match(markup, />幅<\/label><input[^>]*value="390"/);
  const custom = renderToStaticMarkup(<PreviewStage frame={frame({ width: 500 })} spacing={[]} onClose={() => {}} />);
  assert.doesNotMatch(custom, /aria-checked="true"/);
  assert.match(custom, /tabindex="0">320</);
});
