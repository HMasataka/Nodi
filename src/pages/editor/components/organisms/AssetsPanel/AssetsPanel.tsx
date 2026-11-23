import { type ReactNode, useEffect, useRef, useState } from "react";

import type { ComponentDefinition } from "@/document/types";
import { Icon } from "@/pages/editor/components/atoms/Icon";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { Menu, type MenuEntry } from "@/pages/editor/components/molecules/Menu";

export type AssetsPanelProps = {
  components: ComponentDefinition[];
  // インスタンスを選んでいるときの参照元。行を強調し、操作を出す。
  highlightedComponentId?: string | null;
  onPlaceInstance(componentId: string): void;
  onRenameComponent(componentId: string, name: string): void;
  onDuplicateComponent(componentId: string): void;
  onRemoveComponent(componentId: string): void;
  children?: ReactNode;
};

// 節の見出し。名前の直後に件数を置き、追加などの操作を右端にそろえる。
export function AssetHeader({ title, count, actions }: { title: string; count: number; actions?: ReactNode }) {
  return <div className="asset-header">
    <h2 className="asset-header-title">{title}<span className="asset-header-count">{count}</span></h2>
    {actions ? <div className="asset-header-actions">{actions}</div> : null}
  </div>;
}

// 行の「⋯」メニューは、パネルの中の節を隠さないようパネルの右隣（8px 外）に、開いたボタンの高さで開く。
export function besidePanel(opener: HTMLElement): { top: number; left: number } {
  const panel = opener.closest("aside")?.getBoundingClientRect() ?? opener.getBoundingClientRect();
  return { top: opener.getBoundingClientRect().top, left: panel.right + 8 };
}

// コンポーネントの行の「⋯」メニュー。
export function componentMenuEntries(actions: { place(): void; rename(): void; duplicate(): void; remove(): void }): MenuEntry[] {
  return [
    { type: "item", label: "キャンバスに配置", onSelect: actions.place },
    { type: "item", label: "名前を変更", onSelect: actions.rename },
    { type: "item", label: "複製", onSelect: actions.duplicate },
    { type: "separator" },
    { type: "item", label: "削除", onSelect: actions.remove },
  ];
}

// 左パネルのアセット。文書全体で共有する定義を、コンポーネント、色、余白の順に並べる。
export function AssetsPanel(props: AssetsPanelProps) {
  return <aside className="sidebar assets" aria-label="アセット">
    <ComponentsSection {...props} />
    {props.children}
  </aside>;
}

function ComponentsSection({ components, highlightedComponentId, onPlaceInstance, onRenameComponent, onDuplicateComponent, onRemoveComponent }: AssetsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const activeId = highlightedComponentId ?? selectedId;

  useEffect(() => {
    if (highlightedComponentId) highlightedRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedComponentId]);

  return <section className="asset-section" aria-label="コンポーネント">
    <AssetHeader title="コンポーネント" count={components.length} />
    {components.length === 0
      ? <p className="asset-empty">フレームの「⋯」メニューの「コンポーネントを作成」で、ここに定義が並びます。</p>
      : components.map((component) => {
        const active = component.id === activeId;
        return <div key={component.id} ref={component.id === highlightedComponentId ? highlightedRef : undefined}
          className={`asset-row component-row${active ? " is-active" : ""}`}>
          <Icon name="component" />
          {renamingId === component.id
            ? <RenameInput value={component.name} label="コンポーネント名"
              onDone={(name) => { setRenamingId(null); if (name !== null && name.trim() && name !== component.name) onRenameComponent(component.id, name); }} />
            : <button type="button" className="asset-row-name" aria-pressed={active} onClick={() => setSelectedId(component.id)}
              onDoubleClick={() => setRenamingId(component.id)}>{component.name}</button>}
          {active ? <div className="asset-row-actions">
            <IconButton icon="plus" label={`${component.name}をキャンバスに配置`} onClick={() => onPlaceInstance(component.id)} />
            <Menu label={`${component.name}の操作`} entries={componentMenuEntries({
              place: () => onPlaceInstance(component.id), rename: () => setRenamingId(component.id),
              duplicate: () => onDuplicateComponent(component.id), remove: () => onRemoveComponent(component.id),
            })} fixedTo={besidePanel} trigger={(trigger) => <IconButton {...trigger} icon="more" label={`${component.name}の操作`} />} />
          </div> : null}
        </div>;
      })}
  </section>;
}

// 行の中で名前を変える入力。Enter か blur で確定し、Esc で取り消す（onDone に null を渡す）。
export function RenameInput({ value, label, onDone }: { value: string; label: string; onDone(name: string | null): void }) {
  const [draft, setDraft] = useState(value);
  const done = useRef(false);
  const finish = (name: string | null) => { if (done.current) return; done.current = true; onDone(name); };
  return <input className="asset-rename" value={draft} aria-label={label} spellCheck={false} autoFocus
    onFocus={(event) => event.currentTarget.select()}
    onChange={(event) => setDraft(event.currentTarget.value)}
    onBlur={() => finish(draft)}
    onKeyDown={(event) => {
      if (event.key === "Enter") finish(draft);
      if (event.key === "Escape") { event.preventDefault(); finish(null); }
    }} />;
}
