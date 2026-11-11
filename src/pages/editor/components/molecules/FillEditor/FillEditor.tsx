import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { DEFAULT_LINEAR_FILL, DEFAULT_RADIAL_FILL } from "@/document/fill.ts";
import type { Fill, LinearFill, RadialFill } from "@/document/types.ts";

function pointEditor(label: string, point: { x: number; y: number }, onChange: (point: { x: number; y: number }) => void) {
  return <div className="gradient-point" key={label}>
    <span>{label}</span>
    {(["x", "y"] as const).map((axis) => <label key={axis}>{axis.toUpperCase()} %
      <input key={`${point[axis]}`} type="number" min="0" max="100" step="any" defaultValue={point[axis] * 100}
        onBlur={(event) => {
          const raw = event.currentTarget.value.trim();
          const value = Number(raw) / 100;
          if (raw !== "" && Number.isFinite(value) && value >= 0 && value <= 1 && value !== point[axis]) {
            onChange({ ...point, [axis]: value });
          } else event.currentTarget.value = String(point[axis] * 100);
        }} />
    </label>)}
  </div>;
}

export function FillEditor({ label, fill, onChange }: { label: string; fill: Fill; onChange(fill: Fill): void }) {
  const gradient = typeof fill === "object" && fill !== null ? fill : null;
  function update(patch: Partial<LinearFill> | Partial<RadialFill>) {
    if (gradient) onChange({ ...gradient, ...patch } as LinearFill | RadialFill);
  }
  return <div className="fill-editor">
    <label>{label}
      <select value={gradient?.type ?? (fill === null ? "none" : "solid")} onChange={(event) => {
        const kind = event.currentTarget.value;
        const stops = gradient?.stops.map((stop) => ({ ...stop })) ?? [
          { position: 0, color: typeof fill === "string" ? fill : "#ffffff" }, { position: 1, color: "#000000" },
        ];
        onChange(kind === "none" ? null : kind === "solid" ? stops[0].color
          : kind === "radial" ? { ...DEFAULT_RADIAL_FILL, stops } : { ...DEFAULT_LINEAR_FILL, stops });
      }}>
        <option value="solid">単色</option><option value="linear">線形</option><option value="radial">放射状</option><option value="none">なし</option>
      </select>
    </label>
    {typeof fill === "string" && <ColorField label="色" value={fill} fallback="#ffffff" onChange={onChange} />}
    {gradient && <>
      {gradient.type === "linear" ? <>
        {pointEditor("始点", gradient.start, (start) => update({ start }))}
        {pointEditor("終点", gradient.end, (end) => update({ end }))}
      </> : <>
        {pointEditor("中心", gradient.center, (center) => update({ center }))}
        <label>半径 % <input key={`${gradient.radius}`} type="number" min="0" max="100" step="any" defaultValue={gradient.radius * 100}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            const value = Number(raw) / 100;
            if (raw !== "" && Number.isFinite(value) && value > 0 && value <= 1 && value !== gradient.radius) update({ radius: value });
            else event.currentTarget.value = String(gradient.radius * 100);
          }} /></label>
      </>}
      {gradient.stops.map((stop, index) => <div className="gradient-stop" key={index}>
        <label>位置 % <input key={`${stop.position}`} type="number" min="0" max="100" step="any" defaultValue={stop.position * 100}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            const value = Number(raw) / 100;
            if (raw !== "" && Number.isFinite(value) && value >= 0 && value <= 1 && value !== stop.position) {
              update({ stops: gradient.stops.map((item, offset) => offset === index ? { ...item, position: value } : item)
                .sort((a, b) => a.position - b.position) });
            } else event.currentTarget.value = String(stop.position * 100);
          }} /></label>
        <ColorField label={`色 ${index + 1}`} value={stop.color} fallback="#ffffff" onChange={(color) => update({ stops: gradient.stops.map((item, offset) => offset === index ? { ...item, color } : item) })} />
        <button type="button" disabled={gradient.stops.length <= 2} onClick={() => update({ stops: gradient.stops.filter((_, offset) => offset !== index) })}>削除</button>
      </div>)}
      <button type="button" onClick={() => {
        const stops = [...gradient.stops];
        let largest = 0;
        for (let index = 1; index < stops.length - 1; index++) if (stops[index + 1].position - stops[index].position > stops[largest + 1].position - stops[largest].position) largest = index;
        stops.splice(largest + 1, 0, { position: (stops[largest].position + stops[largest + 1].position) / 2, color: stops[largest].color });
        update({ stops });
      }}>色ストップを追加</button>
    </>}
  </div>;
}
