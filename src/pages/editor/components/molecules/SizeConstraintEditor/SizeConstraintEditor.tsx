import type { DocumentNode, SizeConstraint, SizeMode } from "@/document/types";
import type { SizeAxis, SizeConstraintPatch } from "@/document/commands/index.ts";

import { Field } from "@/pages/editor/components/atoms/Field";
import { SelectField } from "@/pages/editor/components/atoms/SelectField";

const MODES: readonly { value: SizeMode; label: string }[] = [{ value: "fixed", label: "固定" }, { value: "fill", label: "伸縮" }, { value: "hug", label: "内容" }];
const AXES: readonly [SizeAxis, string][] = [["width", "幅"], ["height", "高さ"]];

// 最小・最大は固定以外のモードで使うので、そのときか値が入っているときだけ出す。
export function showsSizeLimits(constraint: SizeConstraint): boolean {
  return constraint.mode !== "fixed" || constraint.min !== undefined || constraint.max !== undefined;
}

function limitPatch(key: "min" | "max", raw: string, current: number | undefined): SizeConstraintPatch | null {
  if (raw.trim() === "") return current === undefined ? null : { [key]: undefined };
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value !== current ? { [key]: value } : null;
}

// 幅と高さのサイズモードを選択式の入力欄で2列に並べ、その下に軸ごとの最小・最大を出す。
export function SizeConstraintEditor({ node, onChange }: { node: DocumentNode; onChange(axis: SizeAxis, patch: SizeConstraintPatch): void }) {
  const constraints: Record<SizeAxis, SizeConstraint> = { width: node.widthConstraint, height: node.heightConstraint };
  return <div className="size-constraint-fields" role="group" aria-label="サイズモード">
    <div className="field-pair">
      {AXES.map(([axis, label]) => <SelectField key={axis} className="is-wide-label" label={label} value={constraints[axis].mode} options={MODES}
        onChange={(mode) => onChange(axis, { mode })} />)}
    </div>
    {AXES.filter(([axis]) => showsSizeLimits(constraints[axis])).map(([axis, label]) => <div key={axis} className="field-pair">
      {(["min", "max"] as const).map((key) => <Field key={key} className="is-wide-label" label={`${label}${key === "min" ? "最小" : "最大"}`}
        type="number" min="0" step="any" placeholder="なし" value={constraints[axis][key] === undefined ? "" : String(constraints[axis][key])}
        onCommit={(raw) => { const patch = limitPatch(key, raw, constraints[axis][key]); if (patch) onChange(axis, patch); }} />)}
    </div>)}
  </div>;
}
