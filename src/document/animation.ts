import type { AnimatableProperty, Animation, Easing, Keyframe } from "@/document/types.ts";

/** アニメーションが時刻 `t` に与える属性値。対象外の属性は含まれない。 */
export type AnimatedValues = Partial<Record<AnimatableProperty, number>>;

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
