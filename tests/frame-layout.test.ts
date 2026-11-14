import assert from "node:assert/strict";
import { test } from "vitest";

import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, frame, rectangle, success } from "./support/factories.ts";
import { type FrameLayoutPatch, setFrameLayout } from "../src/document/commands/index.ts";

test("フレームのレイアウト設定を変更でき、Undo / Redo できる", () => {
  const original = document(frame());
  const edited = success(setFrameLayout(original, "frame",
    { layoutMode: "vertical", padding: 16, gap: 8, alignItems: "center", justifyContent: "space-between" }));
  const node = edited.children[0];
  assert.equal(node.type, "frame");
  assert.deepEqual({ layoutMode: node.layoutMode, padding: node.padding, gap: node.gap, alignItems: node.alignItems, justifyContent: node.justifyContent },
    { layoutMode: "vertical", padding: 16, gap: 8, alignItems: "center", justifyContent: "space-between" });
  const history = commit(createHistory(original), edited);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, edited);
});

test("レイアウト設定は既存値を維持し、変更なしなら文書を変えない", () => {
  const original = document(frame({ layoutMode: "horizontal", padding: 4, gap: 2 }));
  const partial = success(setFrameLayout(original, "frame", { padding: 10 }));
  assert.equal(partial.children[0].type === "frame" && partial.children[0].layoutMode, "horizontal");
  assert.equal(partial.children[0].type === "frame" && partial.children[0].gap, 2);
  assert.deepEqual(success(setFrameLayout(original, "frame", { layoutMode: "horizontal", padding: 4, gap: 2 })), original);
});

test("不正な値・未知項目・対象外の要素は拒否する", () => {
  const original = document(frame({ children: [rectangle()] }));
  const invalid: unknown[] = [
    { layoutMode: "grid" },
    { padding: -1 },
    { gap: -1 },
    { alignItems: "stretch" },
    { justifyContent: "between" },
    { extra: true },
    {},
  ];
  for (const patch of invalid) {
    assert.equal(setFrameLayout(original, "frame", patch as FrameLayoutPatch).type, "Failure");
  }
  assert.equal(setFrameLayout(original, "rectangle", { padding: 1 }).type, "Failure");
});
