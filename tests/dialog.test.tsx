import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";

import { RecoveryDialog } from "../src/pages/editor/components/organisms/RecoveryDialog/RecoveryDialog.tsx";
import { Dialog, nextDialogFocus } from "../src/pages/editor/components/molecules/Dialog/Dialog.tsx";

const noop = () => {};

test("見出し・本文・ファイルの場所・操作の行を並べ、主となる操作を紫地で右端に置く", () => {
  const markup = renderToStaticMarkup(createElement(Dialog, { title: "ファイルが外部で更新されました", path: "~/Documents/Website.nodi",
    cancel: { label: "今の内容を残す", onSelect: noop }, primary: { label: "再読み込み", onSelect: noop } },
  createElement("p", null, "再読み込みすると、保存していない変更は破棄されます。")));
  const [, titleId] = markup.match(/<h2 id="([^"]+)" class="dialog-title">ファイルが外部で更新されました<\/h2>/) ?? [];
  assert.ok(titleId);
  assert.match(markup, new RegExp(`^<div class="dialog-scrim"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}"`));
  assert.match(markup, /<p class="dialog-path">~\/Documents\/Website.nodi<\/p>/);
  assert.match(markup, /<div class="dialog-actions"><button type="button" class="button button-secondary">今の内容を残す<\/button><button type="button" class="button button-primary">再読み込み<\/button><\/div>/);
});

test("Tab はダイアログの中の操作だけを回り込む", () => {
  assert.equal(nextDialogFocus(0, 2, false), 1);
  assert.equal(nextDialogFocus(1, 2, false), 0);
  assert.equal(nextDialogFocus(0, 2, true), 1);
  assert.equal(nextDialogFocus(-1, 2, false), 0);
  assert.equal(nextDialogFocus(-1, 2, true), 1);
  assert.equal(nextDialogFocus(0, 0, false), -1);
});

test("Esc で取り消しの操作を選ぶ", async () => {
  const source = await readFile(new URL("../src/pages/editor/components/molecules/Dialog/Dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(event\.key === "Escape"\) \{[^}]*cancel\?\.onSelect\(\);/);
});

test("復元と破棄、読み取れないとき、確認中のダイアログを共通部品で出す", () => {
  const available = renderToStaticMarkup(createElement(RecoveryDialog, {
    status: { kind: "available", draft: { sourcePath: "/tmp/画面.nodi", document: { version: 1, children: [], palette: [], spacing: [], components: [] } } },
    onRestore: noop, onDiscard: noop }));
  assert.match(available, /class="dialog-title">未保存の編集が見つかりました/);
  assert.match(available, /<p class="dialog-path">元のファイル: \/tmp\/画面.nodi<\/p>/);
  assert.match(available, /button-secondary">破棄して開始<\/button><button type="button" class="button button-primary">編集を復元/);
  const error = renderToStaticMarkup(createElement(RecoveryDialog, { status: { kind: "error", message: "壊れています" }, onRestore: noop, onDiscard: noop }));
  assert.match(error, /class="dialog-title">復元データを読み取れません/);
  assert.match(error, /<div class="dialog-actions"><button type="button" class="button button-primary">破棄して開始<\/button><\/div>/);
  const checking = renderToStaticMarkup(createElement(RecoveryDialog, { status: { kind: "checking" }, onRestore: noop, onDiscard: noop }));
  assert.match(checking, /作業内容を確認中/);
  assert.doesNotMatch(checking, /dialog-actions/);
});
