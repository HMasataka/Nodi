// 編集画面のキーボードショートカットの判定。割り当ての一覧は docs/shortcuts.md に記録する。

export type ShortcutId = "save" | "open" | "undo" | "redo";

export type ShortcutKey = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

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

// 押されたキーに当たるショートカット。主の修飾キーと Shift・Alt の組み合わせが割り当てと完全に一致したときだけ返す。
export function matchShortcut(event: ShortcutKey, mac: boolean = isMacPlatform()): ShortcutId | null {
  const primary = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!primary || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "s" && !event.shiftKey) return "save";
  if (key === "o" && !event.shiftKey) return "open";
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !mac && !event.shiftKey) return "redo";
  return null;
}

// 入力中でも動かすショートカット。入力中の下書きを確定してから実行する。
export function runsWhileEditing(id: ShortcutId): boolean {
  return id === "save" || id === "open";
}

// メニューなどに出す表記。macOS は記号、それ以外は Ctrl+ の形にする。
export function shortcutLabel(id: ShortcutId, mac: boolean = isMacPlatform()): string {
  const keys: Record<ShortcutId, { shift: boolean; key: string }> = {
    save: { shift: false, key: "S" },
    open: { shift: false, key: "O" },
    undo: { shift: false, key: "Z" },
    redo: { shift: true, key: "Z" },
  };
  const { shift, key } = keys[id];
  return mac ? `${shift ? "⇧" : ""}⌘${key}` : `Ctrl+${shift ? "Shift+" : ""}${key}`;
}
