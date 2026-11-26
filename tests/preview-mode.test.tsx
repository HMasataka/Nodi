import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { frame, rectangle } from "./support/factories.ts";
import { PreviewStage, resolvePreviewFrame } from "../src/pages/editor/components/organisms/PreviewStage/PreviewStage.tsx";

test("選択中のフレームを左上の原点に置き直し、指定の幅で自動レイアウトを解いて描く", () => {
  const card = frame({ id: "card", name: "Card", x: 300, y: 80, width: 300, height: 200, layoutMode: "vertical", padding: 10,
    children: [rectangle({ id: "fill", width: 50, height: 20, widthConstraint: { mode: "fill" } })] });
  const resolved = resolvePreviewFrame(card, 390, []);
  assert.deepEqual([resolved.x, resolved.y, resolved.width], [0, 0, 390]);
  assert.equal(resolved.children[0].width, 370);
  const markup = renderToStaticMarkup(<PreviewStage frame={card} spacing={[]} onClose={() => {}} />);
  assert.match(markup, /<section class="preview-mode" aria-label="プレビュー">/);
  assert.match(markup, /class="canvas-chip preview-bar"><button type="button" class="icon-button" aria-label="プレビューを閉じる"/);
  assert.match(markup, /class="preview-caption">Card · 300 px</);
  assert.doesNotMatch(markup, /resize-handle|is-selected/);
});

test("プレビュー中は作成ツールを出さず、フレームを選んでいるときだけプレビューに入る", async () => {
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  assert.match(page, /const previewFrame = previewing && selected\?\.type === "frame" \? selected : null;/);
  assert.match(page, /\{!previewFrame && <FloatingTools /);
  assert.match(page, /\{previewFrame && <PreviewStage frame=\{previewFrame\}/);
});
