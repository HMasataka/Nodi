import assert from "node:assert/strict";
import { test } from "vitest";

import { selectAllIds } from "../src/pages/editor/selection.ts";
import { document, frame, rectangle } from "./support/factories.ts";
import { isMacPlatform, isTextEditingTarget, matchShortcut, runsWhileEditing, type ShortcutKey, shortcutLabel } from "../src/pages/editor/shortcuts.ts";

const key = (value: string, modifiers: Partial<ShortcutKey> = {}): ShortcutKey =>
  ({ key: value, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers });
const id = (event: ShortcutKey, mac: boolean) => matchShortcut(event, mac)?.id ?? null;

test("macOS は ⌘、Windows・Linux は Ctrl で保存・開く・元に戻す・やり直す・複製・すべて選択を判定する", () => {
  assert.equal(id(key("s", { metaKey: true }), true), "save");
  assert.equal(id(key("o", { metaKey: true }), true), "open");
  assert.equal(id(key("z", { metaKey: true }), true), "undo");
  assert.equal(id(key("Z", { metaKey: true, shiftKey: true }), true), "redo");
  assert.equal(id(key("d", { metaKey: true }), true), "duplicate");
  assert.equal(id(key("a", { metaKey: true }), true), "selectAll");
  assert.equal(id(key("s", { ctrlKey: true }), false), "save");
  assert.equal(id(key("O", { ctrlKey: true }), false), "open");
  assert.equal(id(key("z", { ctrlKey: true, shiftKey: true }), false), "redo");
  assert.equal(id(key("y", { ctrlKey: true }), false), "redo");
  assert.equal(id(key("d", { ctrlKey: true }), false), "duplicate");
});

test("修飾キーが割り当てと違うときは何もしない", () => {
  assert.equal(id(key("s", { ctrlKey: true }), true), null);
  assert.equal(id(key("s", { metaKey: true }), false), null);
  assert.equal(id(key("s", { metaKey: true, ctrlKey: true }), true), null);
  assert.equal(id(key("s", { metaKey: true, altKey: true }), true), null);
  assert.equal(id(key("s", { metaKey: true, shiftKey: true }), true), null);
  assert.equal(id(key("y", { metaKey: true }), true), null);
  assert.equal(id(key("r", { metaKey: true }), true), null);
  assert.equal(id(key("r", { altKey: true }), true), null);
  assert.equal(id(key("R", { shiftKey: true }), true), null);
  assert.equal(id(key("Delete", { metaKey: true }), true), null);
});

test("修飾キーなしの1文字で作成ツールを切り換える", () => {
  const tool = (value: string) => { const shortcut = matchShortcut(key(value), true); return shortcut?.id === "tool" ? shortcut.tool : null; };
  assert.deepEqual(["v", "f", "r", "o", "p", "t"].map(tool), ["select", "frame", "rectangle", "ellipse", "path", "text"]);
  assert.equal(tool("V"), "select");
  assert.equal(tool("x"), null);
});

test("Delete・Backspace で削除、Esc で選択の解除、矢印で 1px・Shift と一緒に 10px 動かす", () => {
  assert.equal(id(key("Delete"), true), "delete");
  assert.equal(id(key("Backspace"), false), "delete");
  assert.equal(id(key("Escape"), true), "deselect");
  assert.deepEqual(matchShortcut(key("ArrowLeft"), true), { id: "nudge", dx: -1, dy: 0 });
  assert.deepEqual(matchShortcut(key("ArrowDown"), true), { id: "nudge", dx: 0, dy: 1 });
  assert.deepEqual(matchShortcut(key("ArrowUp", { shiftKey: true }), true), { id: "nudge", dx: 0, dy: -10 });
  assert.deepEqual(matchShortcut(key("ArrowRight", { shiftKey: true }), false), { id: "nudge", dx: 10, dy: 0 });
  assert.equal(matchShortcut(key("ArrowRight", { metaKey: true }), true), null);
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

test("入力中は保存と開くだけを動かし、ほかのショートカットは入力欄に任せる", () => {
  assert.equal(runsWhileEditing("save"), true);
  assert.equal(runsWhileEditing("open"), true);
  for (const other of ["undo", "redo", "delete", "duplicate", "selectAll", "deselect", "tool", "nudge"] as const) assert.equal(runsWhileEditing(other), false, other);
});

test("表記は macOS で記号、それ以外で Ctrl+ の形にする", () => {
  assert.equal(shortcutLabel("save", true), "⌘S");
  assert.equal(shortcutLabel("redo", true), "⇧⌘Z");
  assert.equal(shortcutLabel("duplicate", true), "⌘D");
  assert.equal(shortcutLabel("open", false), "Ctrl+O");
  assert.equal(shortcutLabel("redo", false), "Ctrl+Shift+Z");
  assert.equal(isMacPlatform("MacIntel"), true);
  assert.equal(isMacPlatform("Win32"), false);
  assert.equal(isMacPlatform("Linux x86_64"), false);
});

test("すべて選択は選択中の要素と同じ親の子を選び、何も選んでいないときは最上位の要素を選ぶ", () => {
  const design = document(
    frame({ id: "page", children: [rectangle({ id: "a" }), rectangle({ id: "b" })] }),
    rectangle({ id: "c" }),
  );
  assert.deepEqual(selectAllIds(design, []), ["page", "c"]);
  assert.deepEqual(selectAllIds(design, ["a"]), ["a", "b"]);
  assert.deepEqual(selectAllIds(design, ["c"]), ["page", "c"]);
  assert.deepEqual(selectAllIds(design, ["missing"]), ["page", "c"]);
});
