import assert from "node:assert/strict";
import { test } from "vitest";

import { resolveDocumentLayout } from "../src/document/layout.ts";
import { document, frame, rectangle } from "./support/factories.ts";

test("横並びは padding と gap に従って子を順に配置する", () => {
  const resolved = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", padding: 10, gap: 5, width: 200, height: 100,
    children: [rectangle({ id: "a", width: 50, height: 20 }), rectangle({ id: "b", width: 30, height: 30 })],
  })));
  const [a, b] = resolved.children[0].children;
  assert.deepEqual([a.x, a.y, a.width, a.height], [10, 10, 50, 20]);
  assert.deepEqual([b.x, b.y, b.width, b.height], [65, 10, 30, 30]);
});

test("縦並びは上から padding と gap に従って積む", () => {
  const resolved = resolveDocumentLayout(document(frame({
    layoutMode: "vertical", padding: 8, gap: 12, width: 100, height: 200,
    children: [rectangle({ id: "a", width: 40, height: 30 }), rectangle({ id: "b", width: 60, height: 50 })],
  })));
  const [a, b] = resolved.children[0].children;
  assert.deepEqual([a.x, a.y, a.width, a.height], [8, 8, 40, 30]);
  assert.deepEqual([b.x, b.y, b.width, b.height], [8, 50, 60, 50]);
});

test("主軸の fill は残りの幅を分け合う", () => {
  const resolved = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", padding: 0, gap: 0, width: 100, height: 50,
    children: [rectangle({ id: "fixed", width: 20, height: 10 }),
      rectangle({ id: "fill", widthConstraint: { mode: "fill" }, height: 10 })],
  })));
  const [fixed, fill] = resolved.children[0].children;
  assert.deepEqual([fixed.x, fixed.width], [0, 20]);
  assert.deepEqual([fill.x, fill.width], [20, 80]);
});

test("交差軸の fill は親の内寸まで伸びる", () => {
  const resolved = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", padding: 4, gap: 0, width: 100, height: 50,
    children: [rectangle({ id: "fill", width: 20, heightConstraint: { mode: "fill" } })],
  })));
  const [fill] = resolved.children[0].children;
  assert.deepEqual([fill.y, fill.height], [4, 42]);
});

test("alignItems は交差軸の整列を決める", () => {
  const base = { layoutMode: "horizontal" as const, padding: 0, gap: 0, width: 100, height: 50,
    children: [rectangle({ id: "a", width: 20, height: 10 })] };
  assert.equal(resolveDocumentLayout(document(frame({ ...base, alignItems: "start" }))).children[0].children[0].y, 0);
  assert.equal(resolveDocumentLayout(document(frame({ ...base, alignItems: "center" }))).children[0].children[0].y, 20);
  assert.equal(resolveDocumentLayout(document(frame({ ...base, alignItems: "end" }))).children[0].children[0].y, 40);
});

test("justifyContent は主軸の余白分配を決める", () => {
  const base = { layoutMode: "horizontal" as const, padding: 0, gap: 0, width: 100, height: 50,
    children: [rectangle({ id: "a", width: 20, height: 10 })] };
  assert.equal(resolveDocumentLayout(document(frame({ ...base, justifyContent: "start" }))).children[0].children[0].x, 0);
  assert.equal(resolveDocumentLayout(document(frame({ ...base, justifyContent: "center" }))).children[0].children[0].x, 40);
  assert.equal(resolveDocumentLayout(document(frame({ ...base, justifyContent: "end" }))).children[0].children[0].x, 80);
});

test("justifyContent: space-between は子の間に余白を均等に配る", () => {
  const resolved = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", justifyContent: "space-between", padding: 0, gap: 0, width: 100, height: 50,
    children: [rectangle({ id: "a", width: 10, height: 10 }), rectangle({ id: "b", width: 10, height: 10 }),
      rectangle({ id: "c", width: 10, height: 10 })],
  })));
  const [a, b, c] = resolved.children[0].children;
  assert.deepEqual([a.x, b.x, c.x], [0, 45, 90]);
});

test("min / max は解決後のサイズを制限する", () => {
  const resolved = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", padding: 0, gap: 0, width: 100, height: 50,
    children: [rectangle({ id: "a", widthConstraint: { mode: "fill", min: 50, max: 60 }, height: 10 })],
  })));
  assert.equal(resolved.children[0].children[0].width, 60);
});

test("入れ子フレームは解決後のサイズで再帰的にレイアウトされる", () => {
  const inner = frame({ id: "inner", layoutMode: "vertical", padding: 0, gap: 0,
    widthConstraint: { mode: "fill" }, heightConstraint: { mode: "fill" },
    children: [rectangle({ id: "a", width: 10, height: 10 }), rectangle({ id: "b", width: 10, height: 10 })] });
  const resolved = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", padding: 0, gap: 0, width: 100, height: 40, children: [inner],
  })));
  const outer = resolved.children[0];
  assert.deepEqual([outer.children[0].width, outer.children[0].height], [100, 40]);
  const [a, b] = outer.children[0].children;
  assert.deepEqual([a.x, a.y], [0, 0]);
  assert.deepEqual([b.x, b.y], [0, 10]);
});

test("layoutMode: none は子の座標を維持し、内部の自動レイアウトだけ解決する", () => {
  const resolved = resolveDocumentLayout(document(frame({
    id: "outer", layoutMode: "none", width: 200, height: 200,
    children: [rectangle({ id: "static", x: 30, y: 40, width: 10, height: 10 }),
      frame({ id: "auto", x: 50, y: 60, layoutMode: "horizontal", padding: 0, gap: 0, width: 100, height: 50,
        children: [rectangle({ id: "in", width: 20, height: 10 })] })],
  })));
  const outer = resolved.children[0];
  assert.deepEqual([outer.children[0].x, outer.children[0].y], [30, 40]);
  const auto = outer.children[1];
  assert.deepEqual([auto.x, auto.y], [50, 60]);
  assert.deepEqual([auto.children[0].x, auto.children[0].y], [0, 0]);
});

test("入力の文書は変更しない", () => {
  const original = document(frame({
    layoutMode: "horizontal", padding: 4, gap: 2, width: 100, height: 50,
    children: [rectangle({ id: "a", width: 20, height: 10 })],
  }));
  const before = structuredClone(original);
  resolveDocumentLayout(original);
  assert.deepEqual(original, before);
});
