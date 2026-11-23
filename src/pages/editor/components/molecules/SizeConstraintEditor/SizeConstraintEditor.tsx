import type { DocumentNode, SizeConstraint, SizeMode } from "@/document/types";
import type { SizeAxis, SizeConstraintPatch } from "@/document/commands/index.ts";

import { blurOnEnter } from "@/pages/editor/components/atoms/Field";

function ConstraintControls({ label, constraint, onChange }: { label: string; constraint: SizeConstraint; onChange(patch: SizeConstraintPatch): void }) {
  return <div className="constraint-controls">
    <label className="geometry-field"><span>{label}</span>
      <select value={constraint.mode} onChange={(event) => onChange({ mode: event.currentTarget.value as SizeMode })}>
        <option value="fixed">固定</option><option value="fill">伸縮</option><option value="hug">内容</option>
      </select>
    </label>
    <label className="geometry-field"><span>{label} 最小 px</span>
      <input key={`${label}-min-${constraint.min ?? ""}`} type="number" min="0" step="any" defaultValue={constraint.min ?? ""}
        onBlur={(event) => {
          const raw = event.currentTarget.value.trim();
          if (raw === "") { onChange({ min: undefined }); return; }
          const value = Number(raw);
          if (Number.isFinite(value) && value > 0 && value !== constraint.min) onChange({ min: value });
          else event.currentTarget.value = constraint.min === undefined ? "" : String(constraint.min);
        }}
        onKeyDown={blurOnEnter} />
    </label>
    <label className="geometry-field"><span>{label} 最大 px</span>
      <input key={`${label}-max-${constraint.max ?? ""}`} type="number" min="0" step="any" defaultValue={constraint.max ?? ""}
        onBlur={(event) => {
          const raw = event.currentTarget.value.trim();
          if (raw === "") { onChange({ max: undefined }); return; }
          const value = Number(raw);
          if (Number.isFinite(value) && value > 0 && value !== constraint.max) onChange({ max: value });
          else event.currentTarget.value = constraint.max === undefined ? "" : String(constraint.max);
        }}
        onKeyDown={blurOnEnter} />
    </label>
  </div>;
}

export function SizeConstraintEditor({ node, onChange }: { node: DocumentNode; onChange(axis: SizeAxis, patch: SizeConstraintPatch): void }) {
  return <div className="size-constraint-fields">
    <div className="field-label">サイズモード</div>
    <ConstraintControls label="幅" constraint={node.widthConstraint} onChange={(patch) => onChange("width", patch)} />
    <ConstraintControls label="高さ" constraint={node.heightConstraint} onChange={(patch) => onChange("height", patch)} />
    <p className="property-help">「固定」は位置・サイズの値を使い、「伸縮」は親フレームの空きや内寸へ合わせ、「内容」はテキストの内容に合わせます。</p>
  </div>;
}
