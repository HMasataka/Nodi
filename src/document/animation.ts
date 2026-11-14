import type { AnimatableProperty, Animation, AnimationTrigger, Document, DocumentNode, Easing, Keyframe } from "@/document/types.ts";

/** アニメーションが時刻 `t` に与える属性値。対象外の属性は含まれない。 */
export type AnimatedValues = Partial<Record<AnimatableProperty, number>>;

/** 要素の操作状態。ホバー中・クリック済みの要素 ID を保持する。 */
export interface InteractionState {
  hoveredIds: ReadonlySet<string>;
  clickedIds: ReadonlySet<string>;
}

/** 要素が操作状態に応じて再生すべきトリガー。`load` は常に含む。 */
export function activeAnimationTriggers(node: DocumentNode, state: InteractionState): ReadonlySet<AnimationTrigger> {
  const triggers = new Set<AnimationTrigger>(["load"]);
  if (state.hoveredIds.has(node.id)) triggers.add("hover");
  if (state.clickedIds.has(node.id)) triggers.add("click");
  return triggers;
}

export type TriggerResolver = (node: DocumentNode) => ReadonlySet<AnimationTrigger>;

function ease(easing: Easing, progress: number): number {
  switch (easing) {
    case "ease-in": return progress * progress;
    case "ease-out": return 1 - (1 - progress) * (1 - progress);
    case "ease-in-out": return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    default: return progress;
  }
}

function interpolateTrack(keyframes: Keyframe[], localTime: number): number {
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (localTime <= first.time) return first.value;
  if (localTime >= last.time) return last.value;
  for (let index = 0; index < keyframes.length - 1; index++) {
    const from = keyframes[index];
    const to = keyframes[index + 1];
    if (localTime >= from.time && localTime <= to.time) {
      const span = to.time - from.time;
      const progress = span === 0 ? 1 : (localTime - from.time) / span;
      return from.value + (to.value - from.value) * ease(from.easing, progress);
    }
  }
  return last.value;
}

function lastValue(keyframes: Keyframe[]): number {
  return keyframes[keyframes.length - 1].value;
}

/** 遅延・繰り返しを無視して、1周期内のローカル時刻でキーフレームを評価する。 */
export function evaluateAnimationLocal(animation: Animation, localTime: number): AnimatedValues {
  const result: AnimatedValues = {};
  for (const track of animation.tracks) result[track.property] = interpolateTrack(track.keyframes, localTime);
  return result;
}

/**
 * キーフレーム・時間・遅延・緩急・繰り返しから、任意の時刻 `timeMs` における各属性の値を返す。
 * 遅延前は空オブジェクト（元の属性値を使う）、繰り返し完了後は最終キーフレームの値を保持する。
 */
export function evaluateAnimation(animation: Animation, timeMs: number): AnimatedValues {
  const local = timeMs - animation.delay;
  if (local < 0) return {};
  const period = animation.duration;
  const total = period * animation.repeat;
  const result: AnimatedValues = {};
  if (local >= total) {
    for (const track of animation.tracks) result[track.property] = lastValue(track.keyframes);
    return result;
  }
  const iterationTime = local % period;
  for (const track of animation.tracks) result[track.property] = interpolateTrack(track.keyframes, iterationTime);
  return result;
}

/**
 * スクロール量（進行度 0〜1）をアニメーションの時間軸に対応付けて評価する。
 * 進行度 0 は開始、1 は繰り返し完了時点に相当する。
 */
export function evaluateScrollAnimation(animation: Animation, progress: number): AnimatedValues {
  const clamped = Math.max(0, Math.min(1, progress));
  return evaluateAnimation(animation, animation.delay + clamped * animation.duration * animation.repeat);
}

/**
 * 文書の各要素に時刻 `timeMs` のアニメーション値を適用した文書を返す。入力は変更しない。
 * 位置・回転・不透明度を上書きする。`scale` は要素の属性として未対応のため反映しない。
 * `resolveTriggers` を渡すと、その要素で再生するトリガーだけに絞り込む（既定は全トリガー）。
 */
export function applyAnimations(document: Document, timeMs: number, resolveTriggers?: TriggerResolver): Document {
  function applyNode(node: DocumentNode): DocumentNode {
    const triggers = resolveTriggers?.(node);
    const values: AnimatedValues = {};
    for (const animation of node.animations) {
      if (triggers && !triggers.has(animation.trigger)) continue;
      Object.assign(values, evaluateAnimation(animation, timeMs));
    }
    const overrides: { x?: number; y?: number; rotation?: number; opacity?: number } = {};
    if (values.x !== undefined) overrides.x = values.x;
    if (values.y !== undefined) overrides.y = values.y;
    if (values.rotation !== undefined) overrides.rotation = values.rotation;
    if (values.opacity !== undefined) overrides.opacity = values.opacity;
    return node.type === "frame"
      ? { ...node, ...overrides, children: node.children.map(applyNode) }
      : { ...node, ...overrides };
  }
  return { ...document, children: document.children.map(applyNode) };
}

/**
 * スクロール連動（trigger: scroll）のアニメーションだけを進行度 `progress` で適用した文書を返す。
 */
export function applyScrollAnimations(document: Document, progress: number): Document {
  function applyNode(node: DocumentNode): DocumentNode {
    const values: AnimatedValues = {};
    for (const animation of node.animations) {
      if (animation.trigger !== "scroll") continue;
      Object.assign(values, evaluateScrollAnimation(animation, progress));
    }
    const overrides: { x?: number; y?: number; rotation?: number; opacity?: number } = {};
    if (values.x !== undefined) overrides.x = values.x;
    if (values.y !== undefined) overrides.y = values.y;
    if (values.rotation !== undefined) overrides.rotation = values.rotation;
    if (values.opacity !== undefined) overrides.opacity = values.opacity;
    return node.type === "frame"
      ? { ...node, ...overrides, children: node.children.map(applyNode) }
      : { ...node, ...overrides };
  }
  return { ...document, children: document.children.map(applyNode) };
}
