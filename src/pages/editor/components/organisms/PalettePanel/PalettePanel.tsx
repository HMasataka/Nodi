import type { PaletteColor } from "@/document/types.ts";
import { alphaByte, rgbColor, withAlphaByte, withRgbColor } from "@/document/color.ts";

import { blurOnEnter } from "@/pages/editor/components/atoms/Field";

interface PalettePanelProps {
  palette: readonly PaletteColor[];
  onCreate(): void;
  onRename(id: string, name: string): void;
  onRecolor(id: string, color: string): void;
  onDelete(id: string): void;
  onDuplicate(id: string): void;
  onImport(): void;
}

function PaletteItem({ color, onRename, onRecolor, onDelete, onDuplicate }: {
  color: PaletteColor;
  onRename(id: string, name: string): void;
  onRecolor(id: string, value: string): void;
  onDelete(id: string): void;
  onDuplicate(id: string): void;
}) {
  const rgb = rgbColor(color.color);
  return <div className="palette-item">
    <label className="palette-swatch" title={color.name}>
      <input type="color" value={rgb}
        onChange={(event) => onRecolor(color.id, withRgbColor(color.color, event.currentTarget.value))} />
    </label>
    <input type="number" className="palette-alpha" min="0" max="255" step="1" defaultValue={alphaByte(color.color)}
      aria-label={`${color.name}のアルファ`}
      onBlur={(event) => {
        const raw = event.currentTarget.value.trim();
        const value = Number(raw);
        if (/^\d+$/.test(raw) && Number.isInteger(value) && value >= 0 && value <= 255 && value !== alphaByte(color.color)) {
          onRecolor(color.id, withAlphaByte(color.color, value));
        } else event.currentTarget.value = String(alphaByte(color.color));
      }} />
    <input type="text" className="palette-name" defaultValue={color.name} aria-label={`${color.name}の名前`}
      onBlur={(event) => {
        const name = event.currentTarget.value.trim();
        if (name && name !== color.name) onRename(color.id, name);
        else event.currentTarget.value = color.name;
      }}
      onKeyDown={blurOnEnter} />
    <button type="button" className="palette-action" title="複製" onClick={() => onDuplicate(color.id)}>複製</button>
    <button type="button" className="palette-action" title="削除" onClick={() => onDelete(color.id)}>削除</button>
  </div>;
}

export function PalettePanel({ palette, onCreate, onRename, onRecolor, onDelete, onDuplicate, onImport }: PalettePanelProps) {
  return (
    <aside className="sidebar palette" aria-label="パレット">
      <div className="panel-heading"><h2>パレット</h2><span>{String(palette.length).padStart(2, "0")}</span></div>
      {palette.length === 0
        ? <p className="panel-empty">名前付きの色を登録すると、塗り・線・文字などの色入力から再利用できます。</p>
        : <div className="palette-list">
            {palette.map((color) => <PaletteItem key={color.id} color={color}
              onRename={onRename} onRecolor={onRecolor} onDelete={onDelete} onDuplicate={onDuplicate} />)}
          </div>}
      <div className="palette-actions">
        <button type="button" className="file-button" onClick={onCreate}>色を追加</button>
        <button type="button" className="file-button" onClick={onImport}>取り込み</button>
      </div>
    </aside>
  );
}
