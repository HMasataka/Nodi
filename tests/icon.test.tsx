import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LayerIcon } from "../src/pages/editor/components/atoms/LayerIcon/LayerIcon.tsx";
import { Icon, ICON_NAMES, iconPathData } from "../src/pages/editor/components/atoms/Icon/Icon.tsx";

test("デザインの iconPaths と同じ名前のアイコンを持つ", async () => {
  const source = await readFile(new URL("../designs/build.mjs", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("const iconPaths = {"), source.indexOf("\n};", source.indexOf("const iconPaths = {")));
  const names = [...block.matchAll(/^ {2}(\w+):/gm)].map(([, name]) => name);
  assert.deepEqual([...ICON_NAMES].sort(), names.sort());
  for (const name of ["select", "frame", "rectangle", "ellipse", "pen", "text", "image", "panelLeft", "panelRight", "preview",
    "timeline", "play", "trash", "more", "plus", "minus", "chevronDown"]) assert.ok(ICON_NAMES.includes(name as never), name);
});

test("16px・線幅1.5pxの線で、割合の点列を16px角に描く", () => {
  const markup = renderToStaticMarkup(createElement(Icon, { name: "rectangle" }));
  assert.match(markup, /^<svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.equal(iconPathData("rectangle"), "M2.4 3.2 L13.6 3.2 L13.6 12.8 L2.4 12.8 Z");
  assert.equal(iconPathData("plus"), "M8 3.2 L8 12.8 M3.2 8 L12.8 8");
  for (const name of ICON_NAMES) assert.match(iconPathData(name), /^M[\d.]+ [\d.]+( (M|L)[\d.]+ [\d.]+| Z)*$/, name);
});

test("レイヤーの種類ごとにアイコンを描き分ける", () => {
  const draw = (type: Parameters<typeof LayerIcon>[0]["type"]) => renderToStaticMarkup(createElement(LayerIcon, { type }));
  assert.match(draw("frame"), /class="icon layer-icon"/);
  assert.match(draw("path"), new RegExp(`d="${iconPathData("pen")}"`));
  assert.match(draw("instance"), new RegExp(`d="${iconPathData("component")}"`));
  assert.match(draw("ellipse"), new RegExp(`d="${iconPathData("ellipse").replaceAll(".", "\\.")}"`));
});
