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
    assert.match(markup, /固定/);
    assert.match(markup, /伸縮/);
    assert.match(markup, /内容/);
  } finally {
    await vite.close();
  }
});
