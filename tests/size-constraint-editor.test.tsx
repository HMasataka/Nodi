import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

import { rectangle } from "./support/factories.ts";

test("サイズモード編集欄が幅・高さの現在値を表示する", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { SizeConstraintEditor } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/SizeConstraintEditor/SizeConstraintEditor.tsx");
    const noOp = () => {};
    const node = rectangle({ widthConstraint: { mode: "fill", min: 20 }, heightConstraint: { mode: "hug" } });
    const markup = renderToStaticMarkup(createElement(SizeConstraintEditor, { node, onChange: noOp }));
    assert.match(markup, /サイズモード/);
    assert.match(markup, /value="fill" selected=""/);
    assert.match(markup, /value="hug" selected=""/);
    assert.match(markup, /value="20"/);
    assert.match(markup, /幅最小/);
    assert.match(markup, /高さ最小/);
    const fixed = renderToStaticMarkup(createElement(SizeConstraintEditor, { node: rectangle(), onChange: noOp }));
    assert.doesNotMatch(fixed, /最小|最大/);
    assert.match(markup, /固定/);
    assert.match(markup, /伸縮/);
    assert.match(markup, /内容/);
  } finally {
    await vite.close();
  }
});

test("X・Y・W・H を2列で並べる", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { GeometryEditor } = await vite.ssrLoadModule("/src/pages/editor/components/molecules/GeometryEditor/GeometryEditor.tsx");
    const markup = renderToStaticMarkup(createElement(GeometryEditor, { node: rectangle({ x: 1, y: 2, width: 3, height: 4 }), onChange: () => {} }));
    assert.equal(markup.match(/class="field-pair"/g)?.length, 2);
    assert.deepEqual([...markup.matchAll(/class="field-label-text"[^>]*>([^<]+)<\/label><input[^>]*value="([^"]+)"/g)].map(([, label, value]) => `${label}=${value}`),
      ["X=1", "Y=2", "W=3", "H=4"]);
  } finally {
    await vite.close();
  }
});
