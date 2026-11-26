import { useState } from "react";

import type { AnimationTimingPatch } from "@/document/commands/index.ts";
import type { Animation, AnimationTrigger } from "@/document/types";

import { Field } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";
import { SelectField } from "@/pages/editor/components/atoms/SelectField";

export const TRIGGERS: readonly { value: AnimationTrigger; label: string }[] = [
  { value: "load", label: "読み込み" }, { value: "hover", label: "ホバー" }, { value: "click", label: "クリック" }, { value: "scroll", label: "スクロール" },
];

// アニメーションの全体の長さ。遅延と、長さを繰り返した分を足す。
export function animationLength(animation: Animation): number {
  return animation.delay + animation.duration * animation.repeat;
}

function parseAtLeast(raw: string, min: number, current: number): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) && value >= min && value !== current ? value : null;
}

type TimelineHeaderProps = {
  animations: readonly Animation[];
  active: Animation | null;
  canAdd: boolean;
  playhead: number;
  playing: boolean;
  onSelect(id: string): void;
  onAdd(): void;
  onRemove(id: string): void;
  onSetTiming(id: string, patch: AnimationTimingPatch): void;
  onPlay(): void;
  onPause(): void;
  onClose(): void;
};

// タイムラインの見出し。左にアニメーションの切り換え・追加・削除・名前の変更と、トリガー・長さ・遅延・繰り返しを、右に再生と現在時刻と閉じるを並べる。
export function TimelineHeader({ animations, active, canAdd, playhead, playing, onSelect, onAdd, onRemove, onSetTiming, onPlay, onPause, onClose }: TimelineHeaderProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return <div className="timeline-header">
    <div className="timeline-settings">
      {active && renaming === active.id
        ? <Field className="timeline-name" label="名前" value={active.name} autoFocus
          onCommit={(raw) => { const name = raw.trim(); if (name && name !== active.name) onSetTiming(active.id, { name }); setRenaming(null); }} />
        : animations.length > 0 && active
          ? <Segmented label="アニメーション" className="timeline-animations" value={active.id}
            options={animations.map((animation) => ({ value: animation.id, label: animation.name }))} onChange={onSelect} />
          : <span className="timeline-empty">アニメーションはまだありません</span>}
      <IconButton icon="plus" label="アニメーションを追加" disabled={!canAdd} onClick={onAdd} />
      {active && <>
        <IconButton icon="pen" label="名前を変更" pressed={renaming === active.id} onClick={() => setRenaming(renaming === active.id ? null : active.id)} />
        <IconButton icon="trash" label="アニメーションを削除" onClick={() => onRemove(active.id)} />
        <span className="timeline-divider" aria-hidden="true" />
        <SelectField<AnimationTrigger> className="is-wider-label timeline-trigger" label="トリガー" value={active.trigger} options={TRIGGERS}
          onChange={(trigger) => onSetTiming(active.id, { trigger })} />
        <Field className="is-wide-label timeline-number" label="長さ" type="number" min="1" step="any" value={String(active.duration)}
          onCommit={(raw) => { const duration = parseAtLeast(raw, 1, active.duration); if (duration !== null) onSetTiming(active.id, { duration }); }} />
        <Field className="is-wide-label timeline-number" label="遅延" type="number" min="0" step="any" value={String(active.delay)}
          onCommit={(raw) => { const delay = parseAtLeast(raw, 0, active.delay); if (delay !== null) onSetTiming(active.id, { delay }); }} />
        <Field className="is-wider-label timeline-number" label="繰り返し" type="number" min="1" step="1" value={String(active.repeat)}
          onCommit={(raw) => { const repeat = parseAtLeast(raw, 1, active.repeat); if (repeat !== null) onSetTiming(active.id, { repeat }); }} />
      </>}
    </div>
    <div className="timeline-playback">
      <IconButton icon="play" label={playing ? "停止" : "再生"} pressed={playing} disabled={!active} onClick={playing ? onPause : onPlay} />
      <span className="timeline-time">{Math.round(playhead)} / {active ? Math.round(animationLength(active)) : 0} ms</span>
      <IconButton icon="close" label="タイムラインを閉じる" onClick={onClose} />
    </div>
  </div>;
}
