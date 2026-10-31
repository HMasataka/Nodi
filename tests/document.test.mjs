import assert from "node:assert/strict";
import test from "node:test";
import { addNode, createDocument, findNode, moveNode, renameNode } from "../src/document/commands/index.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

function success(result) {
  assert.equal(result.type, "Success");
  return result.value;
}

function failure(result) {
  assert.equal(result.type, "Failure");
  return result.error;
}

const rectangle = {
  id: "nd_button", name: "ログインボタン", type: "rectangle",
  x: 24, y: 680, width: 342, height: 48,
  fill: "#f3d9c8", stroke: "#d9bbaa", strokeWidth: 1, cornerRadius: 2,
};
const valid = {
  version: 1,
  children: [{
    id: "nd_screen", name: "ログイン画面", type: "frame",
    x: 0, y: 0, width: 390, height: 844, background: "#ffffff", clipContent: true, children: [rectangle],
  }],
};

test("v1 の JSON を読み書きすると ID、名前、階層、スタイルが保たれる", () => {
  assert.deepEqual(success(parseDocument(success(serializeDocument(valid)))), valid);
});

test("未知の項目、型の変換、不正な数値と無名の要素を拒否する", () => {
  for (const invalid of [
    { ...valid, version: 2 },
    { ...valid, extra: true },
    { ...valid, children: [{ ...rectangle, children: [] }] },
    { ...valid, children: [{ ...rectangle, width: "342" }] },
    { ...valid, children: [{ ...rectangle, name: " \t " }] },
    { ...valid, children: [{ ...rectangle, width: 0 }] },
    { ...valid, children: [{ ...rectangle, height: Infinity }] },
    { ...valid, children: [{ ...rectangle, x: NaN }] },
    { ...valid, children: [{ ...rectangle, type: "circle" }] },
    { ...valid, children: [{ ...rectangle, id: "" }] },
    { ...valid, children: [{ ...rectangle, name: undefined }] },
    { ...valid, children: [{ ...rectangle, fill: "red" }] },
    { ...valid, children: [{ ...rectangle, strokeWidth: -1 }] },
    { ...valid, children: [{ ...valid.children[0], children: undefined }] },
  ]) {
    assert.ok(Array.isArray(failure(serializeDocument(invalid))));
  }
  assert.match(failure(parseDocument("{invalid")).message, /JSON/);
});

test("スタイル項目の欠けた古い形のデータは移行せず拒否する", () => {
  const incomplete = { version: 1, children: [{ ...valid.children[0], children: [{
    id: "nd_button", name: "ログインボタン", type: "rectangle", x: 24, y: 680, width: 342, height: 48,
  }] }] };
  assert.ok(Array.isArray(failure(parseDocument(JSON.stringify(incomplete)))));
});

test("子孫を含む ID 重複は問題のパスとともに報告する", () => {
  const duplicate = {
    ...valid,
    children: [{ ...valid.children[0], children: [{ ...rectangle, id: "nd_screen" }] }],
  };
  const issues = failure(parseDocument(JSON.stringify(duplicate)));
  assert.deepEqual(issues[0].path, ["children", 0, "children", 0, "id"]);
});

test("名前付き作成・移動・改名を保存し直しても ID が変わらない", () => {
  const { document: withFrame, node: frame } = success(addNode(createDocument(), {
    type: "frame", name: "ログイン画面", x: 0, y: 0, width: 390, height: 844,
  }));
  const { document: withButton, node: button } = success(addNode(withFrame, {
    type: "rectangle", parentId: frame.id, name: "ログインボタン",
    x: 24, y: 680, width: 342, height: 48,
  }));
  const edited = success(renameNode(success(moveNode(withButton, button.id, 32, 700)), button.id, "送信ボタン"));
  const reloaded = success(parseDocument(success(serializeDocument(edited))));

  assert.deepEqual(findNode(reloaded, button.id), { ...button, name: "送信ボタン", x: 32, y: 700 });
  assert.equal(reloaded.children[0].children[0].id, button.id);
  assert.equal(findNode(withButton, button.id).name, "ログインボタン");
});

test("名前省略時は初期名を付け、不正な編集操作を拒否する", () => {
  const { document, node } = success(addNode(createDocument(), {
    type: "rectangle", x: 0, y: 0, width: 10, height: 10,
  }));
  assert.equal(node.name, "矩形 1");
  assert.equal(success(addNode(document, { type: "rectangle", x: 0, y: 0, width: 10, height: 10 })).node.name, "矩形 2");
  assert.match(failure(addNode(document, {
    type: "rectangle", parentId: node.id, x: 0, y: 0, width: 10, height: 10,
  })).message, /親フレーム/);
  assert.match(failure(addNode(document, {
    type: "rectangle", name: "  ", x: 0, y: 0, width: 10, height: 10,
  })).message, /名前/);
  assert.match(failure(moveNode(document, node.id, Infinity, 0)).message, /座標/);
  assert.match(failure(renameNode(document, "missing", "名前")).message, /見つかりません/);
});
