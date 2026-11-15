import { useEffect, useState } from "react";

import type { Color } from "@/document/types.ts";
import { alphaByte, rgbColor, withAlphaByte, withRgbColor } from "@/document/color.ts";
import { useColorResolver, usePalette } from "@/pages/editor/colorContext.ts";

export function ColorField({ label, value, fallback, disabled = false, onChange }: {
  label: string; value: Color | null; fallback: Color; disabled?: boolean; onChange(color: Color): void;
}) {
  const resolve = useColorResolver();
  const palette = usePalette();
  const current = resolve(value ?? fallback);
  const isRef = value !== null && typeof value === "object";
  const [rgb, setRgb] = useState(rgbColor(current));
  const [alpha, setAlpha] = useState(String(alphaByte(current)));
  useEffect(() => {
    setRgb(rgbColor(current));
    setAlpha(String(alphaByte(current)));
  }, [current]);
  const commitAlpha = () => {
    const next = Number(alpha);
    if (!/^\d+$/.test(alpha) || !Number.isInteger(next) || next < 0 || next > 255) {
      setAlpha(String(alphaByte(current)));
      return;
    }
    setAlpha(String(next));
    if (next !== alphaByte(current)) onChange(withAlphaByte(current, next));
  };
  return <div className="color-field">
    <label>{label}
      <input type="color" value={rgb} disabled={disabled} onChange={(event) => setRgb(event.currentTarget.value)}
        onBlur={() => { if (rgb !== rgbColor(current)) onChange(withRgbColor(current, rgb)); }} />
    </label>
    <label>α（0–255）
      <input type="number" min="0" max="255" step="1" value={alpha} disabled={disabled}
        onChange={(event) => setAlpha(event.currentTarget.value)}
        onBlur={commitAlpha} />
    </label>
    {palette.length > 0 && <label className="color-palette-select">パレット
      <select value={isRef ? value.id : ""} disabled={disabled}
        onChange={(event) => {
          const id = event.currentTarget.value;
          onChange(id === "" ? current : { type: "palette", id });
        }}>
        <option value="">直接指定</option>
        {palette.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}
      </select>
    </label>}
  </div>;
}
