import { useEffect, useRef } from "react";

import { isTextEditingTarget, matchShortcut, runsWhileEditing, type Shortcut, type ShortcutId } from "@/pages/editor/shortcuts.ts";

// 実行できたときは true を返す。false や undefined のときは既定の動作（スクロールなど）を止めない。
export type ShortcutHandlers = { [K in ShortcutId]?: (shortcut: Extract<Shortcut, { id: K }>) => boolean | void };

// 割り当てたショートカットを window の keydown で受けて実行する。入力中は文字入力を奪わない。
export function useEditorShortcuts(handlers: ShortcutHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      const shortcut = matchShortcut(event);
      const handler = shortcut ? latest.current[shortcut.id] as ((value: Shortcut) => boolean | void) | undefined : undefined;
      if (!shortcut || !handler) return;
      if (isTextEditingTarget(event.target)) {
        if (!runsWhileEditing(shortcut.id)) return;
        // 入力欄は blur で確定するため、下書きを確定してから保存・開くを実行する。
        if (event.target instanceof HTMLElement) event.target.blur();
      }
      if (handler(shortcut) !== false) event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
