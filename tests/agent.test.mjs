import assert from "node:assert/strict";
import test from "node:test";
import { createAgentApi } from "../src/document/agent.ts";
import { createDocument } from "../src/document/commands.ts";
import { commit, createHistory, isDirty, undo } from "../src/document/history.ts";

function success(result) { assert.equal(result.type, "Success"); return result.value; }

test("AI API の変更は同じ履歴に入り、名前と ID を階層付きで返す", () => {
  let history = createHistory(createDocument(), true);
  let selectedId = null;
  const api = createAgentApi({
    getDocument: () => history.present,
    getSelectedId: () => selectedId,
    apply: (document) => { history = commit(history, document); },
  });
  const frame = success(api.add({ type: "frame", name: "画面", x: 0, y: 0, width: 400, height: 300 }));
  const first = success(api.add({ type: "rectangle", parentId: frame.id, name: "ボタン", x: 10, y: 20, width: 100, height: 40 }));
  const second = success(api.add({ type: "rectangle", parentId: frame.id, name: "ボタン", x: 30, y: 20, width: 100, height: 40 }));
  selectedId = first.id;
  assert.equal(success(api.getState()).selected.id, first.id);
  assert.equal(first.path, "画面 › ボタン");
  assert.notEqual(first.id, second.id);
  assert.equal(success(api.move(second.id, 70, 80)).x, 70);
  assert.equal(success(api.rename(first.id, "送信")).path, "画面 › 送信");
  assert.equal(success(api.getElement(second.id)).name, "ボタン");
  assert.ok(isDirty(history));
  assert.equal(history.past.length, 5);
  history = undo(history);
  assert.equal(success(api.getElement(first.id)).name, "ボタン");
});

test("存在しない ID や無効な入力は失敗し、履歴を変更しない", () => {
  let history = createHistory(createDocument(), true);
  const api = createAgentApi({ getDocument: () => history.present, getSelectedId: () => null, apply: (document) => { history = commit(history, document); } });
  assert.equal(api.getElement("missing").type, "Failure");
  assert.equal(api.rename("missing", "名前").type, "Failure");
  assert.equal(api.move("missing", 0, 0).type, "Failure");
  assert.equal(api.add({ type: "rectangle", name: " ", x: 0, y: 0, width: 20, height: 20 }).type, "Failure");
  assert.equal(history.past.length, 0);
  assert.equal(isDirty(history), false);
});

test("テキストの本文と表示属性を階層付きで参照・編集できる", () => {
  let history = createHistory(createDocument(), true);
  const api = createAgentApi({ getDocument: () => history.present, getSelectedId: () => null, apply: (document) => { history = commit(history, document); } });
  const frame = success(api.add({ type: "frame", name: "画面", x: 0, y: 0, width: 400, height: 300 }));
  const text = success(api.add({ type: "text", parentId: frame.id, name: "見出し", content: "Hello", x: 10, y: 50, width: 200, height: 40 }));
  assert.equal(text.path, "画面 › 見出し");
  assert.equal(text.content, "Hello");
  assert.equal(text.fontSize, 16);
  assert.equal(text.textAlign, "left");
  assert.equal(success(api.setTextContent(text.id, "Nodi")).content, "Nodi");
  assert.equal(api.setTextContent(frame.id, "invalid").type, "Failure");
  assert.equal(history.past.length, 3);
  assert.ok(isDirty(history));
});
