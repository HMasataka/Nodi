import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Slider, sliderKeyValue, sliderRatio, sliderValueAt } from "../src/pages/editor/components/atoms/Slider/Slider.tsx";

const range = { min: 0, max: 200, step: 1 };

test("つまみの位置は値の割合と一致し、範囲の外は端に収める", () => {
  assert.equal(sliderRatio(50, range), 0.25);
  assert.equal(sliderRatio(-10, range), 0);
  assert.equal(sliderRatio(400, range), 1);
  assert.equal(sliderRatio(-50, { min: -100, max: 100, step: 1 }), 0.25);
  const markup = renderToStaticMarkup(createElement(Slider, { label: "明るさ", value: 150, defaultValue: 100, max: 200, onChange: () => {} }));
  assert.match(markup, /class="slider-knob" style="left:calc\(0\.75 \* \(100% - 12px\)\)"/);
  assert.match(markup, /class="slider-rail-filled" style="width:calc\(0\.75 \* \(100% - 12px\) \+ 6px\)"/);
  assert.match(markup, /role="slider" tabindex="0" aria-labelledby="([^"]+)" aria-valuemin="0" aria-valuemax="200" aria-valuenow="150" aria-valuetext="150"/);
});

test("既定値から変えたときだけ値を濃く出す", () => {
  const draw = (value: number) => renderToStaticMarkup(createElement(Slider, { label: "ぼかし", value, defaultValue: 0, onChange: () => {},
    format: (v: number) => `${v}px` }));
  assert.match(draw(0), /<output class="slider-value" for="[^"]+">0px<\/output>/);
  assert.match(draw(4), /<output class="slider-value is-changed" for="[^"]+">4px<\/output>/);
});

test("矢印は1刻み、PageUp・PageDown は10刻み、Home・End は端に動かし、範囲に収める", () => {
  assert.equal(sliderKeyValue("ArrowRight", 10, range), 11);
  assert.equal(sliderKeyValue("ArrowDown", 10, range), 9);
  assert.equal(sliderKeyValue("PageUp", 195, range), 200);
  assert.equal(sliderKeyValue("PageDown", 5, range), 0);
  assert.equal(sliderKeyValue("Home", 80, range), 0);
  assert.equal(sliderKeyValue("End", 80, range), 200);
  assert.equal(sliderKeyValue("Enter", 80, range), null);
  assert.equal(sliderKeyValue("ArrowUp", 0.3, { min: 0, max: 1, step: 0.1 }), 0.4);
});

test("レール上の位置を刻みにそろえた値に変える", () => {
  assert.equal(sliderValueAt(0.5, range), 100);
  assert.equal(sliderValueAt(0.333, range), 67);
  assert.equal(sliderValueAt(-1, range), 0);
  assert.equal(sliderValueAt(2, range), 200);
  assert.equal(sliderValueAt(0.26, { min: 0, max: 1, step: 0.05 }), 0.25);
});
