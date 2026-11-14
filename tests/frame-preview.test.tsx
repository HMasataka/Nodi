import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

import { frame, rectangle } from "./support/factories.ts";

test("プレビューはプリセット幅と解決済みフレームを表示する", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { FramePreview } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/FramePreview/FramePreview.tsx");
    const node = frame({ layoutMode: "horizontal", width: 390, height: 844,
      children: [rectangle({ id: "a", name: "見出し", width: 100, height: 20 })] });
    const markup = renderToStaticMarkup(createElement(FramePreview, { frame: node }));
    assert.match(markup, /class="file-button">320<\/button>/);
    assert.match(markup, /class="file-button is-active">390<\/button>/);
    assert.match(markup, /class="file-button">1440<\/button>/);
    assert.match(markup, /value="390"/);
    assert.match(markup, /transform:scale\(/);
    assert.match(markup, /aria-label="見出し"/);
  } finally {
    await vite.close();
  }
});
