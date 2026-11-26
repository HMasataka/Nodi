import type { TextNode, TextStyle } from "@/document/types";

import { Field } from "@/pages/editor/components/atoms/Field";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";
import { SelectField } from "@/pages/editor/components/atoms/SelectField";

type FontFamily = TextStyle["fontFamily"];
type TextAlign = TextStyle["textAlign"];

const FAMILIES: readonly { value: FontFamily; label: string }[] = [
  { value: "default", label: "標準" }, { value: "system", label: "システム" }, { value: "serif", label: "セリフ" }, { value: "monospace", label: "等幅" },
];
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => ({ value: String(weight), label: String(weight) }));
const ALIGNS: readonly { value: TextAlign; label: string }[] = [{ value: "left", label: "左" }, { value: "center", label: "中央" }, { value: "right", label: "右" }];

const parse = (raw: string) => raw.trim() === "" ? NaN : Number(raw);

// 書体、サイズと太さ、行高と字間、揃えを並べる。値の検証は確定する側に任せる。
export function TextStyleEditor({ node: { style }, onChange }: { node: TextNode; onChange(style: Partial<TextStyle>): void }) {
  return <div className="text-style-fields">
    <SelectField<FontFamily> className="is-wide-label" label="書体" value={style.fontFamily} options={FAMILIES} onChange={(fontFamily) => onChange({ fontFamily })} />
    <div className="field-pair">
      <Field className="is-wider-label" label="サイズ" type="number" min="1" step="any" value={String(style.fontSize)}
        onCommit={(raw) => onChange({ fontSize: parse(raw) })} />
      <SelectField className="is-wide-label" label="太さ" value={String(style.fontWeight)} options={WEIGHTS} onChange={(weight) => onChange({ fontWeight: Number(weight) })} />
    </div>
    <div className="field-pair">
      <Field className="is-wide-label" label="行高" type="number" min="0.1" step="any" value={String(style.lineHeight)}
        onCommit={(raw) => onChange({ lineHeight: parse(raw) })} />
      <Field className="is-wide-label" label="字間" type="number" step="any" value={String(style.letterSpacing)}
        onCommit={(raw) => onChange({ letterSpacing: parse(raw) })} />
    </div>
    <Segmented<TextAlign> label="揃え" value={style.textAlign} options={ALIGNS} onChange={(textAlign) => onChange({ textAlign })} />
  </div>;
}
