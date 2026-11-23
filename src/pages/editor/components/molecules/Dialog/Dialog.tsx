import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

import { Button } from "@/pages/editor/components/atoms/Button";

export type DialogAction = { label: string; onSelect(): void };

type DialogProps = {
  title: string;
  children: ReactNode;
  // ファイルの場所など、本文の下に枠で示す1行。
  path?: string;
  // 取り消す操作。Esc でもこれを選ぶ。
  cancel?: DialogAction;
  // 主となる操作。紫地のボタンにして右端に置く。
  primary?: DialogAction;
};

const FOCUSABLE = "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

// Tab で移る先。ダイアログの中の操作だけを回り込む。
export function nextDialogFocus(current: number, count: number, backward: boolean): number {
  if (count === 0) return -1;
  if (current < 0) return backward ? count - 1 : 0;
  return (current + (backward ? count - 1 : 1)) % count;
}

// 画面全体を幕で覆い、中央に開くダイアログ。開いている間はフォーカスを中に留め、閉じると元の位置に戻す。
export function Dialog({ title, children, path, cancel, primary }: DialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = dialog.current?.querySelector<HTMLElement>(".button-primary") ?? dialog.current;
    target?.focus();
    return () => previous?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel?.onSelect();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const next = nextDialogFocus(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, event.shiftKey);
    event.preventDefault();
    (focusable[next] ?? dialog.current).focus();
  }

  return <div className="dialog-scrim">
    <section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
      tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="dialog-message">
        <h2 id={titleId} className="dialog-title">{title}</h2>
        <div id={bodyId} className="dialog-body">{children}</div>
      </div>
      {path ? <p className="dialog-path">{path}</p> : null}
      {cancel || primary ? <div className="dialog-actions">
        {cancel ? <Button onClick={cancel.onSelect}>{cancel.label}</Button> : null}
        {primary ? <Button variant="primary" onClick={primary.onSelect}>{primary.label}</Button> : null}
      </div> : null}
    </section>
  </div>;
}
