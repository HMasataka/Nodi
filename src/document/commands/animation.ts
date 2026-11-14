import { Result } from "@praha/byethrow";

import { validateName } from "@/document/commands/validation.ts";
import { ANIMATABLE_PROPERTIES, type AnimatableProperty, type Animation, ANIMATION_TRIGGERS, type AnimationTrigger, type Document, type Easing, EASINGS, type Keyframe } from "@/document/types.ts";
import { findNode, updateNode } from "@/document/commands/tree.ts";

function animationIn(node: { animations: Animation[] }, animationId: string): Animation | undefined {
  return node.animations.find((animation) => animation.id === animationId);
}

function keyframeIssue(time: number, value: number, easing: Easing): string | undefined {
  if (!Number.isFinite(time) || time < 0) return "キーフレームの時刻は 0 以上の有限値で指定してください";
  if (!Number.isFinite(value)) return "キーフレームの値は有限値で指定してください";
  if (!EASINGS.includes(easing)) return "緩急が不正です";
}

export type AnimationTimingPatch = Partial<Pick<Animation, "name" | "trigger" | "duration" | "delay" | "repeat">>;

export function addAnimation(document: Document, nodeId: string, input: { name: string; trigger: AnimationTrigger }): Result.Result<{ document: Document; animation: Animation }, Error> {
  const node = findNode(document, nodeId);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${nodeId}`));
  if (!ANIMATION_TRIGGERS.includes(input.trigger)) return Result.fail(new Error("トリガーが不正です"));
  const nameResult = validateName(input.name);
  if (Result.isFailure(nameResult)) return nameResult;
  const existing = new Set(node.animations.map((animation) => animation.id));
  let id = `an_${crypto.randomUUID()}`;
  while (existing.has(id)) id = `an_${crypto.randomUUID()}`;
  const animation: Animation = {
    id, name: input.name, trigger: input.trigger, duration: 1000, delay: 0, repeat: 1,
    tracks: [{ property: "opacity", keyframes: [
      { time: 0, value: node.opacity, easing: "linear" }, { time: 1000, value: node.opacity, easing: "linear" },
    ] }],
  };
  const updated = updateNode(document, nodeId, (current) => ({ ...current, animations: [...current.animations, animation] }));
  if (Result.isFailure(updated)) return updated;
  return Result.succeed({ document: updated.value, animation });
}

export function removeAnimation(document: Document, nodeId: string, animationId: string): Result.Result<Document, Error> {
  const node = findNode(document, nodeId);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${nodeId}`));
  if (!animationIn(node, animationId)) return Result.fail(new Error(`アニメーションが見つかりません: ${animationId}`));
  return updateNode(document, nodeId, (current) => animationIn(current, animationId)
    ? { ...current, animations: current.animations.filter((animation) => animation.id !== animationId) } : current);
}

