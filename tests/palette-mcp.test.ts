import assert from "node:assert/strict";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { createDocument } from "../src/document/commands/index.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { commit, createHistory, undo } from "../src/document/history.ts";
import { document, paletteColor, rectangle, success } from "./support/factories.ts";

test("MCP からパレットを作成・一覧・改名・色変更・削除でき、Undo で戻せる", () => {
  let history = createHistory(createDocument(), true);
  const api = createAgentApi({ getDocument: () => history.present, getHistory: () => history, getSelectedId: () => null,
    apply: (next) => { history = commit(history, next); } });

  const added = dispatchAgentRequest(api, "add_palette_color", { name: "主色", color: "#123456" });
  assert.equal(added.ok, true);
  assert.match(added.data.id, /^pc_/);
  assert.equal(added.data.name, "主色");
  const colorId = added.data.id;

  assert.deepEqual(dispatchAgentRequest(api, "list_palette", {}).data, [added.data]);

  const renamed = dispatchAgentRequest(api, "rename_palette_color", { id: colorId, name: "文字色" });
  assert.equal(renamed.data.name, "文字色");

  const recolored = dispatchAgentRequest(api, "set_palette_color", { id: colorId, color: "#ffffff" });
  assert.equal(recolored.data.color, "#ffffff");

  const duplicated = dispatchAgentRequest(api, "duplicate_palette_color", { id: colorId });
  assert.equal(duplicated.ok, true);
  assert.notEqual(duplicated.data.id, colorId);

  const removed = dispatchAgentRequest(api, "remove_palette_color", { id: colorId });
  assert.equal(removed.ok, true);
  assert.equal(removed.data.deleted, true);
  assert.equal(dispatchAgentRequest(api, "list_palette", {}).data.length, 1);

  assert.equal(dispatchAgentRequest(api, "rename_palette_color", { id: colorId, name: "なし" }).ok, false);
  const before = history.present;
  history = undo(history);
  assert.notEqual(history.present, before);
});

test("MCP のスタイル変更は直接 HEX とパレット参照の両方を受け付け、get_element はパレットを返す", () => {
  const palette = [paletteColor({ id: "pc1", name: "主色", color: "#123456" })];
  let history = createHistory({ ...document(rectangle()), palette }, true);
  const api = createAgentApi({ getDocument: () => history.present, getHistory: () => history, getSelectedId: () => null,
    apply: (next) => { history = commit(history, next); } });

  assert.equal(dispatchAgentRequest(api, "set_shape_style", { id: "rectangle", fill: "#abcdef" }).ok, true);
  assert.equal(success(api.getElement("rectangle")).style.fill, "#abcdef");

  const ref = { type: "palette" as const, id: "pc1" };
  assert.equal(dispatchAgentRequest(api, "set_shape_style", { id: "rectangle", fill: ref }).ok, true);
  assert.deepEqual(success(api.getElement("rectangle")).style.fill, ref);
  assert.deepEqual(success(api.getElement("rectangle")).palette, palette);

  assert.equal(dispatchAgentRequest(api, "set_text_style", { id: "rectangle", color: ref }).ok, false);
});
