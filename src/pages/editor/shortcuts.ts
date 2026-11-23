// 編集画面のキーボードショートカットの判定。割り当ての一覧は docs/shortcuts.md に記録する。

import type { DrawTool } from "@/pages/editor/types";

export type Shortcut =
  | { id: "save" | "open" | "undo" | "redo" | "delete" | "duplicate" | "selectAll" | "deselect" }
  | { id: "tool"; tool: DrawTool }
  | { id: "nudge"; dx: number; dy: number }
  | { id: "reorder"; direction: "front" | "back" | "forward" | "backward" }
  | { id: "zoomIn" | "zoomOut" | "zoomReset" | "zoomFit" }
  | { id: "togglePanel"; panel: "left" | "right" | "timeline" };
export type ShortcutId = Shortcut["id"];

// 修飾キーなしの1文字で切り換える作成ツール。
export const TOOL_KEYS: Record<string, DrawTool> = { v: "select", f: "frame", r: "rectangle", o: "ellipse", p: "path", t: "text" };
const NUDGE: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
// Shift と一緒に押したときの移動量。
export const LARGE_NUDGE = 10;

// code は配列に依らない物理キー。Alt や Shift で key の文字が変わるキー（数字・角括弧）の判定に使う。
export type ShortcutKey = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"> & { code?: string };

// macOS では ⌘、Windows・Linux では Ctrl を主の修飾キーにする。
export function isMacPlatform(platform: string = typeof navigator === "undefined" ? "" : navigator.platform): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", "password", "number", "date", "datetime-local", "month", "time", "week"]);

type EditingCandidate = { tagName?: unknown; type?: unknown; isContentEditable?: unknown; closest?: unknown };

// 文字を入力している要素か。ここにフォーカスがあるときは、文字入力や入力欄の取り消しを奪わない。
export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as EditingCandidate;
  if (typeof element.tagName !== "string") return false;
  if (element.isContentEditable === true) return true;
  const tag = element.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") return TEXT_INPUT_TYPES.has(String(element.type ?? "text").toLowerCase());
  return false;
}

// 押されたキーに当たるショートカット。修飾キーの組み合わせが割り当てと完全に一致したときだけ返す。
export function matchShortcut(event: ShortcutKey, mac: boolean = isMacPlatform()): Shortcut | null {
  const primary = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  const none = !event.metaKey && !event.ctrlKey && !event.altKey;
  if (none) return matchPlainKey(event);
  if (!primary) return null;
  if (event.altKey) return matchPrimaryAltKey(event);
  const key = event.key.toLowerCase();
  if (key === "z") return { id: event.shiftKey ? "redo" : "undo" };
  if (key === "]") return event.shiftKey ? null : { id: "reorder", direction: "forward" };
  if (key === "[") return event.shiftKey ? null : { id: "reorder", direction: "backward" };
  // ⌘+ は配列によって Shift を伴うため、Shift の有無を問わない。
  if (key === "=" || key === "+") return { id: "zoomIn" };
  if (key === "-") return event.shiftKey ? null : { id: "zoomOut" };
  if (event.shiftKey) return null;
  if (key === "s") return { id: "save" };
  if (key === "o") return { id: "open" };
  if (key === "d") return { id: "duplicate" };
  if (key === "a") return { id: "selectAll" };
  if (key === "y" && !mac) return { id: "redo" };
  return null;
}

// 主の修飾キーと Alt の組み合わせ。Alt で key の文字が変わるため code で判定する。
function matchPrimaryAltKey(event: ShortcutKey): Shortcut | null {
  if (event.shiftKey) return null;
  const panels: Record<string, "left" | "right" | "timeline"> = { Digit1: "left", Digit2: "right", Digit3: "timeline" };
  if (event.code && panels[event.code]) return { id: "togglePanel", panel: panels[event.code] };
  if (event.code === "BracketRight") return { id: "reorder", direction: "front" };
  if (event.code === "BracketLeft") return { id: "reorder", direction: "back" };
  return null;
}

function matchPlainKey(event: ShortcutKey): Shortcut | null {
  if (event.shiftKey && (event.code === "Digit0" || event.key === ")")) return { id: "zoomReset" };
  if (event.shiftKey && (event.code === "Digit1" || event.key === "!")) return { id: "zoomFit" };
  const nudge = NUDGE[event.key];
  if (nudge) {
    const step = event.shiftKey ? LARGE_NUDGE : 1;
    return { id: "nudge", dx: nudge[0] * step, dy: nudge[1] * step };
  }
  if (event.shiftKey) return null;
  if (event.key === "Delete" || event.key === "Backspace") return { id: "delete" };
  if (event.key === "Escape") return { id: "deselect" };
  const tool = TOOL_KEYS[event.key.toLowerCase()];
  return tool ? { id: "tool", tool } : null;
}

// 入力中でも動かすショートカット。入力中の下書きを確定してから実行する。
export function runsWhileEditing(id: ShortcutId): boolean {
  return id === "save" || id === "open";
}

// メニューなどに出す表記。macOS は記号、それ以外は Ctrl+ の形にする。
export function shortcutLabel(id: "save" | "open" | "undo" | "redo" | "duplicate" | "selectAll", mac: boolean = isMacPlatform()): string {
  const keys = {
    save: { shift: false, key: "S" },
    open: { shift: false, key: "O" },
    undo: { shift: false, key: "Z" },
    redo: { shift: true, key: "Z" },
    duplicate: { shift: false, key: "D" },
    selectAll: { shift: false, key: "A" },
  };
  const { shift, key } = keys[id];
  return mac ? `${shift ? "⇧" : ""}⌘${key}` : `Ctrl+${shift ? "Shift+" : ""}${key}`;
}
