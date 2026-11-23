import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { UNSAVED_OPEN_CONFIRMATION } from "../src/pages/editor/confirmation.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("別のドキュメントを開くときの未保存確認は、キャンセルと破棄して開くを並べる", () => {
  assert.deepEqual(UNSAVED_OPEN_CONFIRMATION, {
    title: "未保存の変更があります",
    body: "別のドキュメントを開くと、保存していない変更は失われます。",
    cancelLabel: "キャンセル",
    confirmLabel: "破棄して開く",
  });
});

test("開く操作は共通のダイアログで確認し、window.confirm を使わない", async () => {
  const hook = await read("../src/pages/editor/hooks/useEditorDocument.ts");
  const openFile = hook.slice(hook.indexOf("async function openFile()"), hook.indexOf("async function saveFile()"));
  assert.match(openFile, /!await confirm\(UNSAVED_OPEN_CONFIRMATION\)/);
  assert.doesNotMatch(openFile, /window\.confirm/);
  const page = await read("../src/pages/editor/index.tsx");
  assert.match(page, /\{confirmation && <Dialog title=\{confirmation\.title\}[^]*?onSelect: \(\) => confirmation\.resolve\(false\)[^]*?onSelect: \(\) => confirmation\.resolve\(true\)/);
});
