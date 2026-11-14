import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveDocumentLayout } from "../src/document/layout.ts";
import { document, frame, rectangle } from "./support/factories.ts";

test("レイアウト編集欄が現在値を表示し、解決後のキャンバスへ反映する", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { FrameLayoutEditor } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/FrameLayoutEditor/FrameLayoutEditor.tsx");
    const { Canvas } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Canvas/Canvas.tsx");
    const noOp = () => {};
    const layout = frame({ layoutMode: "vertical", padding: 16, gap: 8, alignItems: "center", justifyContent: "space-between" });
    const markup = renderToStaticMarkup(createElement(FrameLayoutEditor, { node: layout, onChange: noOp }));
    assert.match(markup, /方向/);
    assert.match(markup, /value="vertical" selected=""/);
    assert.match(markup, /value="16"/);
    assert.match(markup, /value="8"/);
    assert.match(markup, /value="center" selected=""/);
    assert.match(markup, /value="space-between" selected=""/);

    const canvas = renderToStaticMarkup(createElement(Canvas, {
      design: resolveDocumentLayout(document(frame({
        layoutMode: "vertical", padding: 8, gap: 4, width: 100, height: 100,
        children: [rectangle({ id: "a", name: "上", width: 20, height: 10 }), rectangle({ id: "b", name: "下", width: 20, height: 10 })],
      }))),
      selectedId: null, zoom: 1, onZoom: noOp, drawTool: "select", drawing: null,
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp, onImageError: noOp,
    }));
    assert.match(canvas, /left:8px;top:8px;width:20px;height:10px/);
    assert.match(canvas, /left:8px;top:22px;width:20px;height:10px/);
  } finally {
    await vite.close();
  }
});
