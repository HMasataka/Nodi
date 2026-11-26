import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import type { DocumentNode } from "../src/document/types.ts";
import { ellipse, frame, image, instance, path, rectangle, text } from "./support/factories.ts";
import { Inspector, moreMenuEntries } from "../src/pages/editor/components/organisms/Inspector/Inspector.tsx";

const noOp = () => {};
const handlers = { onRename: noOp, onGeometry: noOp, onRotation: noOp, onOpacity: noOp, onShadow: noOp, onBlur: noOp, onMask: noOp,
  onTextContent: noOp, onTextStyle: noOp, onTextMarkRange: noOp, onShapeStyle: noOp, onFrameStyle: noOp, onFrameLayout: noOp,
  onSizeConstraint: noOp, onImageStyle: noOp, onPath: noOp, onDuplicate: noOp, onDelete: noOp, onReorder: noOp, onExportFrame: noOp,
  onCopyId: noOp, isExporting: false, onCreateComponent: noOp, onGoToDefinition: noOp, onSetOverride: noOp, onResetOverride: noOp, onDetach: noOp };

function sections(selected: DocumentNode, extra: Record<string, unknown> = {}): string[] {
  const markup = renderToStaticMarkup(<Inspector {...handlers} selected={selected} {...extra} />);
  return [...markup.matchAll(/<h3 id="inspector-[a-z]+" class="section-header-title">([^<]+)<\/h3>/g)].map(([, title]) => title);
}

test("どの種類でも、位置とサイズ・種類ごとの節・見た目の節・効果の順に並べ、持たない節は出さない", () => {
  assert.deepEqual(sections(frame()), ["位置とサイズ", "自動レイアウト", "見た目", "効果", "プレビュー"]);
  assert.deepEqual(sections(text()), ["位置とサイズ", "テキスト", "効果"]);
  assert.deepEqual(sections(image()), ["位置とサイズ", "画像", "角丸", "効果"]);
  assert.deepEqual(sections(rectangle()), ["位置とサイズ", "マスク", "見た目", "効果"]);
  assert.deepEqual(sections(ellipse()), ["位置とサイズ", "マスク", "見た目", "効果"]);
  assert.deepEqual(sections(path()), ["位置とサイズ", "パス", "見た目", "効果"]);
  assert.deepEqual(sections(instance({ componentRef: "c" }), { componentNode: frame() }), ["位置とサイズ", "コンポーネント", "上書き", "効果"]);
  assert.deepEqual(sections(rectangle(), { selectedCount: 2 }), ["2 個を選択中", "位置とサイズ", "マスク", "見た目", "効果"]);
});

test("見出しに種類と名前と「⋯」を出し、列から操作のボタンを外す", () => {
  const markup = renderToStaticMarkup(<Inspector {...handlers} selected={frame({ id: "f1", name: "Card" })} />);
  assert.match(markup, /<span class="inspector-kind">.*フレーム<\/span>/);
  assert.match(markup, /<input id="node-name"[^>]*value="Card"/);
  assert.match(markup, /aria-haspopup="menu"[^>]*aria-label="要素の操作"/);
  for (const label of ["複製", "最前面へ", "最背面へ", "コンポーネントを作成", "PNG に書き出す", "要素 ID"]) {
    assert.ok(!markup.includes(label), label);
  }
  for (const label of [">回転<", ">不透明度<", "全体ぼかし px"]) assert.ok(markup.includes(label), label);
});

test("「⋯」メニューから各操作を実行でき、フレームだけの操作はほかの種類では押せない", () => {
  const called: string[] = [];
  const actions = { rename: () => called.push("rename"), duplicate: () => called.push("duplicate"), remove: () => called.push("remove"),
    reorder: (direction: string) => called.push(direction), createComponent: () => called.push("component"),
    exportFrame: () => called.push("png"), copyId: () => called.push("copy") };
  const entries = moreMenuEntries(frame({ id: "node_8f3a2c" }), 1, false, actions);
  const items = entries.flatMap((entry) => entry.type === "item" ? [entry] : []);
  assert.deepEqual(items.map((item) => item.label),
    ["名前を変更", "複製", "削除", "最前面へ", "最背面へ", "コンポーネントを作成", "PNG に書き出す", "ID をコピー"]);
  for (const item of items) item.onSelect();
  assert.deepEqual(called, ["rename", "duplicate", "remove", "front", "back", "component", "png", "copy"]);
  const note = entries.at(-1);
  assert.equal(note?.type, "note");
  assert.match(renderToStaticMarkup(<>{note?.type === "note" ? note.content : null}</>), /node_8f3a2c/);
  const rect = moreMenuEntries(rectangle(), 2, false, actions).flatMap((entry) => entry.type === "item" ? [entry] : []);
  assert.deepEqual(rect.filter((item) => item.disabled).map((item) => item.label), ["コンポーネントを作成", "PNG に書き出す"]);
  assert.ok(rect.some((item) => item.label === "選択中を削除"));
  assert.ok(moreMenuEntries(frame(), 1, true, actions).some((item) => item.type === "item" && item.label === "PNG を生成中…" && item.disabled));
});
