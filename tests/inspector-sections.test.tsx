import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import type { DocumentNode } from "../src/document/types.ts";
import { Inspector } from "../src/pages/editor/components/organisms/Inspector/Inspector.tsx";
import { ellipse, frame, image, instance, path, rectangle, text } from "./support/factories.ts";

const noOp = () => {};
const handlers = { onRename: noOp, onGeometry: noOp, onRotation: noOp, onOpacity: noOp, onShadow: noOp, onBlur: noOp, onMask: noOp,
  onTextContent: noOp, onTextStyle: noOp, onTextMarkRange: noOp, onShapeStyle: noOp, onFrameStyle: noOp, onFrameLayout: noOp,
  onSizeConstraint: noOp, onImageStyle: noOp, onPath: noOp, onDuplicate: noOp, onDelete: noOp, onReorder: noOp, onExportFrame: noOp,
  isExporting: false, onCreateComponent: noOp, onGoToDefinition: noOp, onSetOverride: noOp, onResetOverride: noOp, onDetach: noOp };

function sections(selected: DocumentNode, extra: Record<string, unknown> = {}): string[] {
  const markup = renderToStaticMarkup(<Inspector {...handlers} selected={selected} {...extra} />);
  return [...markup.matchAll(/<h3 id="inspector-[a-z]+" class="section-header-title">([^<]+)<\/h3>/g)].map(([, title]) => title);
}

test("どの種類でも、位置とサイズ・種類ごとの節・見た目の節・効果の順に並べ、持たない節は出さない", () => {
  assert.deepEqual(sections(frame()), ["位置とサイズ", "自動レイアウト", "見た目", "効果", "操作"]);
  assert.deepEqual(sections(text()), ["位置とサイズ", "テキスト", "効果", "操作"]);
  assert.deepEqual(sections(image()), ["位置とサイズ", "画像", "角丸", "効果", "操作"]);
  assert.deepEqual(sections(rectangle()), ["位置とサイズ", "マスク", "見た目", "効果", "操作"]);
  assert.deepEqual(sections(ellipse()), ["位置とサイズ", "マスク", "見た目", "効果", "操作"]);
  assert.deepEqual(sections(path()), ["位置とサイズ", "パス", "見た目", "効果", "操作"]);
  assert.deepEqual(sections(instance({ componentRef: "c" }), { componentNode: frame() }), ["位置とサイズ", "コンポーネント", "上書き", "効果", "操作"]);
  assert.deepEqual(sections(rectangle(), { selectedCount: 2 }), ["2 個を選択中", "位置とサイズ", "マスク", "見た目", "効果", "操作"]);
});

test("見出しに種類と名前を出し、既存の操作を残す", () => {
  const markup = renderToStaticMarkup(<Inspector {...handlers} selected={frame({ id: "f1", name: "Card" })} />);
  assert.match(markup, /<span class="inspector-kind">.*フレーム<\/span>/);
  assert.match(markup, /<input id="node-name"[^>]*value="Card"/);
  for (const label of ["複製", "削除", "最前面へ", "最背面へ", "コンポーネントを作成", "PNG に書き出す", "回転 °", "不透明度 %", "全体ぼかし px"]) {
    assert.ok(markup.includes(label), label);
  }
});
