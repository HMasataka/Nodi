import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { nextSegmentIndex, Segmented } from "../src/pages/editor/components/atoms/Segmented/Segmented.tsx";

test("選んだ項目を aria-checked で示し、選んだ項目だけを Tab で止まる位置にする", () => {
  const markup = renderToStaticMarkup(createElement(Segmented, { label: "向き", value: "vertical", onChange: () => {},
    options: [{ value: "none", label: "なし" }, { value: "horizontal", label: "横" }, { value: "vertical", label: "縦" }] }));
  assert.match(markup, /^<div role="radiogroup" aria-label="向き" class="segmented">/);
  assert.match(markup, /<button type="button" role="radio" class="segmented-item" aria-checked="false" tabindex="-1">なし<\/button>/);
  assert.match(markup, /<button type="button" role="radio" class="segmented-item" aria-checked="true" tabindex="0">縦<\/button>/);
  assert.equal(markup.match(/tabindex="0"/g)?.length, 1);
});

test("矢印キーで前後へ、Home と End で端へ移り、端では回り込む", () => {
  assert.equal(nextSegmentIndex("ArrowRight", 0, 3), 1);
  assert.equal(nextSegmentIndex("ArrowDown", 2, 3), 0);
  assert.equal(nextSegmentIndex("ArrowLeft", 0, 3), 2);
  assert.equal(nextSegmentIndex("ArrowUp", 2, 3), 1);
  assert.equal(nextSegmentIndex("Home", 2, 3), 0);
  assert.equal(nextSegmentIndex("End", 0, 3), 2);
  assert.equal(nextSegmentIndex("Enter", 1, 3), null);
});
