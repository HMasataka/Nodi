import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import type { Shadow } from "@/document/types.ts";

import { blurOnEnter } from "@/pages/editor/components/atoms/Field";

const DEFAULT_SHADOW: Shadow = { color: "#00000080", offsetX: 0, offsetY: 4, blur: 8 };

export function ShadowEditor({ shadow, onChange }: { shadow: Shadow | null; onChange(shadow: Shadow | null): void }) {
  return <div className="shadow-editor">
    <label className="mask-control"><input type="checkbox" checked={shadow !== null}
      onChange={(event) => onChange(event.currentTarget.checked ? { ...DEFAULT_SHADOW } : null)} />外側影</label>
    {shadow && <>
      <ColorField label="影色" value={shadow.color} fallback="#00000080" onChange={(color) => onChange({ ...shadow, color })} />
      {(["offsetX", "offsetY", "blur"] as const).map((field) => <label className="geometry-field" key={field}>
        <span>{field === "offsetX" ? "横 px" : field === "offsetY" ? "縦 px" : "ぼかし px"}</span>
        <input key={`${shadow[field]}`} type="number" min={field === "blur" ? "0" : undefined} step="any" defaultValue={shadow[field]}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            const value = Number(raw);
            if (raw !== "" && Number.isFinite(value) && (field !== "blur" || value >= 0) && value !== shadow[field]) onChange({ ...shadow, [field]: value });
            else event.currentTarget.value = String(shadow[field]);
          }}
          onKeyDown={blurOnEnter} />
      </label>)}
    </>}
  </div>;
}
