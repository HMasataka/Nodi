import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";

import { drawnElementInput } from "../src/pages/editor/creation.ts";
import { FloatingTools, type FloatingToolsProps } from "../src/pages/editor/components/molecules/FloatingTools/FloatingTools.tsx";

const props: FloatingToolsProps = { drawTool: "select", onDrawToolChange: () => {}, onImportImage: async () => {}, timelineOpen: false, onToggleTimeline: () => {} };
const render = (overrides: Partial<FloatingToolsProps> = {}) => renderToStaticMarkup(createElement(FloatingTools, { ...props, ...overrides }));

test("選択・フレーム・矩形・楕円・ペン・テキスト・画像・タイムラインの順に並べる", () => {
  const labels = [...render().matchAll(/aria-label="([^"]+)" title=/g)].map(([, label]) => label);
  assert.deepEqual(labels, ["選択", "フレーム", "矩形", "楕円", "ペン", "テキスト", "画像", "タイムラインを開く"]);
  assert.match(render(), /<input class="image-file-input" type="file" accept="image\/png,image\/jpeg,image\/webp,image\/svg\+xml" tabindex="-1" aria-label="画像ファイル"/);
});

test("選んだツールとタイムラインの開閉を押された状態で示す", () => {
  const pressed = (markup: string) => [...markup.matchAll(/aria-label="([^"]+)" title="[^"]+" aria-pressed="true"/g)].map(([, label]) => label);
  assert.deepEqual(pressed(render()), ["選択"]);
  assert.deepEqual(pressed(render({ drawTool: "text", timelineOpen: true })), ["テキスト", "タイムラインを閉じる"]);
  assert.doesNotMatch(render(), /aria-label="画像" title="画像" aria-pressed/);
});

test("描いた枠から要素を作り、小さすぎる枠は作らないが、テキストはクリックした位置に既定の大きさで置く", () => {
  const box = { x: 10, y: 20, width: 100, height: 60 };
  assert.deepEqual(drawnElementInput("frame", box), { type: "frame", parentId: undefined, ...box });
  assert.deepEqual(drawnElementInput("ellipse", box, "parent"), { type: "ellipse", parentId: "parent", ...box });
  assert.deepEqual(drawnElementInput("text", box), { type: "text", content: "テキスト", parentId: undefined, ...box });
  const click = { x: 30, y: 40, width: 0, height: 0 };
  assert.equal(drawnElementInput("rectangle", click), null);
  assert.equal(drawnElementInput("frame", { ...click, width: 100, height: 3 }), null);
  assert.deepEqual(drawnElementInput("text", click), { type: "text", content: "テキスト", parentId: undefined, x: 30, y: 40, width: 220, height: 48 });
});

test("作成ツールはキャンバスの下中央から 12px に置く", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.floating-tools \{\n {2}top: auto;\n {2}bottom: var\(--space-12\);\n {2}left: 50%;\n {2}transform: translateX\(-50%\);/);
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const stage = page.slice(page.indexOf('<div className="canvas-stage">'), page.indexOf("<Timeline"));
  assert.ok(stage.includes("<FloatingTools"));
});
