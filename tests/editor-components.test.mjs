import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

import { reorderNode } from "../src/document/commands/index.ts";

test("分割後のキャンバス・レイヤー・プロパティが同じ要素を表示する", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { Canvas } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Canvas/Canvas.tsx");
    const { CanvasNode } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx");
    const { LayersPanel } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/LayersPanel/LayersPanel.tsx");
    const { Inspector } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Inspector/Inspector.tsx");
    const { EditorToolbar } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/EditorToolbar/EditorToolbar.tsx");
    const { EditorStatus } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/EditorStatus/EditorStatus.tsx");
    const { RecoveryDialog } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/RecoveryDialog/RecoveryDialog.tsx");
    const { TextStyleEditor } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/TextStyleEditor/TextStyleEditor.tsx");
    const image = { id: "image-1", name: "風景", type: "image", x: 10, y: 20, width: 100, height: 80, source: "data:image/png;base64,aGVsbG8=" };
    const frame = { id: "frame-1", name: "画面", type: "frame", x: 0, y: 0, width: 300, height: 200, background: "#aabbcc", clipContent: true, children: [image] };
    const noOp = () => {};
    const text = { id: "heading", name: "見出し", type: "text", x: 0, y: 0, width: 200, height: 48,
      content: "Hello", fontSize: 24, color: "#1f2328", textAlign: "left", fontFamily: "system", fontWeight: 700 };
    const textMarkup = renderToStaticMarkup(createElement(CanvasNode, { node: text, selectedId: null,
      interaction: { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp } }));
    assert.match(textMarkup, /font-family:system-ui/);
    assert.match(textMarkup, /font-weight:700/);
    const textStyleMarkup = renderToStaticMarkup(createElement(TextStyleEditor, { node: text, onChange: noOp }));
    assert.match(textStyleMarkup, /フォント/);
    assert.match(textStyleMarkup, /value="system" selected=""/);
    assert.match(textStyleMarkup, /value="700" selected=""/);
    const canvas = renderToStaticMarkup(createElement(Canvas, {
      design: { version: 1, children: [frame] }, selectedId: image.id,
      zoom: 1.2345, onZoom: noOp, drawTool: "select", drawing: null,
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
    assert.match(canvas, /123%/);
    assert.ok(canvas.indexOf('class="canvas-scale"') > canvas.indexOf("</section>"));
    const multiCanvas = renderToStaticMarkup(createElement(Canvas, {
      design: { version: 1, children: [frame] }, selectedId: image.id, selectedIds: [frame.id, image.id],
      zoom: 1, onZoom: noOp, drawTool: "select", drawing: null,
      selection: { start: { x: 10, y: 20 }, end: { x: 120, y: 90 } },
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp, onImageError: noOp,
    }));
    assert.match(multiCanvas, /class="selection-preview"/);
    assert.match(multiCanvas, /class="canvas-frame is-selected"/);
    assert.match(multiCanvas, /class="canvas-image is-selected"/);
    const guidedCanvas = renderToStaticMarkup(createElement(Canvas, {
      design: { version: 1, children: [frame] }, selectedId: image.id, zoom: 1, onZoom: noOp, drawTool: "select", drawing: null,
      guides: [{ orientation: "vertical", position: 110, from: 20, to: 150 }],
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp, onImageError: noOp,
    }));
    assert.match(guidedCanvas, /class="alignment-guide vertical" style="left:110px;top:20px;height:130px"/);
    const overflowing = renderToStaticMarkup(createElement(Canvas, {
      design: { version: 1, children: [{ ...frame, clipContent: false }] }, selectedId: frame.id,
      zoom: 1, onZoom: noOp, drawTool: "select", drawing: null,
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
    const back = { id: "back", name: "背面", type: "rectangle", x: 10, y: 10, width: 80, height: 80, fill: "#123456", stroke: "#000000", strokeWidth: 0, cornerRadius: 0 };
    const front = { ...back, id: "front", name: "前面", x: 20, y: 20 };
    const layered = { version: 1, children: [{ ...frame, children: [back, front] }] };
    const layerMarkup = renderToStaticMarkup(createElement(LayersPanel, { nodes: layered.children, selectedId: null, onSelect: noOp, onReorder: noOp }));
    assert.ok(layerMarkup.indexOf("前面") < layerMarkup.indexOf("背面"));
    const multiLayers = renderToStaticMarkup(createElement(LayersPanel, { nodes: layered.children, selectedId: front.id, selectedIds: [back.id, front.id], onSelect: noOp, onReorder: noOp }));
    assert.equal((multiLayers.match(/aria-pressed="true"/g) ?? []).length, 2);
    const reordered = reorderNode(layered, back.id, "front").value;
    const reorderedMarkup = renderToStaticMarkup(createElement(Canvas, {
      design: reordered, selectedId: null, zoom: 1, onZoom: noOp, drawTool: "select", drawing: null,
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp, onImageError: noOp,
    }));
    assert.ok(reorderedMarkup.indexOf('aria-label="前面"') < reorderedMarkup.indexOf('aria-label="背面"'));
    const frameInspector = renderToStaticMarkup(createElement(Inspector, {
      selected: frame, onRename: noOp, onGeometry: noOp, onTextContent: noOp, onTextStyle: noOp,
      onShapeStyle: noOp, onFrameStyle: noOp, onDuplicate: noOp, onDelete: noOp,
      onExportFrame: noOp, isExporting: false,
    }));
    assert.match(frameInspector, /type="color" value="#aabbcc"/);
    assert.match(frameInspector, /はみ出しを表示/);

    const toolbar = renderToStaticMarkup(createElement(EditorToolbar, {
      fileName: "画面.nodi", filePath: "/tmp/画面.nodi", canUndo: true, canRedo: false, isBusy: false,
      onUndo: noOp, onRedo: noOp, onOpen: noOp, onSave: noOp, onCreate: noOp, onImportImage: noOp,
      drawTool: "select", onDrawToolChange: noOp,
    }));
    assert.match(toolbar, /title="\/tmp\/画面.nodi"/);
    assert.match(toolbar, /矩形を追加/);
    assert.match(toolbar, /楕円を描く/);
    assert.match(toolbar, /フレームを追加/);
    assert.match(toolbar, /画像ファイル/);
    assert.match(toolbar, /disabled=""[^>]*>やり直す/);

    assert.match(renderToStaticMarkup(createElement(EditorStatus, { selected: image, isDirty: true, filePath: null })), /未保存の変更/);
    const recovery = renderToStaticMarkup(createElement(RecoveryDialog, {
      status: { kind: "available", draft: { sourcePath: "/tmp/画面.nodi", document: { version: 1, children: [] } } },
      onRestore: noOp, onDiscard: noOp,
    }));
    assert.match(recovery, /元のファイルは上書きされません/);
    assert.match(recovery, /編集を復元/);
    assert.match(recovery, /破棄して開始/);
  } finally {
    await vite.close();
  }
});
