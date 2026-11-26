import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import type { Animation } from "../src/document/types.ts";
import { rectangle } from "./support/factories.ts";

import { activeAnimation, Timeline } from "../src/pages/editor/components/organisms/Timeline/Timeline.tsx";
import { animationLength, TimelineHeader } from "../src/pages/editor/components/molecules/TimelineHeader/TimelineHeader.tsx";

const base: Animation = { id: "a", name: "Fade in", trigger: "load", duration: 800, delay: 100, repeat: 2, tracks: [] };
const hover: Animation = { ...base, id: "b", name: "Hover lift", trigger: "hover" };
const noOp = () => {};
const props = { canAdd: true, playhead: 320, playing: false, onSelect: noOp, onAdd: noOp, onRemove: noOp, onSetTiming: noOp, onPlay: noOp, onPause: noOp, onClose: noOp };

test("開いているアニメーションは指定の ID、なければ最初のものにする", () => {
  assert.equal(activeAnimation([base, hover], "b"), hover);
  assert.equal(activeAnimation([base, hover], "missing"), base);
  assert.equal(activeAnimation([], null), null);
  assert.equal(animationLength(base), 1700);
});

test("見出しにアニメーションの切り換え・追加・削除・トリガー・長さ・遅延・繰り返し・再生・閉じるを1行に並べる", () => {
  const markup = renderToStaticMarkup(<TimelineHeader {...props} animations={[base, hover]} active={hover} />);
  assert.deepEqual([...markup.matchAll(/role="radio"[^>]*aria-checked="(true|false)"[^>]*>([^<]+)</g)].map(([, checked, label]) => `${label}:${checked}`),
    ["Fade in:false", "Hover lift:true"]);
  for (const label of ["アニメーションを追加", "名前を変更", "アニメーションを削除", "再生", "タイムラインを閉じる"]) assert.ok(markup.includes(`aria-label="${label}"`), label);
  assert.match(markup, /value="hover" selected=""/);
  assert.deepEqual([...markup.matchAll(/>(長さ|遅延|繰り返し)<\/label><input[^>]*value="(\d+)"/g)].map(([, label, value]) => `${label}=${value}`),
    ["長さ=800", "遅延=100", "繰り返し=2"]);
  assert.match(markup, />320 \/ 1700 ms</);
  const playing = renderToStaticMarkup(<TimelineHeader {...props} playing animations={[base]} active={base} />);
  assert.match(playing, /aria-label="停止" title="停止" aria-pressed="true"/);
  const empty = renderToStaticMarkup(<TimelineHeader {...props} canAdd={false} animations={[]} active={null} />);
  assert.match(empty, /アニメーションはまだありません/);
  assert.match(empty, /<button disabled=""[^>]*aria-label="アニメーションを追加"/);
  assert.doesNotMatch(empty, /トリガー/);
});

test("スクロールのトリガーでは再生の代わりにスクロールの進み具合を割合で出す", () => {
  const scroll = { ...base, trigger: "scroll" as const };
  const markup = renderToStaticMarkup(<TimelineHeader {...props} animations={[scroll]} active={scroll} scrollProgress={0.4} />);
  assert.match(markup, /class="timeline-scroll-label">スクロール<\/span><span class="timeline-scroll-value">40%</);
  assert.doesNotMatch(markup, /aria-label="再生"/);
  assert.match(markup, /aria-label="タイムラインを閉じる"/);
});

test("スクロールのトリガーでは範囲入力を置かず、再生位置の線を進み具合の位置に置く", () => {
  const scroll: Animation = { ...base, trigger: "scroll", delay: 0, repeat: 1, tracks: [{ property: "opacity", keyframes: [{ time: 0, value: 0, easing: "linear" }] }] };
  const markup = renderToStaticMarkup(<Timeline node={rectangle({ animations: [scroll] })} playback={{ playhead: 0, playing: false, play: noOp, pause: noOp, stop: noOp, seek: noOp }}
    scrollProgress={0.4} onScrollProgress={noOp} activeAnimationId={null} onSelectAnimation={noOp} onClose={noOp} onAddAnimation={() => null}
    onRemoveAnimation={noOp} onSetTiming={noOp} onAddKeyframe={noOp} onSetKeyframe={noOp} onRemoveKeyframe={noOp} />);
  assert.doesNotMatch(markup, /type="range"/);
  assert.match(markup, /role="slider" aria-label="再生位置"[^>]*aria-valuenow="320"[^>]*style="left:40.000%"/);
  assert.match(markup, />40%</);
});
