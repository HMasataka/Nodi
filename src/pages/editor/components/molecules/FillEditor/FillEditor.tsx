import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

import type { Color, Fill, FillStop, LinearFill, RadialFill } from "@/document/types.ts";
import { DEFAULT_LINEAR_FILL, DEFAULT_RADIAL_FILL } from "@/document/fill.ts";

import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { Field } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";
import { useColorResolver } from "@/pages/editor/colorContext.ts";

type FillKind = "solid" | "linear" | "radial";
type Gradient = LinearFill | RadialFill;

const KINDS: readonly { value: FillKind; label: string }[] = [{ value: "solid", label: "単色" }, { value: "linear", label: "線形" }, { value: "radial", label: "放射状" }];
const percent = (value: number) => String(Number((value * 100).toFixed(2)));
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export function gradientOf(fill: Fill): Gradient | null {
  return fill !== null && typeof fill === "object" && (fill.type === "linear" || fill.type === "radial") ? fill : null;
}

// 種類を切り換えたときの塗り。単色からは今の色を始点に、グラデーションからは最初の色の位置の色を単色にする。
export function switchFillKind(fill: Exclude<Fill, null>, kind: FillKind): Exclude<Fill, null> {
  const gradient = gradientOf(fill);
  if (kind === "solid") return gradient ? gradient.stops[0].color : fill;
  const stops = gradient?.stops.map((stop) => ({ ...stop })) ?? [{ position: 0, color: fill as Color }, { position: 1, color: "#000000" }];
  return kind === "linear" ? { ...DEFAULT_LINEAR_FILL, stops } : { ...DEFAULT_RADIAL_FILL, stops };
}

// 色の位置を足す。足した位置の色は、左隣の色の位置の色を引き継ぐ。足した色の位置の番号も返す。
export function addStop(stops: readonly FillStop[], position: number): { stops: FillStop[]; index: number } {
  const at = clampUnit(position);
  const left = [...stops].reverse().find((stop) => stop.position <= at) ?? stops[0];
  const added = { position: at, color: left.color };
  const next = [...stops, added].sort((a, b) => a.position - b.position);
  return { stops: next, index: next.indexOf(added) };
}

// 色の位置を動かす。並べ直したあとの、動かした色の位置の番号も返す。
export function moveStop(stops: readonly FillStop[], index: number, position: number): { stops: FillStop[]; index: number } {
  const moved = { ...stops[index], position: clampUnit(position) };
  const next = stops.map((stop, offset) => offset === index ? moved : stop).sort((a, b) => a.position - b.position);
  return { stops: next, index: next.indexOf(moved) };
}

function cssGradient(gradient: Gradient, resolve: (color: Color) => string): string {
  const stops = gradient.stops.map((stop) => `${resolve(stop.color)} ${percent(stop.position)}%`).join(", ");
  return gradient.type === "linear" ? `linear-gradient(90deg, ${stops})` : `radial-gradient(circle, ${stops})`;
}

function PointFields({ label, point, onChange }: { label: string; point: { x: number; y: number }; onChange(point: { x: number; y: number }): void }) {
  return <div className="field-pair">
    {(["x", "y"] as const).map((axis) => <Field key={axis} className="is-wider-label" label={`${label} ${axis.toUpperCase()}`} type="number" min="0" max="100" step="any"
      value={percent(point[axis])} onCommit={(raw) => {
        const value = Number(raw) / 100;
        if (raw.trim() !== "" && value >= 0 && value <= 1) onChange({ ...point, [axis]: value });
      }} />)}
  </div>;
}

