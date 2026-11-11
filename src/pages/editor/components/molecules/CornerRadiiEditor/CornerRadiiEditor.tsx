import { useState } from "react";

import type { CornerRadii } from "@/document/types.ts";

const corners = [
  ["topLeft", "左上"], ["topRight", "右上"], ["bottomRight", "右下"], ["bottomLeft", "左下"],
] as const;

export function CornerRadiiEditor({ radii, onChange }: { radii: CornerRadii; onChange(radii: CornerRadii): void }) {
  const [values, setValues] = useState(() => ({
    topLeft: String(radii.topLeft), topRight: String(radii.topRight),
    bottomRight: String(radii.bottomRight), bottomLeft: String(radii.bottomLeft),
  }));
  return <fieldset className="corner-radii-fields">
    <legend>角丸</legend>
    {corners.map(([corner, label]) => <label key={corner}>{label}
      <input type="number" min="0" step="any" value={values[corner]}
        onChange={(event) => setValues((current) => ({ ...current, [corner]: event.currentTarget.value }))}
        onBlur={() => { if (values[corner] !== String(radii[corner])) onChange({ ...radii, [corner]: values[corner].trim() === "" ? NaN : Number(values[corner]) }); }} />
    </label>)}
  </fieldset>;
}
