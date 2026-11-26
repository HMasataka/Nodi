import { evaluateAnimation } from "@/document/animation.ts";
import type { Playback } from "@/pages/editor/hooks/usePlayback";
import type { AnimatableProperty, Animation, DocumentNode, Keyframe } from "@/document/types";
import type { AnimationTimingPatch, KeyframePatch } from "@/document/commands/index.ts";

import { KeyframeSettings } from "@/pages/editor/components/molecules/KeyframeSettings";
import { TimelineHeader } from "@/pages/editor/components/molecules/TimelineHeader";
import { useState } from "react";

import { type KeyframeRef, localTime, TimelineTracks } from "@/pages/editor/components/molecules/TimelineTracks";

interface TimelineProps {
  node?: DocumentNode;
  playback: Playback;
  scrollProgress: number;
  onScrollProgress(progress: number): void;
  activeAnimationId: string | null;
  onSelectAnimation(id: string): void;
  onClose(): void;
  onAddAnimation(): string | null;
  onRemoveAnimation(id: string): void;
  onSetTiming(id: string, patch: AnimationTimingPatch): void;
  onAddKeyframe(id: string, property: AnimatableProperty, keyframe: Keyframe): void;
  onSetKeyframe(id: string, property: AnimatableProperty, time: number, patch: KeyframePatch): void;
  onRemoveKeyframe(id: string, property: AnimatableProperty, time: number): void;
}

// 開いているアニメーション。指定がないか見つからないときは最初のアニメーションを開く。
export function activeAnimation(animations: readonly Animation[], id: string | null): Animation | null {
  return animations.find((animation) => animation.id === id) ?? animations[0] ?? null;
}

export function Timeline({ node, playback, scrollProgress, onScrollProgress, activeAnimationId, onSelectAnimation, onClose, onAddAnimation, onRemoveAnimation, onSetTiming, onAddKeyframe, onSetKeyframe, onRemoveKeyframe }: TimelineProps) {
  const animations = node?.animations ?? [];
  const animation = activeAnimation(animations, activeAnimationId);
  const [selectedKeyframe, setSelectedKeyframe] = useState<KeyframeRef | null>(null);
  const keyframe = animation && selectedKeyframe
    ? animation.tracks.find((track) => track.property === selectedKeyframe.property)?.keyframes.find((item) => item.time === selectedKeyframe.time) ?? null : null;

  return <div className="timeline" aria-label="タイムライン">
    <TimelineHeader animations={animations} active={animation} canAdd={!!node} playhead={playback.playhead} playing={playback.playing}
      onSelect={onSelectAnimation} onAdd={() => { const id = onAddAnimation(); if (id) onSelectAnimation(id); }} onRemove={onRemoveAnimation}
      onSetTiming={onSetTiming} onPlay={playback.play} onPause={playback.pause} onClose={onClose} />
    {animation?.trigger === "scroll" && <div className="timeline-scroll">
      <span className="timeline-time">スクロール</span>
      <input type="range" min="0" max="1" step="0.01" value={scrollProgress}
        onChange={(event) => onScrollProgress(Number(event.currentTarget.value))} />
    </div>}
    {!node && <p className="timeline-empty">要素を選ぶとアニメーションを追加できます。</p>}
    {node && animation && <TimelineTracks animation={animation} node={node} playhead={playback.playhead} selected={selectedKeyframe}
      onSelect={setSelectedKeyframe} onSeek={playback.seek}
      onAddTrack={(property, keyframe) => { onAddKeyframe(animation.id, property, keyframe); setSelectedKeyframe({ property, time: keyframe.time }); }} />}
    {animation && <KeyframeSettings keyframe={keyframe} canAdd={animation.tracks.length > 0}
      onTime={(time) => { if (!selectedKeyframe || !keyframe) return; onSetKeyframe(animation.id, selectedKeyframe.property, keyframe.time, { time }); setSelectedKeyframe({ ...selectedKeyframe, time }); }}
      onValue={(value) => { if (selectedKeyframe && keyframe) onSetKeyframe(animation.id, selectedKeyframe.property, keyframe.time, { value }); }}
      onEasing={(easing) => { if (selectedKeyframe && keyframe) onSetKeyframe(animation.id, selectedKeyframe.property, keyframe.time, { easing }); }}
      onAdd={() => {
        // 選んだキーフレームのトラック、選んでいなければ最初のトラックの、再生位置に足す。
        const property = selectedKeyframe?.property ?? animation.tracks[0]?.property;
        if (!property) return;
        const value = evaluateAnimation(animation, playback.playhead)[property] ?? 0;
        const time = Math.round(localTime(animation, playback.playhead));
        onAddKeyframe(animation.id, property, { time, value, easing: "linear" });
        setSelectedKeyframe({ property, time });
      }}
      onRemove={() => { if (selectedKeyframe && keyframe) { onRemoveKeyframe(animation.id, selectedKeyframe.property, keyframe.time); setSelectedKeyframe(null); } }} />}
  </div>;
}
