import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Canvas } from "../src/pages/editor/components/organisms/Canvas/Canvas.tsx";
import { document } from "./support/factories.ts";
import { IDENTITY_TRANSFORM } from "../src/document/transform.ts";
import type { DrawingState, ShapeDrawTool } from "../src/pages/editor/types.ts";

const noop = () => {};
const props = { design: document(), selectedId: null, selectedIds: [], zoom: 1, onNodePointerDown: noop, onResizePointerDown: noop,
  onNodePointerMove: noop, onNodePointerUp: noop, onImageError: noop, onPanPointerDown: noop, onPanPointerMove: noop, onPanPointerUp: noop,
  onWorldPointerDown: noop, onWorldDoubleClick: noop, onWorldPointerMove: noop, onWorldPointerUp: noop, onWorldPointerCancel: noop };

function render(tool: ShapeDrawTool, end: { x: number; y: number }): string {
  const drawing: DrawingState = { pointerId: 1, tool, start: { x: 10, y: 20 }, end, parentId: null, parentTransform: IDENTITY_TRANSFORM };
  return renderToStaticMarkup(createElement(Canvas, { ...props, drawTool: tool, drawing }));
}

test("描いている途中は外接する枠に四隅のつまみと寸法の札を出す", () => {
  for (const tool of ["rectangle", "ellipse", "frame"] as const) {
    const markup = render(tool, { x: 130, y: 100 });
    assert.match(markup, /<div class="draw-preview" style="[^"]*width:120px;height:80px[;"]/, tool);
    assert.equal(markup.match(/class="resize-handle /g)?.length, 4, tool);
    assert.match(markup, /<span class="canvas-size-label" aria-hidden="true">120 × 80<\/span>/, tool);
  }
  assert.match(render("ellipse", { x: 130, y: 100 }), /class="draw-preview-shape is-ellipse"/);
});

test("ポインタを動かすと寸法の札が更新される", () => {
  assert.match(render("rectangle", { x: 60, y: 45 }), />50 × 25<\/span>/);
  assert.match(render("rectangle", { x: 210, y: 320 }), />200 × 300<\/span>/);
});