// グラデーションの帯と、帯の下に並べた色の位置の札。帯を押すと色の位置を足し、札を押すと選び、ドラッグか矢印キーで動かす。
function GradientStops({ gradient, selected, onSelect, onChange }: { gradient: Gradient; selected: number; onSelect(index: number): void; onChange(stops: FillStop[], selected: number): void }) {
  const resolve = useColorResolver();
  const bar = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ pointerId: number; position: number } | null>(null);
  const ratioAt = (clientX: number) => {
    const rect = bar.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? clampUnit((clientX - rect.left) / rect.width) : 0;
  };
  const shown = dragging ? moveStop(gradient.stops, selected, dragging.position) : { stops: gradient.stops, index: selected };
  function finish(event: PointerEvent<HTMLButtonElement>) {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    setDragging(null);
    if (dragging.position !== gradient.stops[selected].position) onChange(shown.stops, shown.index);
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.shiftKey ? 0.1 : 0.01;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const moved = moveStop(gradient.stops, index, gradient.stops[index].position + (event.key === "ArrowLeft" ? -step : step));
      onChange(moved.stops, moved.index);
    } else if ((event.key === "Delete" || event.key === "Backspace") && gradient.stops.length > 2) {
      event.preventDefault();
      onChange(gradient.stops.filter((_, offset) => offset !== index), Math.max(0, index - 1));
    }
  }
  return <div className="gradient-stops">
    <div ref={bar} className="gradient-bar" style={{ background: cssGradient({ ...gradient, stops: shown.stops }, resolve) }}
      onPointerDown={(event) => { const added = addStop(gradient.stops, ratioAt(event.clientX)); onChange(added.stops, added.index); }} />
    <div className="gradient-markers">
      {shown.stops.map((stop, index) => <button key={index} type="button" className={`gradient-marker${index === shown.index ? " is-selected" : ""}`}
        aria-label={`色の位置 ${percent(stop.position)}%`} aria-pressed={index === shown.index}
        style={{ left: `clamp(0px, calc(${percent(stop.position)}% - 6px), calc(100% - 12px))`, ...(index === shown.index ? {} : { background: resolve(stop.color) }) }}
        onPointerDown={(event) => {
          onSelect(index);
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging({ pointerId: event.pointerId, position: stop.position });
        }}
        onPointerMove={(event) => { if (dragging?.pointerId === event.pointerId) setDragging({ ...dragging, position: ratioAt(event.clientX) }); }}
        onPointerUp={finish} onPointerCancel={() => setDragging(null)} onKeyDown={(event) => onKeyDown(event, index)} />)}
    </div>
  </div>;
}

// 塗りの中身。単色・線形・放射状を切り換え、グラデーションでは色の位置と、始点と終点か中心と半径を編集する。
export function FillEditor({ fill, onChange }: { fill: Exclude<Fill, null>; onChange(fill: Fill): void }) {
  const gradient = gradientOf(fill);
  const [selected, setSelected] = useState(0);
  const current = gradient ? Math.min(selected, gradient.stops.length - 1) : 0;
  function update(patch: Partial<LinearFill> | Partial<RadialFill>) {
    if (gradient) onChange({ ...gradient, ...patch } as Gradient);
  }
  function updateStops(stops: FillStop[], index: number) {
    setSelected(index);
    update({ stops });
  }
  const stop = gradient?.stops[current];
  return <div className="fill-editor">
    <Segmented<FillKind> label="塗りの種類" value={gradient?.type ?? "solid"} options={KINDS} onChange={(kind) => { setSelected(0); onChange(switchFillKind(fill, kind)); }} />
    {!gradient && <ColorField label="色" value={fill as Color} fallback="#ffffff" onChange={onChange} />}
    {gradient && stop && <>
      <GradientStops gradient={gradient} selected={current} onSelect={setSelected} onChange={updateStops} />
      <div className="gradient-stop-row">
        <Field className="is-wide-label" label="位置" type="number" min="0" max="100" step="any" value={percent(stop.position)}
          onCommit={(raw) => {
            const value = Number(raw) / 100;
            if (raw.trim() !== "" && value >= 0 && value <= 1) { const moved = moveStop(gradient.stops, current, value); updateStops(moved.stops, moved.index); }
          }} />
        <ColorField label="色" value={stop.color} fallback="#ffffff"
          onChange={(color) => update({ stops: gradient.stops.map((item, offset) => offset === current ? { ...item, color } : item) })} />
        <IconButton icon="trash" label="色の位置を削除" disabled={gradient.stops.length <= 2}
          onClick={() => updateStops(gradient.stops.filter((_, offset) => offset !== current), Math.max(0, current - 1))} />
      </div>
      {gradient.type === "linear" ? <>
        <PointFields label="始点" point={gradient.start} onChange={(start) => update({ start })} />
        <PointFields label="終点" point={gradient.end} onChange={(end) => update({ end })} />
        <p className="property-help">帯をクリックすると色の位置を足します。</p>
      </> : <>
        <PointFields label="中心" point={gradient.center} onChange={(center) => update({ center })} />
        <Field className="is-wide-label" label="半径" type="number" min="0" max="100" step="any" value={percent(gradient.radius)}
          onCommit={(raw) => { const value = Number(raw) / 100; if (raw.trim() !== "" && value > 0 && value <= 1) update({ radius: value }); }} />
      </>}
    </>}
  </div>;
}