export function setAnimationTiming(document: Document, nodeId: string, animationId: string, patch: AnimationTimingPatch): Result.Result<Document, Error> {
  const node = findNode(document, nodeId);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${nodeId}`));
  if (!animationIn(node, animationId)) return Result.fail(new Error(`アニメーションが見つかりません: ${animationId}`));
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !["name", "trigger", "duration", "delay", "repeat"].includes(key))) return Result.fail(new Error("変更する項目を指定してください"));
  if (patch.name !== undefined && Result.isFailure(validateName(patch.name))) return Result.fail(new Error("名前は空にできません"));
  if (patch.trigger !== undefined && !ANIMATION_TRIGGERS.includes(patch.trigger)) return Result.fail(new Error("トリガーが不正です"));
  if (patch.duration !== undefined && (typeof patch.duration !== "number" || !Number.isFinite(patch.duration) || patch.duration <= 0)) return Result.fail(new Error("長さは正の有限値で指定してください"));
  if (patch.delay !== undefined && (typeof patch.delay !== "number" || !Number.isFinite(patch.delay) || patch.delay < 0)) return Result.fail(new Error("遅延は 0 以上の有限値で指定してください"));
  if (patch.repeat !== undefined && (!Number.isInteger(patch.repeat) || patch.repeat < 1)) return Result.fail(new Error("繰り返しは 1 以上の整数で指定してください"));
  return updateNode(document, nodeId, (current) => {
    const existing = animationIn(current, animationId);
    if (!existing) return current;
    const next = { ...existing, ...patch };
    return { ...current, animations: current.animations.map((animation) => animation.id === animationId ? next : animation) };
  });
}

export function addKeyframe(document: Document, nodeId: string, animationId: string, property: AnimatableProperty, keyframe: Keyframe): Result.Result<Document, Error> {
  const node = findNode(document, nodeId);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${nodeId}`));
  if (!animationIn(node, animationId)) return Result.fail(new Error(`アニメーションが見つかりません: ${animationId}`));
  if (!ANIMATABLE_PROPERTIES.includes(property)) return Result.fail(new Error("属性が不正です"));
  const issue = keyframeIssue(keyframe.time, keyframe.value, keyframe.easing);
  if (issue) return Result.fail(new Error(issue));
  return updateNode(document, nodeId, (current) => {
    const animation = animationIn(current, animationId);
    if (!animation) return current;
    const track = animation.tracks.find((item) => item.property === property);
    const keyframes = [...(track?.keyframes ?? []), keyframe].sort((a, b) => a.time - b.time);
    const tracks = track ? animation.tracks.map((item) => item.property === property ? { ...item, keyframes } : item)
      : [...animation.tracks, { property, keyframes }];
    return { ...current, animations: current.animations.map((item) => item.id === animationId ? { ...item, tracks } : item) };
  });
}

export type KeyframePatch = Partial<Pick<Keyframe, "time" | "value" | "easing">>;

export function setKeyframe(document: Document, nodeId: string, animationId: string, property: AnimatableProperty, time: number, patch: KeyframePatch): Result.Result<Document, Error> {
  const node = findNode(document, nodeId);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${nodeId}`));
  if (!animationIn(node, animationId)) return Result.fail(new Error(`アニメーションが見つかりません: ${animationId}`));
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !["time", "value", "easing"].includes(key))) return Result.fail(new Error("変更する項目を指定してください"));
  if (patch.time !== undefined && (typeof patch.time !== "number" || !Number.isFinite(patch.time) || patch.time < 0)) return Result.fail(new Error("キーフレームの時刻は 0 以上の有限値で指定してください"));
  if (patch.value !== undefined && (typeof patch.value !== "number" || !Number.isFinite(patch.value))) return Result.fail(new Error("キーフレームの値は有限値で指定してください"));
  if (patch.easing !== undefined && !EASINGS.includes(patch.easing)) return Result.fail(new Error("緩急が不正です"));
  return updateNode(document, nodeId, (current) => {
    const animation = animationIn(current, animationId);
    const track = animation?.tracks.find((item) => item.property === property);
    const keyframe = track?.keyframes.find((item) => item.time === time);
    if (!animation || !track || !keyframe) return current;
    const next = { ...keyframe, ...patch };
    const keyframes = track.keyframes.map((item) => item.time === time ? next : item)
      .sort((a, b) => a.time - b.time);
    return { ...current, animations: current.animations.map((item) => item.id === animationId
      ? { ...item, tracks: item.tracks.map((trackItem) => trackItem.property === property ? { ...trackItem, keyframes } : trackItem) } : item) };
  });
}

export function removeKeyframe(document: Document, nodeId: string, animationId: string, property: AnimatableProperty, time: number): Result.Result<Document, Error> {
  const node = findNode(document, nodeId);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${nodeId}`));
  if (!animationIn(node, animationId)) return Result.fail(new Error(`アニメーションが見つかりません: ${animationId}`));
  return updateNode(document, nodeId, (current) => {
    const animation = animationIn(current, animationId);
    if (!animation) return current;
    const tracks = animation.tracks.map((track) => track.property === property
      ? { ...track, keyframes: track.keyframes.filter((keyframe) => keyframe.time !== time) } : track)
      .filter((track) => track.keyframes.length > 0);
    const animations = tracks.length > 0
      ? current.animations.map((item) => item.id === animationId ? { ...item, tracks } : item)
      : current.animations.filter((item) => item.id !== animationId);
    return { ...current, animations };
  });
}
