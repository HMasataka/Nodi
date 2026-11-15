import assert from "node:assert/strict";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { addSpacingToken, removeSpacingToken, renameSpacingToken, setFrameLayout, setSpacingToken } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, frame, rectangle, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function design() {
  return document(
    frame({ id: "a", layoutMode: "horizontal", width: 200, height: 100, children: [rectangle({ id: "child-a", width: 20, height: 20 })] }),
    frame({ id: "b", layoutMode: "horizontal", width: 200, height: 100, children: [rectangle({ id: "child-b", width: 20, height: 20 })] }),
  );
}

test("共通値を複数フレームで参照し、改名・値変更・削除・履歴と保存が一致する", () => {
  const base = design();
  const added = success(addSpacingToken(base, "8px", 8));
  const first = success(setFrameLayout(added.document, "a", { paddingRef: added.token.id, gapRef: added.token.id }));
  const second = success(setFrameLayout(first, "b", { paddingRef: added.token.id }));
  const changed = success(setSpacingToken(second, added.token.id, 24));
  assert.deepEqual(resolveDocumentLayout(changed).children.filter((node) => node.type === "frame").map((node) => node.children[0].x), [24, 24]);
  const renamed = success(renameSpacingToken(changed, added.token.id, "基準余白"));
  assert.deepEqual(renamed.children, changed.children);
  const json = success(serializeDocument(renamed));
  assert.deepEqual(success(parseDocument(json)), renamed);
  assert.equal(success(parseDocument(success(serializeDocument(base)))).spacing.length, 0);
  assert.equal(JSON.parse(success(serializeDocument(base))).spacing, undefined);
  const removed = success(removeSpacingToken(renamed, added.token.id));
  assert.equal(removed.spacing.length, 0);
  const frames = removed.children.filter((node) => node.type === "frame");
  assert.deepEqual(frames.map(({ padding, paddingRef, gapRef }) => [padding, paddingRef, gapRef]), [[24, undefined, undefined], [24, undefined, undefined]]);
  assert.deepEqual(resolveDocumentLayout(removed).children.filter((node) => node.type === "frame").map((node) => node.children[0].x), [24, 24]);
  assert.deepEqual(success(parseDocument(success(serializeDocument(removed)))), removed);
  const history = commit(createHistory(base, true), changed);
  assert.equal(undo(history).present, base);
  assert.equal(redo(undo(history)).present, changed);
});

test("参照を直接値で上書きでき、未定義ID・重複ID・不正値は拒否する", () => {
  const added = success(addSpacingToken(design(), "余白", 12));
  const referenced = success(setFrameLayout(added.document, "a", { paddingRef: added.token.id }));
  const detached = success(setFrameLayout(referenced, "a", { paddingRef: null }));
  assert.equal(detached.children[0].type === "frame" && detached.children[0].padding, 12);
  assert.equal(detached.children[0].type === "frame" && detached.children[0].paddingRef, undefined);
  const direct = success(setFrameLayout(referenced, "a", { padding: 3 }));
  assert.equal(direct.children[0].type === "frame" && direct.children[0].paddingRef, undefined);
  assert.equal(direct.children[0].type === "frame" && direct.children[0].padding, 3);
  assert.equal(setFrameLayout(added.document, "a", { gapRef: "missing" }).type, "Failure");
  assert.equal(setFrameLayout(added.document, "a", { gap: 5, gapRef: added.token.id }).type, "Failure");
  assert.equal(addSpacingToken(design(), "invalid", -1).type, "Failure");
  assert.equal(setSpacingToken(added.document, added.token.id, Infinity).type, "Failure");
  assert.equal(serializeDocument({ ...added.document, spacing: [added.token, added.token] }).type, "Failure");
  const wire = JSON.parse(success(serializeDocument(referenced)));
  wire.spacing = [];
  assert.equal(parseDocument(JSON.stringify(wire)).type, "Failure");
});

test("MCP経由の共通値操作も同じ文書に適用される", () => {
  let current = design();
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current, true), getSelectedId: () => null, apply: (next) => { current = next; } });
  const add = dispatchAgentRequest(api, "add_spacing_token", { name: "標準", value: 16 });
  assert.equal(add.ok, true);
  if (!add.ok) return;
  const id = (add.data as { id: string }).id;
  assert.equal(dispatchAgentRequest(api, "set_frame_layout", { id: "a", paddingRef: id, gapRef: id }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_frame_layout", { id: "b", paddingRef: id }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_spacing_token", { id, value: 20 }).ok, true);
  const element = dispatchAgentRequest(api, "get_element", { id: "a" });
  assert.equal(element.ok && (element.data as { padding: number }).padding, 20);
  assert.equal(dispatchAgentRequest(api, "rename_spacing_token", { id, name: "新しい名前" }).ok, true);
  assert.equal(dispatchAgentRequest(api, "remove_spacing_token", { id }).ok, true);
  assert.equal(current.spacing.length, 0);
  assert.equal(current.children[0].type === "frame" && current.children[0].padding, 20);
});
