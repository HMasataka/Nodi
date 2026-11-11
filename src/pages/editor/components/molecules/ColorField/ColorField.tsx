import { useEffect, useState } from "react";

import { alphaByte, rgbColor, withAlphaByte, withRgbColor } from "@/document/color.ts";

export function ColorField({ label, value, fallback, disabled = false, onChange }: {
  label: string; value: string | null; fallback: string; disabled?: boolean; onChange(color: string): void;
}) {
  const current = value ?? fallback;
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
  </div>;
}
