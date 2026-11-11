import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { DEFAULT_LINEAR_FILL } from "@/document/fill.ts";
import type { Fill, LinearFill } from "@/document/types.ts";

export function FillEditor({ label, fill, onChange }: { label: string; fill: Fill; onChange(fill: Fill): void }) {
  const gradient = typeof fill === "object" && fill !== null ? fill : null;
  function update(patch: Partial<LinearFill>) {
    if (gradient) onChange({ ...gradient, ...patch });
  }
  return <div className="fill-editor">
    <label>{label}
      <select value={gradient ? "linear" : fill === null ? "none" : "solid"} onChange={(event) => {
        const kind = event.currentTarget.value;
        onChange(kind === "none" ? null : kind === "solid" ? (gradient?.stops[0].color ?? "#ffffff")
          : { ...structuredClone(DEFAULT_LINEAR_FILL), stops: [
            { position: 0, color: typeof fill === "string" ? fill : "#ffffff" },
            { position: 1, color: "#000000" },
          ] });
      }}>
        <option value="solid">単色</option><option value="linear">線形</option><option value="none">なし</option>
      </select>
    </label>
    {typeof fill === "string" && <ColorField label="色" value={fill} fallback="#ffffff" onChange={onChange} />}
    {gradient && <>
      {(["start", "end"] as const).map((end) => <div className="gradient-point" key={end}>
        <span>{end === "start" ? "始点" : "終点"}</span>
        {(["x", "y"] as const).map((axis) => <label key={axis}>{axis.toUpperCase()} %
          <input key={`${gradient[end][axis]}`} type="number" min="0" max="100" step="any" defaultValue={gradient[end][axis] * 100}
            onBlur={(event) => {
              const raw = event.currentTarget.value.trim();
              const value = Number(raw) / 100;
              if (raw !== "" && Number.isFinite(value) && value >= 0 && value <= 1 && value !== gradient[end][axis]) {
                update({ [end]: { ...gradient[end], [axis]: value } });
              } else event.currentTarget.value = String(gradient[end][axis] * 100);
            }} />
        </label>)}
      </div>)}
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
