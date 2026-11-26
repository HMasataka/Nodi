import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";

import type { Animation } from "../src/document/types.ts";
import { rectangle } from "./support/factories.ts";

test("タイムラインが再生・シークとキーフレーム編集欄を表示する", async () => {
  const vite = await createServer({ server: { middlewareMode: true } });
  try {
    const { Timeline } = await vite.ssrLoadModule("/src/pages/editor/components/organisms/Timeline/Timeline.tsx");
    const noOp = () => {};
    const animation: Animation = {
      id: "a1", name: "フェード", trigger: "load", duration: 1000, delay: 0, repeat: 1,
      tracks: [{ property: "opacity", keyframes: [
        { time: 0, value: 1, easing: "linear" }, { time: 1000, value: 0, easing: "ease-out" },
      ] }],
    };
    const node = rectangle({ animations: [animation] });
    const markup = renderToStaticMarkup(createElement(Timeline, {
      node, playback: { playhead: 500, playing: false, play: noOp, pause: noOp, stop: noOp, seek: noOp },
      scrollProgress: 0, onScrollProgress: noOp, activeAnimationId: null, onSelectAnimation: noOp, onClose: noOp,
      onAddAnimation: noOp, onRemoveAnimation: noOp, onSetTiming: noOp,
      onAddKeyframe: noOp, onSetKeyframe: noOp, onRemoveKeyframe: noOp,
    }));
    assert.match(markup, /500 \/ 1000 ms/);
    assert.match(markup, /aria-label="再生"/);
    assert.match(markup, /aria-checked="true"[^>]*>フェード</);
    assert.match(markup, /class="timeline-track-label">不透明度</);
    assert.equal(markup.match(/class="timeline-keyframe[" ]/g)?.length, 2);
    assert.match(markup, /value="load" selected=""/);
    assert.match(markup, /aria-label="アニメーションを追加"/);
  } finally {
    await vite.close();
  }
});
