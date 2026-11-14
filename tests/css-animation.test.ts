import assert from "node:assert/strict";
import { test } from "vitest";

import type { Animation } from "../src/document/types.ts";
import { exportCssAnimations } from "../src/export/cssAnimation.ts";
import { document, frame, rectangle } from "./support/factories.ts";

test("読み込み時アニメーションを CSS の @keyframes と animation として書き出す", () => {
  const animation: Animation = {
    id: "a1", name: "移動", trigger: "load", duration: 1000, delay: 200, repeat: 2,
    tracks: [
      { property: "opacity", keyframes: [{ time: 0, value: 1, easing: "ease-in" }, { time: 1000, value: 0, easing: "linear" }] },
      { property: "x", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 500, value: 100, easing: "linear" }, { time: 1000, value: 200, easing: "linear" }] },
    ],
  };
  const css = exportCssAnimations(document(frame({ id: "page", children: [rectangle({ id: "r", animations: [animation] })] })));
  assert.match(css, /@keyframes nodi-a1/);
  assert.match(css, /\.nodi-r \{/);
  assert.match(css, /animation: nodi-a1 1000ms ease-in 200ms 2 normal/);
  assert.match(css, /0% \{ translate: 0px 0px; opacity: 1 \}/);
  assert.match(css, /50% \{ translate: 100px 0px; opacity: 0\.75 \}/);
  assert.match(css, /100% \{ translate: 200px 0px; opacity: 0 \}/);
});

test("読み込み時以外のトリガーは CSS に書き出さない", () => {
  const animation: Animation = {
    id: "h1", name: "ホバー", trigger: "hover", duration: 1000, delay: 0, repeat: 1,
    tracks: [{ property: "opacity", keyframes: [{ time: 0, value: 1, easing: "linear" }, { time: 1000, value: 0, easing: "linear" }] }],
  };
  assert.equal(exportCssAnimations(document(rectangle({ animations: [animation] }))), "");
});
