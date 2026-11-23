import { evaluateAnimation } from "@/document/animation.ts";
import type { Playback } from "@/pages/editor/hooks/usePlayback";
import type { AnimatableProperty, DocumentNode, Keyframe } from "@/document/types";
import type { AnimationTimingPatch, KeyframePatch } from "@/document/commands/index.ts";

import { blurOnEnter } from "@/pages/editor/components/atoms/Field";

interface TimelineProps {
  node?: DocumentNode;
  playback: Playback;
  scrollProgress: number;
  onScrollProgress(progress: number): void;
  onAddAnimation(): void;
  onRemoveAnimation(id: string): void;
  onSetTiming(id: string, patch: AnimationTimingPatch): void;
  onAddKeyframe(id: string, property: AnimatableProperty, keyframe: Keyframe): void;
  onSetKeyframe(id: string, property: AnimatableProperty, time: number, patch: KeyframePatch): void;
  onRemoveKeyframe(id: string, property: AnimatableProperty, time: number): void;
}

function numberInput(value: number, onCommit: (value: number) => void, min?: number) {
  return <input key={String(value)} type="number" min={min} step="any" defaultValue={String(value)}
    onBlur={(event) => {
      const raw = event.currentTarget.value.trim();
      const parsed = Number(raw);
      if (raw !== "" && Number.isFinite(parsed) && (min === undefined || parsed >= min) && parsed !== value) onCommit(parsed);
      else event.currentTarget.value = String(value);
    }}
    onKeyDown={blurOnEnter} />;
}

export function Timeline({ node, playback, scrollProgress, onScrollProgress, onAddAnimation, onRemoveAnimation, onSetTiming, onAddKeyframe, onSetKeyframe, onRemoveKeyframe }: TimelineProps) {
  const animations = node?.animations ?? [];
  const maxTime = animations.reduce((max, animation) => Math.max(max, animation.delay + animation.duration * animation.repeat), 0);
  const hasScroll = animations.some((animation) => animation.trigger === "scroll");

  return <div className="timeline" aria-label="タイムライン">
    <div className="timeline-playhead">
      <button type="button" className="file-button" onClick={() => (playback.playing ? playback.pause() : playback.play())}
        aria-label={playback.playing ? "停止" : "再生"}>{playback.playing ? "⏸" : "▶"}</button>
      <button type="button" className="file-button" onClick={playback.stop} aria-label="先頭へ戻す">⏹</button>
      <span className="timeline-time">{Math.round(playback.playhead)} ms</span>
      <input type="range" min="0" max={Math.max(1, Math.round(maxTime))} step="1" value={Math.round(playback.playhead)}
        onChange={(event) => playback.seek(Number(event.currentTarget.value))} disabled={maxTime <= 0} />
    </div>
    {hasScroll && <div className="timeline-scroll">
      <span className="timeline-time">スクロール</span>
      <input type="range" min="0" max="1" step="0.01" value={scrollProgress}
        onChange={(event) => onScrollProgress(Number(event.currentTarget.value))} />
    </div>}

    {animations.length === 0 && <p className="timeline-empty">要素を選ぶとアニメーションを追加できます。</p>}
    {animations.map((animation) => <div key={animation.id} className="timeline-animation">
      <div className="timeline-animation-head">
        <input key={`${animation.id}:${animation.name}`} defaultValue={animation.name}
          onBlur={(event) => { const value = event.currentTarget.value.trim(); if (value && value !== animation.name) onSetTiming(animation.id, { name: value }); }}
          onKeyDown={blurOnEnter} />
        <select value={animation.trigger} onChange={(event) => onSetTiming(animation.id, { trigger: event.currentTarget.value as AnimationTimingPatch["trigger"] })}>
          <option value="load">読み込み</option><option value="hover">ホバー</option>
          <option value="click">クリック</option><option value="scroll">スクロール</option>
        </select>
        <button type="button" className="file-button" onClick={() => onRemoveAnimation(animation.id)}>削除</button>
      </div>
      <div className="timeline-timing">
        <label>長さ {numberInput(animation.duration, (duration) => onSetTiming(animation.id, { duration }), 1)}</label>
        <label>遅延 {numberInput(animation.delay, (delay) => onSetTiming(animation.id, { delay }), 0)}</label>
        <label>繰り返し {numberInput(animation.repeat, (repeat) => onSetTiming(animation.id, { repeat }), 1)}</label>
      </div>
      {animation.tracks.map((track) => <div key={track.property} className="timeline-track">
        <span className="timeline-property">{track.property}</span>
        {track.keyframes.map((keyframe) => <div key={keyframe.time} className="timeline-keyframe">
          <label>時刻 {numberInput(keyframe.time, (time) => onSetKeyframe(animation.id, track.property, keyframe.time, { time }), 0)}</label>
          <label>値 {numberInput(keyframe.value, (value) => onSetKeyframe(animation.id, track.property, keyframe.time, { value }))}</label>
          <select value={keyframe.easing} onChange={(event) => onSetKeyframe(animation.id, track.property, keyframe.time, { easing: event.currentTarget.value as KeyframePatch["easing"] })}>
            <option value="linear">linear</option><option value="ease-in">ease-in</option>
            <option value="ease-out">ease-out</option><option value="ease-in-out">ease-in-out</option>
          </select>
          <button type="button" className="file-button" onClick={() => onRemoveKeyframe(animation.id, track.property, keyframe.time)}>−</button>
        </div>)}
        <button type="button" className="file-button" onClick={() => {
          const value = evaluateAnimation(animation, playback.playhead)[track.property] ?? 0;
          onAddKeyframe(animation.id, track.property, { time: Math.round(playback.playhead), value, easing: "linear" });
        }}>＋ キーフレーム</button>
      </div>)}
    </div>)}

    <div className="timeline-add">
      <button type="button" className="file-button" onClick={onAddAnimation} disabled={!node}>＋ アニメーション</button>
    </div>
  </div>;
}
