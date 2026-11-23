import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Canvas } from "../src/pages/editor/components/organisms/Canvas/Canvas.tsx";
import { marqueeTargets } from "../src/pages/editor/geometry.ts";
import { document, rectangle } from "./support/factories.ts";

const design = document(rectangle({ id: "a", x: 0, y: 0, width: 40, height: 20 }), rectangle({ id: "b", x: 100, y: 60, width: 20, height: 20 }));

test("範囲選択の途中で、離したときに選ばれる要素を外接枠付きで返す", () => {
  assert.deepEqual(marqueeTargets(design, { start: { x: -10, y: -10 }, end: { x: 50, y: 30 } }).map(({ id }) => id), ["a"]);
  assert.deepEqual(marqueeTargets(design, { start: { x: 110, y: 70 }, end: { x: 30, y: 10 } }).map(({ id }) => id), ["a", "b"]);
  assert.deepEqual(marqueeTargets(design, { start: { x: 10, y: 10 }, end: { x: 12, y: 30 } }), []);
  assert.deepEqual(marqueeTargets(design, { start: { x: -10, y: -10 }, end: { x: 50, y: 30 } })[0].bounds, { x: 0, y: 0, width: 40, height: 20 });
});

test("ドラッグした範囲を枠と地で示し、掛かる要素に選択枠を出す", async () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(createElement(Canvas, { design, selectedId: null, zoom: 1, drawTool: "select", drawing: null,
    selection: { start: { x: -10, y: -10 }, end: { x: 50, y: 30 } },
    onNodePointerDown: noop, onResizePointerDown: noop, onNodePointerMove: noop, onNodePointerUp: noop, onImageError: noop,
    onPanPointerDown: noop, onPanPointerMove: noop, onPanPointerUp: noop, onWorldPointerDown: noop, onWorldDoubleClick: noop,
    onWorldPointerMove: noop, onWorldPointerUp: noop, onWorldPointerCancel: noop }));
  assert.match(markup, /<div class="marquee-hit" style="left:0;top:0;width:40px;height:20px"><\/div><div class="selection-preview" style="left:-10px;top:-10px;width:60px;height:40px"><\/div>/);
  assert.equal(markup.match(/marquee-hit/g)?.length, 1);
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.selection-preview \{[^}]*border: calc\(1px \/ var\(--canvas-zoom\)\) solid var\(--accent\);[^}]*background: var\(--marquee-fill\);/);
  assert.match(css, /--marquee-fill: color-mix\(in srgb, var\(--purple-500\) 6%, transparent\);/);
});
