import assert from "node:assert/strict";
import { test } from "vitest";

import type { Animation } from "../src/document/types.ts";
import { activeAnimationTriggers, applyAnimations, applyScrollAnimations, evaluateAnimation, evaluateScrollAnimation } from "../src/document/animation.ts";
import { document, frame, rectangle } from "./support/factories.ts";

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

test("applyAnimations は位置・回転・不透明度を適用し、scale は反映しない", () => {
  const a = animation({ tracks: [
    { property: "x", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 100, easing: "linear" }] },
    { property: "opacity", keyframes: [{ time: 0, value: 1, easing: "linear" }, { time: 1000, value: 0, easing: "linear" }] },
    { property: "rotation", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 90, easing: "linear" }] },
    { property: "scale", keyframes: [{ time: 0, value: 1, easing: "linear" }, { time: 1000, value: 2, easing: "linear" }] },
  ] });
  const doc = document(frame({ id: "f", children: [rectangle({ id: "r", width: 50, height: 50, animations: [a] })] }));
  const applied = applyAnimations(doc, 500);
  const node = applied.children[0].children[0];
  assert.equal(node.x, 50);
  assert.equal(node.opacity, 0.5);
  assert.equal(node.rotation, 45);
  assert.equal(node.width, 50);
  assert.deepEqual(applyAnimations(doc, 0).children[0].children[0].x, 0);
});

test("操作状態に応じて再生するトリガーを絞り込む", () => {
  const load = animation({ trigger: "load", tracks: [{ property: "x", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 100, easing: "linear" }] }] });
  const hover = animation({ trigger: "hover", tracks: [{ property: "opacity", keyframes: [{ time: 0, value: 1, easing: "linear" }, { time: 1000, value: 0, easing: "linear" }] }] });
  const click = animation({ trigger: "click", tracks: [{ property: "rotation", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 90, easing: "linear" }] }] });
  const doc = document(rectangle({ id: "r", x: 10, animations: [load, hover, click] }));

  const none = applyAnimations(doc, 500, (n) => activeAnimationTriggers(n, { hoveredIds: new Set(), clickedIds: new Set() }));
  assert.equal(none.children[0].x, 50);
  assert.equal(none.children[0].opacity, 1);
  assert.equal(none.children[0].rotation, 0);

  const hovered = applyAnimations(doc, 500, (n) => activeAnimationTriggers(n, { hoveredIds: new Set(["r"]), clickedIds: new Set() }));
  assert.equal(hovered.children[0].opacity, 0.5);

  const clicked = applyAnimations(doc, 500, (n) => activeAnimationTriggers(n, { hoveredIds: new Set(), clickedIds: new Set(["r"]) }));
  assert.equal(clicked.children[0].rotation, 45);
});

test("スクロール進行度を時間軸に対応付けて評価する", () => {
  const a = animation({ trigger: "scroll" });
  assert.equal(evaluateScrollAnimation(a, 0).opacity, 0);
  assert.equal(evaluateScrollAnimation(a, 0.5).opacity, 0.5);
  assert.equal(evaluateScrollAnimation(a, 1).opacity, 1);
  assert.equal(evaluateScrollAnimation(a, 1.5).opacity, 1);
});

test("スクロール連動だけを進行度で適用する", () => {
  const scroll = animation({ trigger: "scroll", tracks: [{ property: "y", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 200, easing: "linear" }] }] });
  const load = animation({ trigger: "load", tracks: [{ property: "x", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 1000, value: 100, easing: "linear" }] }] });
  const doc = document(rectangle({ id: "r", animations: [scroll, load] }));
  const applied = applyScrollAnimations(doc, 0.5);
  assert.equal(applied.children[0].y, 100);
  assert.equal(applied.children[0].x, 0);
});
