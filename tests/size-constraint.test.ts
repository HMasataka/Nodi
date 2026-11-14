import assert from "node:assert/strict";
import { test } from "vitest";

import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, rectangle, success } from "./support/factories.ts";
import { setNodeSizeConstraint, type SizeConstraintPatch } from "../src/document/commands/index.ts";

test("サイズモードと min / max を設定でき、Undo / Redo できる", () => {
  const original = document(rectangle());
  const edited = success(setNodeSizeConstraint(original, "rectangle", "width", { mode: "fill", min: 20, max: 200 }));
  assert.deepEqual(edited.children[0].widthConstraint, { mode: "fill", min: 20, max: 200 });
  const history = commit(createHistory(original), edited);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, edited);
});

test("min / max は単独で設定・解除でき、既存値を維持する", () => {
  const base = document(rectangle({ widthConstraint: { mode: "fill", min: 20 } }));
  const withMax = success(setNodeSizeConstraint(base, "rectangle", "width", { max: 100 }));
  assert.deepEqual(withMax.children[0].widthConstraint, { mode: "fill", min: 20, max: 100 });
  const cleared = success(setNodeSizeConstraint(withMax, "rectangle", "width", { min: undefined }));
  assert.deepEqual(cleared.children[0].widthConstraint, { mode: "fill", max: 100 });
  const heightMode = success(setNodeSizeConstraint(cleared, "rectangle", "height", { mode: "hug" }));
  assert.deepEqual(heightMode.children[0].heightConstraint, { mode: "hug" });
});

test("不正な値・未知項目・対象外は拒否する", () => {
  const original = document(rectangle());
  const invalid: unknown[] = [
    { mode: "grow" },
    { min: -1 },
    { max: 0 },
    { extra: true },
    {},
  ];
  for (const patch of invalid) {
    assert.equal(setNodeSizeConstraint(original, "rectangle", "width", patch as SizeConstraintPatch).type, "Failure");
  }
  assert.equal(setNodeSizeConstraint(original, "rectangle", "width", { min: 20, max: 10 }).type, "Failure");
  assert.equal(setNodeSizeConstraint(original, "missing", "width", { mode: "fill" }).type, "Failure");
  assert.equal(setNodeSizeConstraint(original, "rectangle", "depth", { mode: "fill" }).type, "Failure");
});
