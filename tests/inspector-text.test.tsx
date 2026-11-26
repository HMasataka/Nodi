import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { text } from "./support/factories.ts";
import { TextAppearance } from "../src/pages/editor/components/molecules/TextAppearance/TextAppearance.tsx";

test("書体・サイズと太さ・行高と字間・揃えを並べ、選択範囲の装飾をアイコンボタンで切り換える", () => {
  const noOp = () => {};
  const node = text({ style: { fontFamily: "serif", fontSize: 22, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0, textAlign: "center" } });
  const markup = renderToStaticMarkup(<TextAppearance node={node} onTextContent={noOp} onTextStyle={noOp} onTextMarkRange={noOp} />);
  const labels = [...markup.matchAll(/class="field-label-text"[^>]*>([^<]+)</g)].map(([, label]) => label);
  assert.deepEqual(labels.slice(0, 5), ["書体", "サイズ", "太さ", "行高", "字間"]);
  assert.match(markup, /value="serif" selected=""/);
  assert.match(markup, /value="600" selected=""/);
  assert.match(markup, /aria-checked="true"[^>]*>中央</);
  for (const label of ["太字", "下線", "コード", "選択範囲の文字色を戻す"]) assert.match(markup, new RegExp(`<button disabled=""[^>]*aria-label="${label}"`));
  assert.match(markup, /本文から文字を選択してください/);
});
