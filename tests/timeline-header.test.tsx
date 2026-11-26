import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { activeAnimation } from "../src/pages/editor/components/organisms/Timeline/Timeline.tsx";
import type { Animation } from "../src/document/types.ts";
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
