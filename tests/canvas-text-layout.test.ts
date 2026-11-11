import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

import { RENDER_COLORS } from "../src/rendering/colors.ts";
import { text } from "./support/factories.ts";

test("キャンバスのテキストは共通の計測結果を行として描き、空行も高さを保つ", async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false } });
  const previousDocument = globalThis.document;
  try {
    const { CanvasNode } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx");
    const ctx = { font: "", letterSpacing: "0px", measureText(text) { return { width: [...text].length * (8 + Number.parseFloat(this.letterSpacing)) }; } };
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    const noOp = () => {};
    const markup = renderToStaticMarkup(createElement(CanvasNode, {
      node: text({ id: "text", name: "説明", width: 52, height: 100,
        content: "Hello world\n\nABCDEF", color: "#000000", lineHeight: 1.5, letterSpacing: 0 }),
      selectedId: null,
      interaction: { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp },
    }));
    assert.equal((markup.match(/class="canvas-text-line"/g) ?? []).length, 4);
    assert.match(markup, />Hello<\/span><span class="canvas-text-line"[^>]*>world<\/span>/);
    assert.match(markup, />world<\/span><span class="canvas-text-line" style="height:24px"><\/span>/);
    assert.match(markup, />ABCDEF<\/span>/);
    const marked = renderToStaticMarkup(createElement(CanvasNode, {
      node: text({ id: "marked", name: "部分装飾", width: 180, height: 45,
        content: "Hello world code", color: "#1f2328",
        marks: [{ start: 6, end: 11, color: "#0969da", fontWeight: 700, underline: true }, { start: 12, end: 16, code: true }] }),
      selectedId: null,
      interaction: { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp },
    }));
    assert.equal((marked.match(/class="canvas-text-line"/g) ?? []).length, 1);
    assert.match(marked, /color:#0969da/);
    assert.match(marked, /font-weight:700/);
    assert.match(marked, /text-decoration-line:underline/);
    assert.match(marked, new RegExp(`background-color:${RENDER_COLORS.codeBackground}`));
    assert.match(marked, /font-family:ui-monospace/);
  } finally {
    globalThis.document = previousDocument;
    await vite.close();
  }
});
