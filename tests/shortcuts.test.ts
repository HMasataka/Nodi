import assert from "node:assert/strict";
import { test } from "vitest";

import { isMacPlatform, isTextEditingTarget, matchShortcut, runsWhileEditing, type ShortcutKey, shortcutLabel } from "../src/pages/editor/shortcuts.ts";

const key = (value: string, modifiers: Partial<ShortcutKey> = {}): ShortcutKey =>
  ({ key: value, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers });

test("macOS は ⌘、Windows・Linux は Ctrl で保存・開く・元に戻す・やり直すを判定する", () => {
  assert.equal(matchShortcut(key("s", { metaKey: true }), true), "save");
  assert.equal(matchShortcut(key("o", { metaKey: true }), true), "open");
  assert.equal(matchShortcut(key("z", { metaKey: true }), true), "undo");
  assert.equal(matchShortcut(key("Z", { metaKey: true, shiftKey: true }), true), "redo");
  assert.equal(matchShortcut(key("s", { ctrlKey: true }), false), "save");
  assert.equal(matchShortcut(key("O", { ctrlKey: true }), false), "open");
  assert.equal(matchShortcut(key("z", { ctrlKey: true, shiftKey: true }), false), "redo");
  assert.equal(matchShortcut(key("y", { ctrlKey: true }), false), "redo");
});

test("修飾キーが割り当てと違うときは何もしない", () => {
  assert.equal(matchShortcut(key("s"), true), null);
  assert.equal(matchShortcut(key("s", { ctrlKey: true }), true), null);
  assert.equal(matchShortcut(key("s", { metaKey: true }), false), null);
  assert.equal(matchShortcut(key("s", { metaKey: true, ctrlKey: true }), true), null);
  assert.equal(matchShortcut(key("s", { metaKey: true, altKey: true }), true), null);
  assert.equal(matchShortcut(key("s", { metaKey: true, shiftKey: true }), true), null);
  assert.equal(matchShortcut(key("y", { metaKey: true }), true), null);
});

test("文字を入力する要素だけを入力中とみなす", () => {
  assert.equal(isTextEditingTarget({ tagName: "INPUT", type: "text" } as never), true);
  assert.equal(isTextEditingTarget({ tagName: "INPUT", type: "number" } as never), true);
  assert.equal(isTextEditingTarget({ tagName: "TEXTAREA" } as never), true);
  assert.equal(isTextEditingTarget({ tagName: "DIV", isContentEditable: true } as never), true);
  assert.equal(isTextEditingTarget({ tagName: "INPUT", type: "checkbox" } as never), false);
  assert.equal(isTextEditingTarget({ tagName: "INPUT", type: "range" } as never), false);
  assert.equal(isTextEditingTarget({ tagName: "BUTTON" } as never), false);
  assert.equal(isTextEditingTarget({ tagName: "DIV", isContentEditable: false } as never), false);
  assert.equal(isTextEditingTarget(null), false);
});

test("入力中は保存と開くだけを動かし、元に戻す・やり直すは入力欄に任せる", () => {
  assert.equal(runsWhileEditing("save"), true);
  assert.equal(runsWhileEditing("open"), true);
  assert.equal(runsWhileEditing("undo"), false);
  assert.equal(runsWhileEditing("redo"), false);
});

test("表記は macOS で記号、それ以外で Ctrl+ の形にする", () => {
  assert.equal(shortcutLabel("save", true), "⌘S");
  assert.equal(shortcutLabel("redo", true), "⇧⌘Z");
  assert.equal(shortcutLabel("open", false), "Ctrl+O");
  assert.equal(shortcutLabel("redo", false), "Ctrl+Shift+Z");
  assert.equal(isMacPlatform("MacIntel"), true);
  assert.equal(isMacPlatform("Win32"), false);
  assert.equal(isMacPlatform("Linux x86_64"), false);
});
