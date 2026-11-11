import { useState } from "react";

import type { ImageFilters, ImageNode, ImageStyle } from "@/document/types";

const filterFields = [
  { key: "brightness", label: "明るさ", min: 0 },
  { key: "contrast", label: "コントラスト", min: 0 },
  { key: "saturate", label: "彩度", min: 0 },
  { key: "grayscale", label: "グレースケール", min: 0, max: 1 },
  { key: "sepia", label: "セピア", min: 0, max: 1 },
  { key: "hueRotate", label: "色相 °" },
] as const;

function FilterField({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange(value: number): void }) {
  const [draft, setDraft] = useState(String(value));
  return <label>{label}
    <input type="number" step="any" min={min} max={max} value={draft} onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => { if (draft !== String(value)) onChange(draft.trim() === "" ? NaN : Number(draft)); }} />
  </label>;
}

export function ImageStyleEditor({ node: { style }, onChange }: { node: ImageNode; onChange(style: Partial<ImageStyle>): void }) {
  const [x, setX] = useState(String(style.focalPoint.x));
  const [y, setY] = useState(String(style.focalPoint.y));
  return <div className="text-style-fields">
    <label>フィット
      <select value={style.fit} onChange={(event) => onChange({ fit: event.currentTarget.value as ImageStyle["fit"] })}>
        <option value="cover">枠を覆う</option><option value="contain">全体を表示</option><option value="fill">枠に伸縮</option>
      </select>
    </label>
    <label>焦点 X（0–1）
      <input type="number" min="0" max="1" step="0.01" value={x} onChange={(event) => setX(event.currentTarget.value)}
        onBlur={() => { if (x !== String(style.focalPoint.x)) onChange({ focalPoint: { x: x.trim() === "" ? NaN : Number(x), y: style.focalPoint.y } }); }} />
    </label>
    <label>焦点 Y（0–1）
      <input type="number" min="0" max="1" step="0.01" value={y} onChange={(event) => setY(event.currentTarget.value)}
        onBlur={() => { if (y !== String(style.focalPoint.y)) onChange({ focalPoint: { x: style.focalPoint.x, y: y.trim() === "" ? NaN : Number(y) } }); }} />
    </label>
    <p>枠を覆う場合は焦点に合わせて切り抜き、全体を表示する場合は焦点に合わせて余白を配置します。</p>
    <fieldset className="image-filter-fields">
      <legend>色調整・フィルター</legend>
      {filterFields.map(({ key, label, ...range }) => <FilterField key={key} label={label} value={style.filters[key]} {...range}
        onChange={(value) => onChange({ filters: { ...style.filters, [key]: value } as ImageFilters })} />)}
    </fieldset>
  </div>;
}
