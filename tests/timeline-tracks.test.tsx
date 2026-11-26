import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import type { Animation } from "../src/document/types.ts";
import { rectangle } from "./support/factories.ts";

import { baseValue, localTime, rulerTicks, scrollProgressAt, scrollTime, TimelineTracks } from "../src/pages/editor/components/molecules/TimelineTracks/TimelineTracks.tsx";

const animation: Animation = { id: "a", name: "Fade in", trigger: "load", duration: 800, delay: 100, repeat: 2, tracks: [
  { property: "opacity", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 400, value: 1, easing: "ease-out" }] },
  { property: "y", keyframes: [{ time: 0, value: 10, easing: "linear" }, { time: 800, value: 0, easing: "linear" }] },
] };
const noOp = () => {};

test("目盛りは長さの4等分、再生位置は遅延と繰り返しを除いた1回分の時刻に直す", () => {
  assert.deepEqual(rulerTicks(800).map(({ label }) => label), ["0", "200", "400", "600", "800 ms"]);
  assert.equal(localTime(animation, 50), 0);
  assert.equal(localTime(animation, 420), 320);
  assert.equal(localTime(animation, 1000), 100);
  assert.equal(localTime(animation, 5000), 800);
  const node = rectangle({ x: 12, opacity: 0.5 });
  assert.equal(baseValue(node, "x"), 12);
  assert.equal(baseValue(node, "opacity"), 0.5);
  assert.equal(baseValue(node, "scale"), 1);
});

test("プロパティごとのトラックに菱形のキーフレームを置き、選んだものを強調し、再生位置の線を描く", () => {
  const markup = renderToStaticMarkup(<TimelineTracks animation={animation} node={rectangle()} current={320} selected={{ property: "opacity", time: 400 }}
    onSelect={noOp} onSeek={noOp} onAddTrack={noOp} />);
  assert.deepEqual([...markup.matchAll(/class="timeline-track-label">([^<]+)</g)].map(([, label]) => label), ["不透明度", "Y 位置"]);
  assert.equal(markup.match(/class="timeline-keyframe[" ]/g)?.length, 4);
  assert.match(markup, /class="timeline-keyframe is-selected" aria-label="不透明度 400 ms のキーフレーム" aria-pressed="true" style="left:50.000%"/);
  assert.match(markup, /role="slider" aria-label="再生位置"[^>]*aria-valuenow="320"[^>]*style="left:40.000%"/);
  assert.match(markup, /class="timeline-add-track"/);
  const full = { ...animation, tracks: (["x", "y", "scale", "rotation", "opacity"] as const).map((property) => ({ property, keyframes: [] })) };
  assert.doesNotMatch(renderToStaticMarkup(<TimelineTracks animation={full} node={rectangle()} current={0} selected={null} onSelect={noOp} onSeek={noOp} onAddTrack={noOp} />),
    /timeline-add-track/);
});

test("スクロールの進み具合は遅延のあと全体の長さを動き、線の位置から進み具合に戻せる", () => {
  assert.equal(scrollTime(animation, 0), 100);
  assert.equal(scrollTime(animation, 0.5), 900);
  assert.equal(scrollTime(animation, 2), 1700);
  assert.equal(localTime(animation, scrollTime(animation, 0.25)), 400);
  assert.equal(scrollProgressAt(animation, 400), 0.25);
  assert.equal(scrollProgressAt(animation, -5), 0);
});
