import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { DEFAULT_BLUR, DEFAULT_SHADOW, EffectsEditor, nextEffect } from "../src/pages/editor/components/molecules/EffectsEditor/EffectsEditor.tsx";

const shadow = { color: "#00000080", offsetX: 2, offsetY: 4, blur: 8 };
const noOp = () => {};

test("見出しの＋は、影・全体ぼかしの順にまだ持っていない効果を足し、両方あれば押せない", () => {
  assert.deepEqual(nextEffect({ shadow: null, blur: 0 }), { shadow: DEFAULT_SHADOW });
  assert.deepEqual(nextEffect({ shadow, blur: 0 }), { blur: DEFAULT_BLUR });
  assert.deepEqual(nextEffect({ shadow: null, blur: 3 }), { shadow: DEFAULT_SHADOW });
  assert.equal(nextEffect({ shadow, blur: 3 }), null);
});

test("持っている効果だけを、外す操作つきで並べる", () => {
  assert.equal(renderToStaticMarkup(<EffectsEditor shadow={null} blur={0} onShadow={noOp} onBlur={noOp} />), "");
  const both = renderToStaticMarkup(<EffectsEditor shadow={shadow} blur={6} onShadow={noOp} onBlur={noOp} />);
  assert.match(both, /aria-label="影を外す"/);
  assert.match(both, /aria-label="全体ぼかしを外す"/);
  assert.deepEqual([...both.matchAll(/>(X|Y|ぼかし)<\/label><input[^>]*value="([^"]+)"/g)].map(([, label, value]) => `${label}=${value}`),
    ["X=2", "Y=4", "ぼかし=8", "ぼかし=6"]);
  const blurOnly = renderToStaticMarkup(<EffectsEditor shadow={null} blur={6} onShadow={noOp} onBlur={noOp} />);
  assert.doesNotMatch(blurOnly, /影を外す/);
});
