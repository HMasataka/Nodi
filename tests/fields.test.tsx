import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Checkbox } from "../src/pages/editor/components/atoms/Checkbox/Checkbox.tsx";
import { SelectField } from "../src/pages/editor/components/atoms/SelectField/SelectField.tsx";
import { blurOnEnter, Field } from "../src/pages/editor/components/atoms/Field/Field.tsx";

const noop = () => {};

test("入力欄はラベルを入力にひも付け、値を下書きとして出す", () => {
  const markup = renderToStaticMarkup(createElement(Field, { label: "X", value: "120", onCommit: noop, inputMode: "decimal" }));
  const [, labelFor] = markup.match(/<label class="field-label-text" for="([^"]+)">X<\/label>/) ?? [];
  assert.ok(labelFor, markup);
  assert.match(markup, new RegExp(`<input inputMode="decimal" id="${labelFor}" spellCheck="false" value="120"/>`));
  assert.match(markup, /^<div class="field">/);
});

test("Enter で blur して確定に流し、ほかのキーでは blur しない", () => {
  let blurred = 0;
  const event = (key: string) => ({ key, currentTarget: { blur: () => { blurred += 1; } } }) as never;
  blurOnEnter(event("a"));
  assert.equal(blurred, 0);
  blurOnEnter(event("Enter"));
  assert.equal(blurred, 1);
});

test("選択式の入力欄はラベルをひも付け、右端に下向きの矢印を出す", () => {
  const markup = renderToStaticMarkup(createElement(SelectField, { label: "揃え", value: "center", onChange: noop,
    options: [{ value: "start", label: "左" }, { value: "center", label: "中央" }] }));
  const [, labelFor] = markup.match(/<label class="field-label-text" for="([^"]+)">揃え<\/label>/) ?? [];
  assert.ok(labelFor, markup);
  assert.match(markup, new RegExp(`<select id="${labelFor}">`));
  assert.match(markup, /<option value="center" selected="">中央<\/option>/);
  assert.match(markup, /class="icon select-field-arrow"/);
});

test("チェックボックスはラベルで包み、オンのときだけチェックを出す", () => {
  const on = renderToStaticMarkup(createElement(Checkbox, { label: "クリップ", checked: true, onChange: noop }));
  assert.match(on, /^<label class="checkbox"><input type="checkbox" checked=""\/><span class="checkbox-box" aria-hidden="true"><svg/);
  assert.match(on, /<span class="checkbox-label">クリップ<\/span><\/label>$/);
  const off = renderToStaticMarkup(createElement(Checkbox, { label: "クリップ", checked: false, onChange: noop }));
  assert.match(off, /<span class="checkbox-box" aria-hidden="true"><\/span>/);
});
