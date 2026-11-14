import assert from "node:assert/strict";
import { test } from "vitest";

import { measureTextSize } from "../src/rendering/textLayout.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { document, frame, text } from "./support/factories.ts";

test("テキストの内容とフォントから必要な幅・高さを計測する", () => {
  const ctx = {
    font: "",
    letterSpacing: "0px",
    measureText: (value: string) => ({ width: [...value].length * 8 }),
  };
  const node = text({ content: "ABCD", style: { fontSize: 16, lineHeight: 1.5, letterSpacing: 0 } });
  assert.deepEqual(measureTextSize(ctx, node), { width: 4 * 8 + 4, height: 16 * 1.5 + 4 });
  // 幅を制限すると折り返して高さが増える
  assert.equal(measureTextSize(ctx, node, 20).height, 2 * 16 * 1.5 + 4);
});

test("hug は内容サイズで、fill は親幅へ伸ばして高さを折り返す", () => {
  const measure = (node: { type: string; content?: string; width: number; height: number }, wrapWidth?: number) => {
    if (node.type !== "text") return { width: node.width, height: node.height };
    const chars = (node.content ?? "").length;
    const contentWidth = chars * 10;
    const lines = wrapWidth === undefined ? 1 : Math.max(1, Math.ceil(contentWidth / Math.max(1, wrapWidth - 4)));
    return { width: contentWidth + 4, height: lines * 20 + 4 };
  };
  const hug = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", padding: 0, gap: 0, width: 200, height: 200,
    children: [text({ id: "t", content: "abc", widthConstraint: { mode: "hug" }, heightConstraint: { mode: "hug" } })],
  })), { measure });
  assert.deepEqual([hug.children[0].children[0].width, hug.children[0].children[0].height], [34, 24]);

  const fill = resolveDocumentLayout(document(frame({
    layoutMode: "horizontal", padding: 0, gap: 0, width: 100, height: 200,
    children: [text({ id: "t", content: "abcdefghij", widthConstraint: { mode: "fill" }, heightConstraint: { mode: "hug" } })],
  })), { measure });
  assert.deepEqual([fill.children[0].children[0].width, fill.children[0].children[0].height], [100, 44]);
});
