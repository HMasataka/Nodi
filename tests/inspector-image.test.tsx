import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { DEFAULT_IMAGE_FILTERS } from "../src/document/types.ts";
import { image } from "./support/factories.ts";

import { FILTER_SLIDERS, filtersChanged, ImageAdjustments, ImageStyleEditor } from "../src/pages/editor/components/molecules/ImageStyleEditor/ImageStyleEditor.tsx";

const noOp = () => {};

test("フィットを切り換え部品で、焦点を % の入力欄で並べ、色調整への行を置く", () => {
  const node = image({ style: { fit: "contain", focalPoint: { x: 0.2, y: 0.75 } } });
  const markup = renderToStaticMarkup(<ImageStyleEditor node={node} onChange={noOp} onOpenAdjustments={noOp} />);
  assert.deepEqual([...markup.matchAll(/role="radio"[^>]*>([^<]+)</g)].map(([, label]) => label), ["切り抜き", "収める", "伸ばす"]);
  assert.match(markup, /aria-checked="true"[^>]*>収める</);
  assert.match(markup, />焦点 X<\/label><input[^>]*value="20"/);
  assert.match(markup, />焦点 Y<\/label><input[^>]*value="75"/);
  assert.match(markup, /class="link-row"><span>色調整<\/span>/);
});

test("色調整は6項目をスライダーで並べ、既定値から変えたときだけ戻す操作と濃い値を出す", () => {
  assert.deepEqual(FILTER_SLIDERS.map(({ label }) => label), ["明るさ", "コントラスト", "彩度", "グレースケール", "セピア", "色相"]);
  const initial = renderToStaticMarkup(<ImageAdjustments filters={DEFAULT_IMAGE_FILTERS} onChange={noOp} onBack={noOp} />);
  assert.equal(initial.match(/role="slider"/g)?.length, 6);
  assert.match(initial, /<button disabled=""[^>]*aria-label="既定値に戻す"/);
  assert.doesNotMatch(initial, /is-changed/);
  const changed = { ...DEFAULT_IMAGE_FILTERS, contrast: 1.2, hueRotate: -30 };
  assert.ok(filtersChanged(changed));
  const markup = renderToStaticMarkup(<ImageAdjustments filters={changed} onChange={noOp} onBack={noOp} />);
  assert.deepEqual([...markup.matchAll(/class="slider-value is-changed"[^>]*>([^<]+)</g)].map(([, value]) => value), ["120%", "-30°"]);
  assert.doesNotMatch(markup, /<button disabled=""[^>]*aria-label="既定値に戻す"/);
});
