import { useEffect, useRef } from "react";

import { isTextEditingTarget, matchShortcut, runsWhileEditing, type ShortcutId } from "@/pages/editor/shortcuts.ts";

export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

// 割り当てたショートカットを window の keydown で受けて実行する。入力中は文字入力を奪わない。
export function useEditorShortcuts(handlers: ShortcutHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      const id = matchShortcut(event);
      const handler = id ? latest.current[id] : undefined;
      if (!id || !handler) return;
      if (isTextEditingTarget(event.target)) {
        if (!runsWhileEditing(id)) return;
        // 入力欄は blur で確定するため、下書きを確定してから保存・開くを実行する。
        if (event.target instanceof HTMLElement) event.target.blur();
      }
      event.preventDefault();
      handler();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
