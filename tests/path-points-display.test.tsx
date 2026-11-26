import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { path } from "./support/factories.ts";

const noOp = () => {};
const interaction = { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp,
  onImageError: noOp, onPathPointPointerDown: noOp };
const node = path({ width: 100, height: 100, commands: [{ kind: "move", x: 0, y: 0 },
  { kind: "cubic", x1: 0.2, y1: 0, x2: 0.5, y2: 0.3, x: 0.5, y: 0.5 },
  { kind: "cubic", x1: 0.5, y1: 0.7, x2: 0.8, y2: 1, x: 1, y: 1 }] });

function render(selectedPathPoint: { nodeId: string; index: number } | null): string {
  return renderToStaticMarkup(<CanvasNode node={node} selectedId={node.id} interaction={{ ...interaction, selectedPathPoint }} />);
}

const controls = (markup: string) => [...markup.matchAll(/data-path-control="([a-z]+-\d)"/g)].map(([, id]) => id);

test("パスの点は 8px 角で描き、選んだ点だけ紫で塗る", () => {
  const markup = render({ nodeId: node.id, index: 1 });
  assert.match(markup, /<rect class="path-anchor" data-path-control="anchor-0" x="-4" y="-4" width="8" height="8"/);
  assert.match(markup, /<rect class="path-anchor is-selected" data-path-control="anchor-1"/);
  assert.equal(markup.match(/path-anchor is-selected/g)?.length, 1);
});

test("点を選ぶとその点のハンドルだけを出し、選んでいないときはすべて出す", () => {
  assert.deepEqual(controls(render(null)), ["in-1", "out-1", "in-2", "out-2", "anchor-0", "anchor-1", "anchor-2"]);
  assert.deepEqual(controls(render({ nodeId: node.id, index: 1 })), ["out-1", "in-2", "anchor-0", "anchor-1", "anchor-2"]);
  assert.deepEqual(controls(render({ nodeId: node.id, index: 0 })), ["in-1", "anchor-0", "anchor-1", "anchor-2"]);
  assert.deepEqual(controls(render({ nodeId: "other", index: 1 })), controls(render(null)));
  assert.match(render(null), /<circle data-path-control="in-1" cx="20" cy="0" r="3"/);
});

test("ハンドルは灰色の細い線、次の線分は薄い灰色で描く", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.path-anchor \{ stroke: var\(--accent\); fill: var\(--surface\); \}/);
  assert.match(css, /\.path-anchor\.is-selected \{ fill: var\(--accent\); \}/);
  assert.match(css, /\.path-handle line \{ stroke: var\(--handle-line\);/);
  assert.match(css, /\.pen-next-segment \{ stroke: var\(--pen-next-segment\); \}/);
});
