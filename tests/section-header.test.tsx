import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { iconPathData } from "../src/pages/editor/components/atoms/Icon/Icon.tsx";
import { SectionHeader } from "../src/pages/editor/components/molecules/SectionHeader/SectionHeader.tsx";

const pathOf = (name: "plus" | "minus") => `d="${iconPathData(name)}"`;

test("常にある節は記号を出さない", () => {
  const markup = renderToStaticMarkup(createElement(SectionHeader, { title: "位置とサイズ" }));
  assert.equal(markup, '<div class="section-header"><h3 class="section-header-title">位置とサイズ</h3></div>');
});

test("未設定の節と複数持てる節は＋、設定済みの節は−を、操作名の aria-label 付きで出す", () => {
  const add = renderToStaticMarkup(createElement(SectionHeader, { title: "効果", action: { kind: "add", label: "効果を追加", onClick: () => {} } }));
  assert.match(add, /<button type="button" class="icon-button section-header-action" aria-label="効果を追加" title="効果を追加">/);
  assert.ok(add.includes(pathOf("plus")));
  const remove = renderToStaticMarkup(createElement(SectionHeader, { title: "線", action: { kind: "remove", label: "線を削除", onClick: () => {} } }));
  assert.match(remove, /aria-label="線を削除"/);
  assert.ok(remove.includes(pathOf("minus")));
  assert.ok(!remove.includes(pathOf("plus")));
});
