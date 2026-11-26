import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { KeyframeSettings } from "../src/pages/editor/components/molecules/KeyframeSettings/KeyframeSettings.tsx";

const noOp = () => {};
const handlers = { onTime: noOp, onValue: noOp, onEasing: noOp, onAdd: noOp, onRemove: noOp };

test("選んだキーフレームの時刻・値・イージングと、追加・削除を1行に並べる", () => {
  const markup = renderToStaticMarkup(<KeyframeSettings {...handlers} canAdd keyframe={{ time: 400, value: 1, easing: "ease-out" }} />);
  assert.match(markup, />時刻<\/label><input[^>]*value="400"/);
  assert.match(markup, />値<\/label><input[^>]*value="1"/);
  assert.deepEqual([...markup.matchAll(/role="radio"[^>]*>([^<]+)</g)].map(([, label]) => label), ["linear", "ease-in", "ease-out", "ease-in-out"]);
  assert.match(markup, /aria-checked="true"[^>]*>ease-out</);
  assert.match(markup, /<button type="button" class="icon-button" aria-label="再生位置にキーフレームを追加"/);
  assert.match(markup, /<button type="button" class="icon-button" aria-label="キーフレームを削除"/);
});

test("キーフレームを選んでいないときは案内を出し、削除は押せない", () => {
  const markup = renderToStaticMarkup(<KeyframeSettings {...handlers} canAdd={false} keyframe={null} />);
  assert.match(markup, /トラックのキーフレームを選ぶと編集できます/);
  assert.match(markup, /<button disabled=""[^>]*aria-label="キーフレームを削除"/);
  assert.match(markup, /<button disabled=""[^>]*aria-label="再生位置にキーフレームを追加"/);
});
