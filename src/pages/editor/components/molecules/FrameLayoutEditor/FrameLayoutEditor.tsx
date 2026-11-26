import type { FrameLayoutPatch } from "@/document/commands/index.ts";
import type { FrameNode, LayoutAlignment, LayoutJustify, LayoutMode, SpacingToken } from "@/document/types";

import { Checkbox } from "@/pages/editor/components/atoms/Checkbox";
import { Field } from "@/pages/editor/components/atoms/Field";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";
import { SelectField } from "@/pages/editor/components/atoms/SelectField";

const MODES: readonly { value: LayoutMode; label: string }[] = [{ value: "none", label: "なし" }, { value: "vertical", label: "縦" }, { value: "horizontal", label: "横" }];
const ALIGNMENTS: readonly { value: LayoutAlignment; label: string }[] = [{ value: "start", label: "始点" }, { value: "center", label: "中央" }, { value: "end", label: "終点" }];
const JUSTIFY: readonly { value: LayoutJustify; label: string }[] = [...ALIGNMENTS, { value: "space-between", label: "均等" }];

function parseSpacing(raw: string, current: number): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) && value >= 0 && value !== current ? value : null;
}

type SpacingKey = "gap" | "padding";

// 間隔と余白は、直接の値か、アセットの余白（共通値）の参照を持つ。参照中は共通値を出して直接の入力を止める。
function SpacingFields({ node, tokens, onChange }: { node: FrameNode; tokens: SpacingToken[]; onChange(patch: FrameLayoutPatch): void }) {
  const fields: readonly [SpacingKey, string][] = [["gap", "間隔"], ["padding", "余白"]];
  const refOf = (key: SpacingKey) => key === "gap" ? node.gapRef : node.paddingRef;
  const tokenOf = (key: SpacingKey) => tokens.find((token) => token.id === refOf(key));
  const options = [{ value: "", label: "直接指定" }, ...tokens.map((token) => ({ value: token.id, label: `${token.name} · ${token.value}px` }))];
  return <>
    <div className="field-pair">
      {fields.map(([key, label]) => <Field key={key} className="is-wide-label" label={label} type="number" min="0" step="any"
        value={String(tokenOf(key)?.value ?? node[key])} disabled={!!refOf(key)}
        onCommit={(raw) => { const value = parseSpacing(raw, node[key]); if (value !== null) onChange({ [key]: value }); }} />)}
    </div>
    {tokens.length > 0 && <div className="field-pair">
      {fields.map(([key, label]) => <SelectField key={key} className="is-wide-label" label={label} aria-label={`${label}の共通値`} value={refOf(key) ?? ""}
        options={options} onChange={(id) => onChange(key === "gap" ? { gapRef: id || null } : { paddingRef: id || null })} />)}
    </div>}
    {fields.flatMap(([key, label]) => { const token = tokenOf(key); return token ? [<p key={key} className="spacing-reference-note">{label}：{token.name} · 共通値を編集すると反映</p>] : []; })}
  </>;
}

// フレームの節。自動レイアウトの向き、間隔と余白、揃えと配分、はみ出しを隠すを並べる。向きが「なし」のときは並べ方の設定を出さない。
export function FrameLayoutEditor({ node, tokens = [], onChange, onClipContent }: {
  node: FrameNode; tokens?: SpacingToken[]; onChange(patch: FrameLayoutPatch): void; onClipContent?(clip: boolean): void;
}) {
  return <div className="frame-layout-fields">
    <Segmented<LayoutMode> label="自動レイアウトの向き" value={node.layoutMode} options={MODES} onChange={(layoutMode) => onChange({ layoutMode })} />
    {node.layoutMode !== "none" && <>
      <SpacingFields node={node} tokens={tokens} onChange={onChange} />
      <Segmented<LayoutAlignment> label="揃え" value={node.alignItems} options={ALIGNMENTS} onChange={(alignItems) => onChange({ alignItems })} />
      <Segmented<LayoutJustify> label="配分" value={node.justifyContent} options={JUSTIFY} onChange={(justifyContent) => onChange({ justifyContent })} />
    </>}
    {onClipContent && <Checkbox label="はみ出しを隠す" checked={node.clipContent} onChange={onClipContent} />}
  </div>;
}
