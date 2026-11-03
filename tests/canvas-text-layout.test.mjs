import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

test("キャンバスのテキストは共通の計測結果を行として描き、空行も高さを保つ", async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false } });
  const previousDocument = globalThis.document;
  try {
    const { CanvasNode } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx");
    const ctx = { font: "", letterSpacing: "0px", measureText(text) { return { width: [...text].length * (8 + Number.parseFloat(this.letterSpacing)) }; } };
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    const noOp = () => {};
    const markup = renderToStaticMarkup(createElement(CanvasNode, {
      node: { id: "text", name: "説明", type: "text", x: 0, y: 0, width: 52, height: 100,
        content: "Hello world\n\nABCDEF", fontSize: 16, color: "#000000", textAlign: "left", lineHeight: 1.5, letterSpacing: 0 },
      selectedId: null,
      interaction: { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp },
    }));
    assert.equal((markup.match(/class="canvas-text-line"/g) ?? []).length, 4);
    assert.match(markup, />Hello<\/span><span class="canvas-text-line"[^>]*>world<\/span>/);
    assert.match(markup, />world<\/span><span class="canvas-text-line" style="height:24px"><\/span>/);
    assert.match(markup, />ABCDEF<\/span>/);
  } finally {
    globalThis.document = previousDocument;
    await vite.close();
  }
});
