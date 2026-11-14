import assert from "node:assert/strict";
import { test } from "vitest";

import type { Animation } from "../src/document/types.ts";
import { evaluateAnimation } from "../src/document/animation.ts";

function animation(overrides: Partial<Animation> = {}): Animation {
  return {
    id: "a", name: "a", trigger: "load", duration: 1000, delay: 0, repeat: 1,
    tracks: [{ property: "opacity", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 1, easing: "linear" }] }],
    ...overrides,
  };
}

test("線形補間は時刻に比例した値を返す", () => {
  const a = animation();
  assert.equal(evaluateAnimation(a, 0).opacity, 0);
  assert.equal(evaluateAnimation(a, 500).opacity, 0.5);
  assert.equal(evaluateAnimation(a, 1000).opacity, 1);
});

test("キーフレームの範囲外は最初・最後の値でクランプする", () => {
  const a = animation({ tracks: [{ property: "x", keyframes: [
    { time: 200, value: 10, easing: "linear" }, { time: 800, value: 90, easing: "linear" },
  ] }] });
  assert.equal(evaluateAnimation(a, 100).x, 10);
  assert.equal(evaluateAnimation(a, 900).x, 90);
  assert.equal(evaluateAnimation(a, 500).x, 50);
});

test("easing は進捗を変形する", () => {
  const easeIn = animation({ tracks: [{ property: "opacity", keyframes: [
    { time: 0, value: 0, easing: "ease-in" }, { time: 1000, value: 100, easing: "linear" },
  ] }] });
  assert.equal(evaluateAnimation(easeIn, 500).opacity, 25);
  const easeOut = animation({ tracks: [{ property: "opacity", keyframes: [
    { time: 0, value: 0, easing: "ease-out" }, { time: 1000, value: 100, easing: "linear" },
  ] }] });
  assert.equal(evaluateAnimation(easeOut, 500).opacity, 75);
  const easeInOut = animation({ tracks: [{ property: "opacity", keyframes: [
    { time: 0, value: 0, easing: "ease-in-out" }, { time: 1000, value: 100, easing: "linear" },
  ] }] });
  assert.equal(evaluateAnimation(easeInOut, 500).opacity, 50);
});

test("遅延前は空を返し、遅延後は再生する", () => {
  const a = animation({ delay: 500 });
  assert.deepEqual(evaluateAnimation(a, 0), {});
  assert.deepEqual(evaluateAnimation(a, 499), {});
  assert.equal(evaluateAnimation(a, 500).opacity, 0);
  assert.equal(evaluateAnimation(a, 1000).opacity, 0.5);
});

test("repeat は同じ周期を繰り返し、完了後は最終値を保持する", () => {
  const a = animation({ repeat: 3 });
  assert.equal(evaluateAnimation(a, 500).opacity, 0.5);
  assert.equal(evaluateAnimation(a, 1500).opacity, 0.5);
  assert.equal(evaluateAnimation(a, 3000).opacity, 1);
  assert.equal(evaluateAnimation(a, 4000).opacity, 1);
});

test("複数トラックを同時に評価する", () => {
  const a = animation({ tracks: [
    { property: "opacity", keyframes: [{ time: 0, value: 1, easing: "linear" }, { time: 1000, value: 0, easing: "linear" }] },
    { property: "x", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 200, easing: "linear" }] },
  ] });
  assert.deepEqual(evaluateAnimation(a, 500), { opacity: 0.5, x: 100 });
});
