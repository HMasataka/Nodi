import { type ReactNode, useEffect, useRef, useState } from "react";

import { Field } from "@/pages/editor/components/atoms/Field";
import { Icon } from "@/pages/editor/components/atoms/Icon";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { alphaByte, rgbColor, withAlphaByte, withRgbColor } from "@/document/color.ts";
import type { ComponentDefinition, PaletteColor, SpacingToken } from "@/document/types";
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
  spacing: readonly SpacingToken[];
  // 余白ごとの参照数。削除したときに px 値で固定される箇所の数として示す。
  spacingUsages: Record<string, number>;
  onCreateSpacing(name: string, value: number): void;
  onRenameSpacing(id: string, name: string): void;
  onSetSpacing(id: string, value: number): void;
  onRemoveSpacing(id: string): void;
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
    <SpacingSection {...props} />
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

// 追加する余白の名前。「余白 1」から順に、使われていない番号を選ぶ。
export function nextSpacingName(tokens: readonly SpacingToken[]): string {
  const names = new Set(tokens.map((token) => token.name));
  let number = 1;
  while (names.has(`余白 ${number}`)) number++;
  return `余白 ${number}`;
}

// px 欄の入力。0 以上の有限の数だけを受け付ける。
export function parseSpacingInput(input: string): number | null {
  const raw = input.trim();
  const value = Number(raw);
  return raw !== "" && Number.isFinite(value) && value >= 0 ? value : null;
}

// 余白の行の「⋯」メニュー。参照されている余白は、削除すると参照先が px 値で固定されることを添える。
export function spacingMenuEntries(usage: number, actions: { rename(): void; remove(): void }): MenuEntry[] {
  return [
    { type: "item", label: "名前を変更", onSelect: actions.rename },
    { type: "separator" },
    { type: "item", label: "削除", onSelect: actions.remove },
    ...(usage > 0 ? [{ type: "note" as const, content: `${usage} 箇所で使用中。削除すると参照先は現在の px 値で固定されます。` }] : []),
  ];
}

function SpacingSection({ spacing, spacingUsages, onCreateSpacing, onRenameSpacing, onSetSpacing, onRemoveSpacing }: AssetsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [count, setCount] = useState(spacing.length);
  // 追加した余白をすぐ編集できるよう、増えたときは末尾の行を選ぶ。
  if (count !== spacing.length) {
    setCount(spacing.length);
    if (spacing.length > count) setSelectedId(spacing[spacing.length - 1].id);
  }
  return <section className="asset-section" aria-label="余白">
    <AssetHeader title="余白" count={spacing.length}
      actions={<IconButton icon="plus" label="余白を追加" onClick={() => onCreateSpacing(nextSpacingName(spacing), 8)} />} />
    {spacing.length === 0
      ? <p className="asset-empty">共通の余白を作ると、複数のフレームの余白や間隔に同じ px 値を当てられます。</p>
      : spacing.map((token) => {
        const active = token.id === selectedId;
        const usage = spacingUsages[token.id] ?? 0;
        return <div key={token.id} className="asset-spacing">
          <div className={`asset-row spacing-row${active ? " is-active" : ""}`}>
            {renamingId === token.id
              ? <RenameInput value={token.name} label="余白の名前"
                onDone={(name) => { setRenamingId(null); if (name !== null && name.trim() && name.trim() !== token.name) onRenameSpacing(token.id, name.trim()); }} />
              : <button type="button" className="asset-row-name" aria-pressed={active}
                onClick={() => setSelectedId(active ? null : token.id)} onDoubleClick={() => setRenamingId(token.id)}>{token.name}</button>}
            <span className="asset-row-value">{token.value}</span>
            {active ? <div className="asset-row-actions">
              <Menu label={`${token.name}の操作`} fixedTo={besidePanel} entries={spacingMenuEntries(usage, {
                rename: () => setRenamingId(token.id), remove: () => onRemoveSpacing(token.id),
              })} trigger={(trigger) => <IconButton {...trigger} icon="more" label={`${token.name}の操作`} />} />
            </div> : null}
          </div>
          {active ? <div className="asset-spacing-editor">
            <Field label="px" inputMode="decimal" value={String(token.value)} onCommit={(value) => {
              const next = parseSpacingInput(value);
              if (next !== null && next !== token.value) onSetSpacing(token.id, next);
            }} />
            <span className="asset-spacing-usage">{usage} 箇所で使用</span>
          </div> : null}
        </div>;
      })}
  </section>;
}
