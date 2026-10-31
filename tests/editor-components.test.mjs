import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { createServer } from "vite";

test("分割後のキャンバス・レイヤー・プロパティが同じ要素を表示する", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { Canvas } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Canvas/Canvas.tsx");
    const { LayersPanel } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/LayersPanel/LayersPanel.tsx");
    const { Inspector } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Inspector/Inspector.tsx");
    const image = { id: "image-1", name: "風景", type: "image", x: 10, y: 20, width: 100, height: 80, source: "data:image/png;base64,aGVsbG8=" };
    const frame = { id: "frame-1", name: "画面", type: "frame", x: 0, y: 0, width: 300, height: 200, background: "#aabbcc", clipContent: true, children: [image] };
    const noOp = () => {};
    const canvas = renderToStaticMarkup(createElement(Canvas, {
      design: { version: 1, children: [frame] }, selectedId: image.id,
      zoom: 1, setZoom: noOp, drawTool: "select", drawing: null,
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp,
      onImageError: noOp,
    }));
    assert.match(canvas, /data-frame-id="frame-1"/);
    assert.match(canvas, /background:#aabbcc/);
    assert.match(canvas, /class="frame-contents" style="overflow:hidden"/);
    assert.match(canvas, /aria-label="風景"/);
    assert.match(canvas, /class="resize-handle"/);
    const overflowing = renderToStaticMarkup(createElement(Canvas, {
      design: { version: 1, children: [{ ...frame, clipContent: false }] }, selectedId: frame.id,
      zoom: 1, setZoom: noOp, drawTool: "select", drawing: null,
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp,
      onImageError: noOp,
    }));
    assert.match(overflowing, /class="frame-contents" style="overflow:visible"/);
    assert.match(overflowing, /class="frame-contents"[^]*<span class="resize-handle"/);

    const layers = renderToStaticMarkup(createElement(LayersPanel, { nodes: [frame], selectedId: image.id, onSelect: noOp }));
    assert.match(layers, /画面/);
    assert.match(layers, /風景/);
    const inspector = renderToStaticMarkup(createElement(Inspector, {
      selected: image, onRename: noOp, onGeometry: noOp, onTextContent: noOp, onTextStyle: noOp,
      onShapeStyle: noOp, onDuplicate: noOp, onDelete: noOp,
    }));
    assert.match(inspector, /image-1/);
    assert.match(inspector, /埋め込まれています/);
    const frameInspector = renderToStaticMarkup(createElement(Inspector, {
      selected: frame, onRename: noOp, onGeometry: noOp, onTextContent: noOp, onTextStyle: noOp,
      onShapeStyle: noOp, onFrameStyle: noOp, onDuplicate: noOp, onDelete: noOp,
      onExportFrame: noOp, isExporting: false,
    }));
    assert.match(frameInspector, /type="color" value="#aabbcc"/);
    assert.match(frameInspector, /はみ出しを表示/);
  } finally {
    await vite.close();
  }
});
