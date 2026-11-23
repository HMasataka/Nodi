import { type ReactNode, useEffect, useRef, useState } from "react";

import { Field } from "@/pages/editor/components/atoms/Field";
import { Icon } from "@/pages/editor/components/atoms/Icon";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { alphaByte, rgbColor, withAlphaByte, withRgbColor } from "@/document/color.ts";
import type { ComponentDefinition, PaletteColor } from "@/document/types";
import { Menu, type MenuEntry } from "@/pages/editor/components/molecules/Menu";

export type AssetsPanelProps = {
  components: ComponentDefinition[];
  // インスタンスを選んでいるときの参照元。行を強調し、操作を出す。
  highlightedComponentId?: string | null;
  onPlaceInstance(componentId: string): void;
  onRenameComponent(componentId: string, name: string): void;
  onDuplicateComponent(componentId: string): void;
  onRemoveComponent(componentId: string): void;
  palette: readonly PaletteColor[];
  onCreatePalette(): void;
  onImportPalette(): void;
  onRenamePalette(id: string, name: string): void;
  onRecolorPalette(id: string, color: string): void;
  onDuplicatePalette(id: string): void;
  onDeletePalette(id: string): void;
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
    <ColorsSection {...props} />
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

// 色の行の「⋯」メニュー。
export function colorMenuEntries(actions: { rename(): void; duplicate(): void; remove(): void }): MenuEntry[] {
  return [
    { type: "item", label: "名前を変更", onSelect: actions.rename },
    { type: "item", label: "複製", onSelect: actions.duplicate },
    { type: "separator" },
    { type: "item", label: "削除", onSelect: actions.remove },
  ];
}

// HEX 欄の入力を色に当てる。# の有無を問わず6桁の16進数だけを受け付け、アルファは元の色のまま残す。
export function parseHexInput(color: string, input: string): string | null {
  const hex = input.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(hex) ? withRgbColor(color, `#${hex.toLowerCase()}`) : null;
}

// アルファ欄の入力を色に当てる。0〜255 の整数だけを受け付ける。
export function parseAlphaInput(color: string, input: string): string | null {
  const raw = input.trim();
  const value = Number(raw);
  return /^\d+$/.test(raw) && value <= 255 ? withAlphaByte(color, value) : null;
}

function ColorsSection({ palette, onCreatePalette, onImportPalette, onRenamePalette, onRecolorPalette, onDuplicatePalette, onDeletePalette }: AssetsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  return <section className="asset-section" aria-label="色">
    <AssetHeader title="色" count={palette.length} actions={<>
      <IconButton icon="import" label="色を取り込む" onClick={onImportPalette} />
      <IconButton icon="plus" label="色を追加" onClick={onCreatePalette} />
    </>} />
    {palette.length === 0
      ? <p className="asset-empty">名前付きの色を登録すると、塗り・線・文字などの色入力から再利用できます。</p>
      : palette.map((color) => {
        const active = color.id === selectedId;
        const recolor = (next: string | null) => { if (next && next !== color.color) onRecolorPalette(color.id, next); };
        return <div key={color.id} className="asset-color">
          <div className={`asset-row color-row${active ? " is-active" : ""}`}>
            <span className="asset-swatch" style={{ background: color.color }} aria-hidden="true" />
            {renamingId === color.id
              ? <RenameInput value={color.name} label="色の名前"
                onDone={(name) => { setRenamingId(null); if (name !== null && name.trim() && name !== color.name) onRenamePalette(color.id, name.trim()); }} />
              : <button type="button" className="asset-row-name" aria-pressed={active}
                onClick={() => setSelectedId(active ? null : color.id)} onDoubleClick={() => setRenamingId(color.id)}>{color.name}</button>}
            <span className="asset-row-value">{rgbColor(color.color).toUpperCase()}</span>
            {active ? <div className="asset-row-actions">
              <Menu label={`${color.name}の操作`} fixedTo={besidePanel} entries={colorMenuEntries({
                rename: () => setRenamingId(color.id), duplicate: () => onDuplicatePalette(color.id), remove: () => onDeletePalette(color.id),
              })} trigger={(trigger) => <IconButton {...trigger} icon="more" label={`${color.name}の操作`} />} />
            </div> : null}
          </div>
          {active ? <div className="asset-color-editor">
            <Field label="HEX" className="asset-color-hex" value={rgbColor(color.color).slice(1).toUpperCase()}
              onCommit={(value) => recolor(parseHexInput(color.color, value))} />
            <Field label="A" className="asset-color-alpha" inputMode="numeric" value={String(alphaByte(color.color))}
              onCommit={(value) => recolor(parseAlphaInput(color.color, value))} />
          </div> : null}
        </div>;
      })}
  </section>;
}
