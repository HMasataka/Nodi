import { useState } from "react";

import type { Border, BoxStyle, Color, ShapeStyle, Stroke } from "@/document/types.ts";

import { Checkbox } from "@/pages/editor/components/atoms/Checkbox";
import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { Field } from "@/pages/editor/components/atoms/Field";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";

export type StrokeScope = "all" | keyof Border;
export type StrokePatch = { stroke?: Stroke | null; border?: Border };

const SCOPES: readonly { value: StrokeScope; label: string }[] = [
  { value: "all", label: "全辺" }, { value: "top", label: "上" }, { value: "right", label: "右" }, { value: "bottom", label: "下" }, { value: "left", label: "左" },
];
export const DEFAULT_STROKE: Stroke = { color: "#000000", width: 1 };

// 線を持っているか。全辺の線か、いずれかの辺の線があれば持っているとみなす。
export function hasStroke(style: ShapeStyle | BoxStyle): boolean {
  return style.stroke !== null || ("border" in style && Object.keys(style.border).length > 0);
}

function parseWidth(raw: string): number {
  return raw.trim() === "" ? NaN : Number(raw);
}

// 線の色と太さ。矩形とフレームは、全辺・上・右・下・左を切り換えて辺ごとの線を編集する。辺ごとの線は角丸が 0 のときだけ使える。
export function StrokeEditor({ style, onChange }: { style: ShapeStyle | BoxStyle; onChange(patch: StrokePatch): void }) {
  const border = "border" in style ? style.border : null;
  const rounded = "cornerRadii" in style && Object.values(style.cornerRadii).some((radius) => radius !== 0);
  const [scope, setScope] = useState<StrokeScope>("all");
  const active: StrokeScope = border && !rounded ? scope : "all";
  const edge = active === "all" ? style.stroke : border?.[active] ?? null;
  const current = edge ?? style.stroke ?? DEFAULT_STROKE;
  function update(next: Stroke | null) {
    if (active === "all") { onChange({ stroke: next }); return; }
    const updated: Border = { ...border };
    if (next) updated[active] = next;
    else delete updated[active];
    onChange({ border: updated });
  }
  return <div className="stroke-editor">
    {border && !rounded && <Segmented<StrokeScope> label="線を引く辺" value={active} options={SCOPES} onChange={setScope} />}
    {active !== "all" && <Checkbox label="この辺に線を引く" checked={edge !== null} onChange={(checked) => update(checked ? { ...current } : null)} />}
    <ColorField label="色" value={current.color} fallback={DEFAULT_STROKE.color}
      onChange={(color: Color) => update({ ...current, color })} />
    <Field className="is-wide-label" label="太さ" type="number" min="0" step="any" value={String(current.width)}
      onCommit={(raw) => update({ ...current, width: parseWidth(raw) })} />
    {border && rounded && <p className="property-help">辺ごとの線は、角丸が 0 のときだけ引けます。</p>}
  </div>;
}
