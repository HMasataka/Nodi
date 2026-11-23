import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

export type MenuEntry =
  | { type: "item"; label: string; shortcut?: string; disabled?: boolean; onSelect(): void }
  | { type: "separator" }
  | { type: "note"; content: ReactNode };

export type MenuTriggerProps = {
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick(): void;
};

// 矢印キーと Home・End で移る先の項目。選べる項目の位置 enabled の中で回り込む。対象外のキーは null。
export function nextMenuIndex(key: string, current: number, enabled: readonly number[]): number | null {
  if (enabled.length === 0) return null;
  const at = enabled.indexOf(current);
  if (key === "ArrowDown") return enabled[at < 0 ? 0 : (at + 1) % enabled.length];
  if (key === "ArrowUp") return enabled[at < 0 ? enabled.length - 1 : (at - 1 + enabled.length) % enabled.length];
  if (key === "Home") return enabled[0];
  if (key === "End") return enabled[enabled.length - 1];
  return null;
}

type MenuProps = {
  label: string;
  entries: readonly MenuEntry[];
  trigger(props: MenuTriggerProps): ReactNode;
  align?: "start" | "end";
  defaultOpen?: boolean;
};

// ボタンから開くメニュー。外側のクリック・Esc・項目の選択で閉じ、開いたボタンにフォーカスを戻す。
export function Menu({ label, entries, trigger, align = "start", defaultOpen = false }: MenuProps) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const anchor = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = entries.flatMap((entry, index) => (entry.type === "item" && !entry.disabled ? [index] : []));

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) anchor.current?.querySelector<HTMLElement>("[aria-haspopup='menu']")?.focus();
  }

  useEffect(() => {
    if (!open) return;
    items.current[enabled[0]]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // 項目へのフォーカスは開いたときだけ移し、項目が変わっても動かさない。
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (event.key === "Tab") { close(false); return; }
    const current = items.current.findIndex((item) => item === document.activeElement);
    const next = nextMenuIndex(event.key, current, enabled);
    if (next === null) return;
    event.preventDefault();
    items.current[next]?.focus();
  }

  return <div className="menu-anchor" ref={anchor}>
    {trigger({ "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": id, onClick: () => setOpen((value) => !value) })}
    {open ? <div id={id} role="menu" aria-label={label} className={`menu menu-${align}`} onKeyDown={onKeyDown}>
      {entries.map((entry, index) => {
        if (entry.type === "separator") return <div key={index} role="separator" className="menu-separator" />;
        if (entry.type === "note") return <div key={index} role="presentation" className="menu-note">{entry.content}</div>;
        return <button key={index} ref={(element) => { items.current[index] = element; }} type="button" role="menuitem"
          className="menu-item" tabIndex={-1} disabled={entry.disabled}
          onClick={() => { close(true); entry.onSelect(); }}>
          <span className="menu-item-label">{entry.label}</span>
          {entry.shortcut ? <kbd className="menu-item-shortcut">{entry.shortcut}</kbd> : null}
        </button>;
      })}
    </div> : null}
  </div>;
}
