import { useState } from "react";

import type { CornerRadii } from "@/document/types.ts";

import { Field } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";

// 4隅を2列で並べる順。上の行に左上・右上、下の行に左下・右下を置く。
const CORNER_ROWS = [[["topLeft", "左上"], ["topRight", "右上"]], [["bottomLeft", "左下"], ["bottomRight", "右下"]]] as const;

export function uniformRadius(radii: CornerRadii): number | null {
  const values = [radii.topLeft, radii.topRight, radii.bottomRight, radii.bottomLeft];
  return values.every((value) => value === values[0]) ? values[0] : null;
}

function parseRadius(raw: string): number {
  return raw.trim() === "" ? NaN : Number(raw);
}

// 角丸は1つの値でまとめて入力し、右端の切り換えで4隅を別々に入力する。隅ごとに値が違うときは最初から4隅を出す。
export function CornerRadiiEditor({ radii, onChange }: { radii: CornerRadii; onChange(radii: CornerRadii): void }) {
  const uniform = uniformRadius(radii);
  const [separate, setSeparate] = useState(uniform === null);
  return <div className="corner-radii">
    <div className="corner-radii-row">
      <Field className="is-wide-label" label="角丸" type="number" min="0" step="any" disabled={separate}
        value={uniform === null ? "" : String(uniform)} placeholder={uniform === null ? "混在" : undefined}
        onCommit={(raw) => { const value = parseRadius(raw); onChange({ topLeft: value, topRight: value, bottomRight: value, bottomLeft: value }); }} />
      <IconButton icon="corners" label="4隅を別々に入力" pressed={separate} onClick={() => setSeparate(!separate)} />
    </div>
    {separate && CORNER_ROWS.map((row) => <div key={row[0][0]} className="field-pair">
      {row.map(([corner, label]) => <Field key={corner} className="is-wide-label" label={label} type="number" min="0" step="any"
        value={String(radii[corner])} onCommit={(raw) => onChange({ ...radii, [corner]: parseRadius(raw) })} />)}
    </div>)}
  </div>;
}
