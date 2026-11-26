import { type Easing, EASINGS, type Keyframe } from "@/document/types";

import { Field } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";

const EASING_OPTIONS = EASINGS.map((easing) => ({ value: easing, label: easing }));

type KeyframeSettingsProps = {
  keyframe: Keyframe | null;
  canAdd: boolean;
  onTime(time: number): void;
  onValue(value: number): void;
  onEasing(easing: Easing): void;
  onAdd(): void;
  onRemove(): void;
};

function parse(raw: string, min?: number): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) && (min === undefined || value >= min) ? value : null;
}

// タイムラインの下端の行。選んだキーフレームの時刻・値・イージングと、再生位置へのキーフレームの追加・削除を並べる。
export function KeyframeSettings({ keyframe, canAdd, onTime, onValue, onEasing, onAdd, onRemove }: KeyframeSettingsProps) {
  return <div className="keyframe-settings">
    <span className="keyframe-settings-title">キーフレーム</span>
    {keyframe ? <>
      <Field className="is-wide-label keyframe-settings-time" label="時刻" type="number" min="0" step="any" value={String(keyframe.time)}
        onCommit={(raw) => { const time = parse(raw, 0); if (time !== null && time !== keyframe.time) onTime(time); }} />
      <Field className="keyframe-settings-value" label="値" type="number" step="any" value={String(keyframe.value)}
        onCommit={(raw) => { const value = parse(raw); if (value !== null && value !== keyframe.value) onValue(value); }} />
      <Segmented<Easing> label="イージング" className="keyframe-settings-easing" value={keyframe.easing} options={EASING_OPTIONS} onChange={onEasing} />
    </> : <span className="keyframe-settings-empty">トラックのキーフレームを選ぶと編集できます</span>}
    <IconButton icon="keyframeAdd" label="再生位置にキーフレームを追加" disabled={!canAdd} onClick={onAdd} />
    <IconButton icon="trash" label="キーフレームを削除" disabled={!keyframe} onClick={onRemove} />
  </div>;
}
