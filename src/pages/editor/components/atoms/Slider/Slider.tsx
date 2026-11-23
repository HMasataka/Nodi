import { type KeyboardEvent, type PointerEvent, useId } from "react";

export type SliderRange = { min: number; max: number; step: number };

const clamp = (value: number, { min, max }: SliderRange) => Math.min(max, Math.max(min, value));
const snap = (value: number, range: SliderRange) => {
  const stepped = range.min + Math.round((value - range.min) / range.step) * range.step;
  // 刻みの計算で生じる小数の誤差を、刻みの桁数で丸めて消す。
  const digits = (String(range.step).split(".")[1] ?? "").length;
  return clamp(Number(stepped.toFixed(digits)), range);
};

// 値がレールの左端から右端までのどの割合にあるか。0〜1 に収める。
export function sliderRatio(value: number, { min, max }: SliderRange): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

// キーで変えた後の値。矢印は1刻み、PageUp・PageDown は10刻み、Home・End は端。対象外のキーは null。
export function sliderKeyValue(key: string, value: number, range: SliderRange): number | null {
  const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[key];
  if (delta !== undefined) return snap(value + delta * range.step, range);
  if (key === "Home") return range.min;
  if (key === "End") return range.max;
  return null;
}

// レール上の位置（0〜1）に当たる値。つまみの中心がレールの両端から 6px 内側を動くことに合わせる。
export function sliderValueAt(ratio: number, range: SliderRange): number {
  return snap(range.min + Math.min(1, Math.max(0, ratio)) * (range.max - range.min), range);
}

type SliderProps = {
  label: string;
  value: number;
  defaultValue: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  format?(value: number): string;
};

const KNOB = 12;

// ラベル・レール・12px のつまみ・値を並べたスライダー。既定値から変えたときだけ値を濃く出す。
export function Slider({ label, value, defaultValue, onChange, min = 0, max = 100, step = 1, format = String }: SliderProps) {
  const id = useId();
  const range = { min, max, step };
  const ratio = sliderRatio(value, range);
  const changed = value !== defaultValue;
  const set = (next: number) => { if (next !== value) onChange(next); };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = sliderKeyValue(event.key, value, range);
    if (next === null) return;
    event.preventDefault();
    set(next);
  }
  function fromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const travel = rect.width - KNOB;
    if (travel > 0) set(sliderValueAt((event.clientX - rect.left - KNOB / 2) / travel, range));
  }

  return <div className="slider">
    <span id={id} className="slider-label">{label}</span>
    <div className="slider-track" role="slider" tabIndex={0} aria-labelledby={id} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      aria-valuetext={format(value)} onKeyDown={onKeyDown}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus(); fromPointer(event); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event); }}>
      <span className="slider-rail" />
      {/* つまみの中心は両端から 6px 内側を動く。塗りはつまみの中心まで伸ばす。 */}
      <span className="slider-rail-filled" style={{ width: `calc(${ratio} * (100% - ${KNOB}px) + ${KNOB / 2}px)` }} />
      <span className="slider-knob" style={{ left: `calc(${ratio} * (100% - ${KNOB}px))` }} />
    </div>
    <output className={changed ? "slider-value is-changed" : "slider-value"} htmlFor={id}>{format(value)}</output>
  </div>;
}
