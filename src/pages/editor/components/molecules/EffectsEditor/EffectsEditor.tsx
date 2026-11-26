import type { Shadow } from "@/document/types.ts";

import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { Field } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";

export const DEFAULT_SHADOW: Shadow = { color: "#00000029", offsetX: 0, offsetY: 8, blur: 24 };
export const DEFAULT_BLUR = 4;

export type Effects = { shadow: Shadow | null; blur: number };

// 見出しの＋で足す効果。影から順に、まだ持っていないものを足す。どちらも持っていれば null。
export function nextEffect(effects: Effects): Partial<Effects> | null {
  if (effects.shadow === null) return { shadow: { ...DEFAULT_SHADOW } };
  if (effects.blur === 0) return { blur: DEFAULT_BLUR };
  return null;
}

function parseNumber(raw: string, min?: number): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) && (min === undefined || value >= min) ? value : null;
}

function EffectHeading({ title, onRemove }: { title: string; onRemove(): void }) {
  return <div className="effect-heading">
    <span>{title}</span>
    <IconButton icon="minus" label={`${title}を外す`} onClick={onRemove} />
  </div>;
}

// 効果の節の中身。持っている効果だけを、見出しと外す操作つきで並べる。
export function EffectsEditor({ shadow, blur, onShadow, onBlur }: Effects & { onShadow(shadow: Shadow | null): void; onBlur(blur: number): void }) {
  if (shadow === null && blur === 0) return null;
  return <div className="effects-editor">
    {shadow && <div className="effect">
      <EffectHeading title="影" onRemove={() => onShadow(null)} />
      <ColorField label="色" value={shadow.color} fallback={DEFAULT_SHADOW.color} onChange={(color) => onShadow({ ...shadow, color })} />
      <div className="field-pair">
        {(["offsetX", "offsetY"] as const).map((key) => <Field key={key} label={key === "offsetX" ? "X" : "Y"} type="number" step="any" value={String(shadow[key])}
          onCommit={(raw) => { const value = parseNumber(raw); if (value !== null) onShadow({ ...shadow, [key]: value }); }} />)}
      </div>
      <Field className="is-wider-label" label="ぼかし" type="number" min="0" step="any" value={String(shadow.blur)}
        onCommit={(raw) => { const value = parseNumber(raw, 0); if (value !== null) onShadow({ ...shadow, blur: value }); }} />
    </div>}
    {blur > 0 && <div className="effect">
      <EffectHeading title="全体ぼかし" onRemove={() => onBlur(0)} />
      <Field className="is-wider-label" label="ぼかし" type="number" min="0" step="any" value={String(blur)}
        onCommit={(raw) => { const value = parseNumber(raw, 0); if (value !== null) onBlur(value); }} />
    </div>}
  </div>;
}
