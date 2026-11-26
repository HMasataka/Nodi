import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Canvas } from "../src/pages/editor/components/organisms/Canvas/Canvas.tsx";
import { document, rectangle } from "./support/factories.ts";
import { gapBetween, snapMove } from "../src/pages/editor/snapping.ts";

test("そろえた相手との、ガイドと直交する向きの隙間を測る", () => {
  const left = { x: 56, y: 72, width: 120, height: 96 };
  const right = { x: 232, y: 72, width: 104, height: 96 };
  assert.deepEqual(gapBetween(right, left, "horizontal"), { from: 176, to: 232, at: 120, value: 56 });
  assert.deepEqual(gapBetween(left, right, "horizontal"), { from: 176, to: 232, at: 120, value: 56 });
  assert.deepEqual(gapBetween({ x: 0, y: 200, width: 50, height: 20 }, { x: 0, y: 100, width: 50, height: 40 }, "vertical"), { from: 140, to: 200, at: 25, value: 60 });
  assert.equal(gapBetween({ x: 150, y: 72, width: 104, height: 96 }, left, "horizontal"), null);
});

test("ドラッグでそろえたとき、ガイドに隣との間隔を添える", () => {
  const design = document(rectangle({ id: "a", x: 56, y: 72, width: 120, height: 96 }), rectangle({ id: "b", x: 232, y: 75, width: 104, height: 96 }));
  const snapped = snapMove(design, ["b"], 0, 0, 1);
  assert.equal(snapped.dy, -3);
  const horizontal = snapped.guides.find((guide) => guide.orientation === "horizontal");
  assert.deepEqual(horizontal?.distance, { from: 176, to: 232, at: 120, value: 56 });
});

test("ガイドを 1px の線で、間隔を線と札で描く", async () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(createElement(Canvas, { design: document(), selectedId: null, zoom: 1, drawTool: "select", drawing: null,
    guides: [{ orientation: "horizontal", position: 72, from: 56, to: 336, distance: { from: 176, to: 232, at: 120, value: 56 } }],
    onNodePointerDown: noop, onResizePointerDown: noop, onNodePointerMove: noop, onNodePointerUp: noop, onImageError: noop,
    onPanPointerDown: noop, onPanPointerMove: noop, onPanPointerUp: noop, onWorldPointerDown: noop, onWorldDoubleClick: noop,
    onWorldPointerMove: noop, onWorldPointerUp: noop, onWorldPointerCancel: noop }));
  assert.match(markup, /<div class="alignment-guide horizontal" style="top:72px;left:56px;width:280px"><\/div>/);
  assert.match(markup, /<div class="snap-distance is-horizontal" style="top:120px;left:176px;width:56px"><span class="snap-distance-label">56<\/span><\/div>/);
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.alignment-guide\.vertical \{ width: calc\(1px \/ var\(--canvas-zoom\)\); \}/);
  assert.match(css, /\.snap-distance-label \{[^}]*color: var\(--on-accent\);[^}]*background: var\(--accent-fill\);/);
});
