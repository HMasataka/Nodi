import { type PointerEvent, useRef } from "react";

import { ANIMATABLE_PROPERTIES, type AnimatableProperty, type Animation, type DocumentNode, type Keyframe } from "@/document/types";

import { Icon } from "@/pages/editor/components/atoms/Icon";
import { Menu, type MenuEntry } from "@/pages/editor/components/molecules/Menu";

export type KeyframeRef = { property: AnimatableProperty; time: number };

export const PROPERTY_LABELS: Record<AnimatableProperty, string> = { x: "X 位置", y: "Y 位置", scale: "拡大率", rotation: "回転", opacity: "不透明度" };

// 目盛りは長さを4等分した5か所に置き、最後だけ単位を付ける。
export function rulerTicks(duration: number): { time: number; label: string }[] {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const time = Math.round(duration * ratio);
    return { time, label: ratio === 1 ? `${time} ms` : String(time) };
  });
}

// スクロールの進み具合（0〜1）を、遅延と繰り返しを含む時刻に直す。進み具合は遅延のあと、全体の長さを動く。
export function scrollTime(animation: Animation, progress: number): number {
  return animation.delay + Math.min(Math.max(progress, 0), 1) * animation.duration * animation.repeat;
}

// 1回分の長さの中の時刻を、スクロールの進み具合に直す。1回目の繰り返しの中に置く。
export function scrollProgressAt(animation: Animation, local: number): number {
  return Math.min(Math.max(local / (animation.duration * animation.repeat), 0), 1);
}

// 再生位置（遅延と繰り返しを含む時刻）を、1回分の長さの中の時刻に直す。
export function localTime(animation: Animation, playhead: number): number {
  const elapsed = Math.max(0, playhead - animation.delay);
  if (elapsed >= animation.duration * animation.repeat) return animation.duration;
  return elapsed % animation.duration;
}

// 新しいトラックの最初のキーフレームの値。要素の今の値から始める。
export function baseValue(node: DocumentNode, property: AnimatableProperty): number {
  return property === "scale" ? 1 : node[property];
}

const percent = (time: number, duration: number) => `${(Math.min(Math.max(time / duration, 0), 1) * 100).toFixed(3)}%`;

type TimelineTracksProps = {
  animation: Animation;
  node: DocumentNode;
  // 再生位置の線を置く、1回分の長さの中の時刻。スクロールのトリガーでは進み具合を時刻に直したもの。
  current: number;
  selected: KeyframeRef | null;
  onSelect(keyframe: KeyframeRef): void;
  onSeek(local: number): void;
  onAddTrack(property: AnimatableProperty, keyframe: Keyframe): void;
};

// 時間の目盛り、プロパティごとのトラックと菱形のキーフレーム、再生位置の線とつまみ、トラックの追加を描く。目盛りかトラックを押すとその時刻へ動かす。
export function TimelineTracks({ animation, node, current, selected, onSelect, onSeek, onAddTrack }: TimelineTracksProps) {
  const area = useRef<HTMLDivElement>(null);
  const { duration } = animation;
  const missing = ANIMATABLE_PROPERTIES.filter((property) => !animation.tracks.some((track) => track.property === property));
  const addEntries: MenuEntry[] = missing.map((property) => ({ type: "item", label: PROPERTY_LABELS[property],
    onSelect: () => onAddTrack(property, { time: Math.round(current), value: baseValue(node, property), easing: "linear" }) }));
  function seekAt(event: PointerEvent<HTMLDivElement>) {
    const rect = area.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    onSeek(Math.round(ratio * duration));
  }
  return <div className="timeline-tracks">
    <div className="timeline-labels">
      <div className="timeline-ruler-spacer" />
      {animation.tracks.map((track) => <div key={track.property} className="timeline-track-label">{PROPERTY_LABELS[track.property]}</div>)}
      {missing.length > 0 && <Menu label="トラックを追加" entries={addEntries} trigger={(trigger) =>
        <button {...trigger} type="button" className="timeline-add-track"><Icon name="plus" /><span>トラックを追加</span></button>} />}
    </div>
    <div ref={area} className="timeline-area" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); seekAt(event); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event); }}>
      <div className="timeline-ruler" aria-hidden="true">
        {rulerTicks(duration).map(({ time, label }, index) => <span key={index} className="timeline-tick" style={{ left: percent(time, duration) }}>{label}</span>)}
      </div>
      {animation.tracks.map((track) => <div key={track.property} className="timeline-track-row">
        <span className="timeline-track-line" />
        {track.keyframes.map((keyframe) => {
          const isSelected = selected?.property === track.property && selected.time === keyframe.time;
          return <button key={keyframe.time} type="button" className={`timeline-keyframe${isSelected ? " is-selected" : ""}`}
            aria-label={`${PROPERTY_LABELS[track.property]} ${keyframe.time} ms のキーフレーム`} aria-pressed={isSelected}
            style={{ left: percent(keyframe.time, duration) }}
            onPointerDown={(event) => { event.stopPropagation(); onSelect({ property: track.property, time: keyframe.time }); }} />;
        })}
      </div>)}
      <div className="timeline-playhead-line" role="slider" aria-label="再生位置" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(current)}
        tabIndex={0} style={{ left: percent(current, duration) }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 100 : 10;
          if (event.key === "ArrowLeft") { event.preventDefault(); onSeek(Math.max(0, current - step)); }
          if (event.key === "ArrowRight") { event.preventDefault(); onSeek(Math.min(duration, current + step)); }
        }}>
        <span className="timeline-playhead-handle" />
      </div>
    </div>
  </div>;
}
