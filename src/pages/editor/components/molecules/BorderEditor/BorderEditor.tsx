import { useState } from "react";

import type { Border, BoxStyle } from "@/document/types.ts";

const sides = [["top", "上"], ["right", "右"], ["bottom", "下"], ["left", "左"]] as const;

export function BorderEditor({ style, onChange }: { style: BoxStyle; onChange(border: Border): void }) {
  const [colors, setColors] = useState<Record<keyof Border, string>>({
    top: style.border.top?.color ?? "#000000", right: style.border.right?.color ?? "#000000",
    bottom: style.border.bottom?.color ?? "#000000", left: style.border.left?.color ?? "#000000",
  });
  const [widths, setWidths] = useState<Record<keyof Border, string>>({
    top: String(style.border.top?.width ?? 1), right: String(style.border.right?.width ?? 1),
    bottom: String(style.border.bottom?.width ?? 1), left: String(style.border.left?.width ?? 1),
  });
  const rounded = Object.values(style.cornerRadii).some((radius) => radius !== 0);
  function update(side: keyof Border, edge?: { color: string; width: number }) {
    const border = { ...style.border };
    if (edge) border[side] = edge;
    else delete border[side];
    onChange(border);
  }
  return <fieldset className="border-fields" disabled={rounded}>
    <legend>辺ごとの線{rounded ? "（角丸 0 のときのみ）" : ""}</legend>
    {sides.map(([side, label]) => <div className="border-edge" key={side}>
      <label><input type="checkbox" checked={!!style.border[side]} onChange={(event) => update(side, event.currentTarget.checked ? { color: colors[side], width: Number(widths[side]) } : undefined)} />{label}</label>
      <label>色 <input type="color" value={colors[side]} disabled={!style.border[side]} onChange={(event) => setColors({ ...colors, [side]: event.currentTarget.value })} onBlur={() => { if (style.border[side] && colors[side] !== style.border[side].color) update(side, { ...style.border[side], color: colors[side] }); }} /></label>
      <label>幅 <input type="number" min="0" step="any" value={widths[side]} disabled={!style.border[side]} onChange={(event) => setWidths({ ...widths, [side]: event.currentTarget.value })} onBlur={() => { if (style.border[side] && widths[side] !== String(style.border[side].width)) update(side, { color: colors[side], width: widths[side].trim() === "" ? NaN : Number(widths[side]) }); }} /></label>
    </div>)}
  </fieldset>;
}
