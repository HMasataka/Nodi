import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

import { reorderNode } from "../src/document/commands/index.ts";
import { document, frame as makeFrame, image as makeImage, instance as makeInstance, rectangle as makeRectangle, text as makeText } from "./support/factories.ts";
import { pathToString, roundedRectPath } from "../src/document/shapePath.ts";

test("分割後のキャンバス・レイヤー・プロパティが同じ要素を表示する", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { Canvas } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Canvas/Canvas.tsx");
    const { CanvasNode } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx");
    const { LayersPanel } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/LayersPanel/LayersPanel.tsx");
    const { Inspector } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Inspector/Inspector.tsx");
    const { RecoveryDialog } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/RecoveryDialog/RecoveryDialog.tsx");
    const { TextStyleEditor } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/TextStyleEditor/TextStyleEditor.tsx");
    const image = makeImage({ id: "image-1", name: "風景", x: 10, y: 20, width: 100, height: 80 });
    const frame = makeFrame({ id: "frame-1", style: { fill: "#aabbcc" }, children: [image] });
    const noOp = () => {};
    const text = makeText({ id: "heading", name: "見出し", width: 200, height: 48, content: "Hello",
      style: { fontSize: 24, color: "#1f2328", fontFamily: "system", fontWeight: 700, lineHeight: 1.75, letterSpacing: -0.5 } });
    const textMarkup = renderToStaticMarkup(createElement(CanvasNode, { node: text, selectedId: null,
      interaction: { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp } }));
    assert.match(textMarkup, /font-family:system-ui/);
    assert.match(textMarkup, /font-weight:700/);
    assert.match(textMarkup, /line-height:1.75/);
    assert.match(textMarkup, /letter-spacing:-0.5px/);
    const textStyleMarkup = renderToStaticMarkup(createElement(TextStyleEditor, { node: text, onChange: noOp }));
    assert.match(textStyleMarkup, /フォント/);
    assert.match(textStyleMarkup, /value="system" selected=""/);
    assert.match(textStyleMarkup, /value="700" selected=""/);
    assert.match(textStyleMarkup, /value="1.75"/);
    assert.match(textStyleMarkup, /value="-0.5"/);
    const canvas = renderToStaticMarkup(createElement(Canvas, {
      design: document(frame), selectedId: image.id,
      zoom: 1.2345, onZoom: noOp, drawTool: "select", drawing: null,
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp,
      onImageError: noOp,
    }));
    assert.match(canvas, /data-frame-id="frame-1"/);
    assert.match(canvas, /class="canvas-shape"/);
    assert.match(canvas, /fill="#aabbcc"/);
    assert.match(canvas, /class="frame-contents" style="overflow:hidden;border-radius:inherit"/);
    assert.match(canvas, /aria-label="風景"/);
    assert.match(canvas, /class="resize-handle"/);
    const multiCanvas = renderToStaticMarkup(createElement(Canvas, {
      design: document(frame), selectedId: image.id, selectedIds: [frame.id, image.id],
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
      design: document(frame), selectedId: image.id, zoom: 1, onZoom: noOp, drawTool: "select", drawing: null,
      guides: [{ orientation: "vertical", position: 110, from: 20, to: 150 }],
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp, onImageError: noOp,
    }));
    assert.match(guidedCanvas, /class="alignment-guide vertical" style="left:110px;top:20px;height:130px"/);
    const overflowing = renderToStaticMarkup(createElement(Canvas, {
      design: document({ ...frame, clipContent: false }), selectedId: frame.id,
      zoom: 1, onZoom: noOp, drawTool: "select", drawing: null,
      onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
      onPanPointerDown: noOp, onPanPointerMove: noOp, onPanPointerUp: noOp,
      onWorldPointerDown: noOp, onWorldPointerMove: noOp, onWorldPointerUp: noOp, onWorldPointerCancel: noOp,
      onImageError: noOp,
    }));
    assert.match(overflowing, /class="frame-contents" style="overflow:visible;border-radius:inherit"/);
    assert.match(overflowing, /class="frame-contents"[^]*<span class="resize-handle"/);

    const layers = renderToStaticMarkup(createElement(LayersPanel, { nodes: [frame], selectedId: image.id, onSelect: noOp }));
    assert.match(layers, /画面/);
    assert.match(layers, /風景/);
    assert.doesNotMatch(layers, /コンポーネント/);
    const instanceLayers = renderToStaticMarkup(createElement(LayersPanel, {
      nodes: [makeInstance({ id: "inst-1", name: "ボタンインスタンス", componentRef: "cp1" })],
      selectedId: null, onSelect: noOp,
    }));
    assert.match(instanceLayers, /インスタンス/);
    const instanceInspector = renderToStaticMarkup(createElement(Inspector, {
      selected: makeInstance({ id: "inst-1", name: "ボタンインスタンス", componentRef: "cp1" }),
      componentName: "ボタン",
      componentNode: makeFrame({ id: "cp-root", children: [makeText({ id: "label", name: "ラベル", content: "元" })] }),
      onRename: noOp, onGeometry: noOp, onTextContent: noOp, onTextStyle: noOp, onShapeStyle: noOp,
      onDuplicate: noOp, onDelete: noOp, onSetOverride: noOp, onResetOverride: noOp, onDetach: noOp,
    }));
    assert.match(instanceInspector, /インスタンス/);
    assert.match(instanceInspector, /オーバーライド/);
    assert.match(instanceInspector, /切り離す/);
    assert.match(instanceInspector, /ラベル/);
    const inspector = renderToStaticMarkup(createElement(Inspector, {
      selected: image, onRename: noOp, onGeometry: noOp, onTextContent: noOp, onTextStyle: noOp,
      onShapeStyle: noOp, onImageStyle: noOp, onDuplicate: noOp, onDelete: noOp,
    }));
    assert.match(inspector, /image-1/);
    assert.match(inspector, /フィット/);
    assert.match(inspector, /焦点 X/);
    assert.match(inspector, /焦点 Y/);
    assert.match(inspector, /埋め込まれています/);
    const textInspector = renderToStaticMarkup(createElement(Inspector, {
      selected: text, onRename: noOp, onGeometry: noOp, onTextContent: noOp, onTextStyle: noOp,
      onTextMarkRange: noOp, onShapeStyle: noOp, onDuplicate: noOp, onDelete: noOp,
    }));
    assert.match(textInspector, /選択範囲の装飾/);
    assert.match(textInspector, /本文から文字を選択してください/);
    assert.match(textInspector, /aria-pressed="false" disabled=""[^>]*>太字/);
    const back = makeRectangle({ id: "back", name: "背面", x: 10, y: 10, width: 80, height: 80,
      style: { fill: "#123456", stroke: null, cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 } } });
    const front = { ...back, id: "front", name: "前面", x: 20, y: 20 };
    const layered = document({ ...frame, children: [back, front] });
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

    const radii = { topLeft: 20, topRight: 10, bottomRight: 5, bottomLeft: 0 };
    const clippedImage = makeImage({ width: 15, height: 10, style: { cornerRadii: radii, fit: "contain", focalPoint: { x: 0.2, y: 0.8 } } });
    const clippedFrame = makeFrame({ width: 15, height: 10, style: { cornerRadii: radii }, children: [clippedImage] });
    const clipped = renderToStaticMarkup(createElement(CanvasNode, { node: clippedFrame, selectedId: null,
      interaction: { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp } }));
    const path = pathToString(roundedRectPath(0, 0, 15, 10, radii));
    assert.equal(clipped.split(`d="${path}"`).length - 1, 2);
    assert.match(clipped, /border-radius:10px 5px 2.5px 0px/);
    assert.match(clipped, /<clipPath id="[^"]+"><path d="/);
    assert.match(clipped, /<foreignObject[^>]+clip-path="url\(#[^)]+\)"/);
    assert.match(clipped, /<img[^>]+style="object-fit:contain;object-position:20% 80%"/);
    assert.match(renderToStaticMarkup(createElement(Inspector, { selected: clippedImage, onImageStyle: noOp,
      onRename: noOp, onGeometry: noOp, onTextContent: noOp, onTextStyle: noOp, onShapeStyle: noOp, onDuplicate: noOp, onDelete: noOp })), /左上[^]*右上[^]*右下[^]*左下/);
    assert.match(frameInspector, /左上[^]*右上[^]*右下[^]*左下/);


    const recovery = renderToStaticMarkup(createElement(RecoveryDialog, {
      status: { kind: "available", draft: { sourcePath: "/tmp/画面.nodi", document: document() } },
      onRestore: noOp, onDiscard: noOp,
    }));
    assert.match(recovery, /元のファイルは上書きされず/);
    assert.match(recovery, /編集を復元/);
    assert.match(recovery, /破棄して開始/);
  } finally {
    await vite.close();
  }
});
