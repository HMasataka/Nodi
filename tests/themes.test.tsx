import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { ColorResolverContext } from "../src/pages/editor/colorContext.ts";
import { createAgentApi } from "../src/agent/api.ts";
import { createHistory } from "../src/document/history.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import type { Document } from "../src/document/types.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { createColorResolver, resolveColor } from "../src/document/colorRef.ts";
import { document, failure, frame, paletteColor, rectangle, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { renameTheme, setFrameTheme, setPaletteThemeColor, setThemes } from "../src/document/commands/index.ts";

const ref = { type: "palette" as const, id: "pc_bg" };
const interaction = { onNodePointerDown() {}, onResizePointerDown() {}, onNodePointerMove() {}, onNodePointerUp() {}, onImageError() {} };

function themed(): Document {
  return {
    ...document(
      frame({ id: "light-screen", style: { fill: null }, children: [rectangle({ id: "light-card", style: { fill: ref, stroke: null } })] }),
      frame({ id: "dark-screen", theme: "dark", style: { fill: ref }, children: [
        rectangle({ id: "dark-card", style: { fill: ref, stroke: null } }),
        frame({ id: "inner", style: { fill: null }, children: [rectangle({ id: "inner-card", style: { fill: ref, stroke: null } })] }),
        frame({ id: "light-island", theme: "light", style: { fill: null }, children: [rectangle({ id: "island-card", style: { fill: ref, stroke: null } })] }),
      ] }),
    ),
    palette: [paletteColor({ id: "pc_bg", name: "背景", color: "#ffffff", themes: { dark: "#111111" } })],
    themes: ["light", "dark"],
  };
}

test("テーマの一覧・パレット色のテーマ別の値・フレームのテーマを保存し、なければ省略する", () => {
  const original = themed();
  const json = JSON.parse(success(serializeDocument(original)));
  assert.deepEqual(json.themes, ["light", "dark"]);
  assert.deepEqual(json.palette[0].themes, { dark: "#111111" });
  assert.equal(json.children[1].theme, "dark");
  assert.equal(Object.hasOwn(json.children[0], "theme"), false);
  assert.deepEqual(success(parseDocument(JSON.stringify(json))), original);
  const plain = JSON.parse(success(serializeDocument(document(frame()))));
  assert.equal(Object.hasOwn(plain, "themes"), false);
  assert.equal(Object.hasOwn(success(parseDocument(JSON.stringify(plain))), "themes"), false);
});

test("重複したテーマ、最初のテーマの値、宣言していないテーマは読み込みで拒否する", () => {
  const json = JSON.parse(success(serializeDocument(themed())));
  const broken = [
    { ...json, themes: ["light", "light"] },
    { ...json, palette: [{ ...json.palette[0], themes: { light: "#000000" } }] },
    { ...json, palette: [{ ...json.palette[0], themes: { sepia: "#000000" } }] },
    { ...json, children: [{ ...json.children[0], theme: "sepia" }, json.children[1]] },
  ];
  for (const value of broken) assert.equal(parseDocument(JSON.stringify(value)).type, "Failure");
});

test("色参照はテーマの値があればそれを、なければ最初のテーマの値を使う", () => {
  const { palette } = themed();
  assert.equal(resolveColor(ref, palette), "#ffffff");
  assert.equal(resolveColor(ref, palette, "dark"), "#111111");
  assert.equal(resolveColor(ref, palette, "light"), "#ffffff");
  assert.equal(resolveColor("#123456", palette, "dark"), "#123456");
  const resolver = createColorResolver(palette);
  assert.equal(resolver.withTheme(undefined), resolver);
  assert.equal(resolver.withTheme("dark")(ref), "#111111");
  assert.equal(resolver.withTheme("dark").withTheme("light")(ref), "#ffffff");
});

test("編集画面と PNG は、フレームのテーマを自身と子孫に効かせ、入れ子のフレームのテーマで上書きする", async () => {
  const design = themed();
  const markup = renderToStaticMarkup(<ColorResolverContext.Provider value={createColorResolver(design.palette)}>
    {design.children.map((node) => <CanvasNode key={node.id} node={node} selectedId={null} interaction={interaction} />)}
  </ColorResolverContext.Provider>);
  // 明るい画面のカード、暗い画面の背景・カード・入れ子のカード、明るい島のカードの順に並ぶ。
  assert.deepEqual([...markup.matchAll(/fill="(#ffffff|#111111)"/g)].map(([, color]) => color),
    ["#ffffff", "#111111", "#111111", "#111111", "#ffffff"]);

  const fills: string[] = [];
  const ctx = new Proxy({ measureText: () => ({ width: 0 }), letterSpacing: "0px" } as Record<string | symbol, unknown>, {
    get: (target, key) => key in target ? target[key] : key === "fill" ? () => fills.push(String(target.fillStyle)) : () => ({ addColorStop() {} }),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"], { type: "image/png" })) };
  const environment = { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) as HTMLImageElement };
  success(await renderFramePng(design.children[1] as never, environment, {}, design.palette));
  assert.deepEqual(fills.filter((color) => color === "#ffffff" || color === "#111111"), ["#111111", "#111111", "#111111", "#ffffff"]);
});

test("テーマの一覧を置き換えると外したテーマの値を消し、フレームが使うテーマは外せない", () => {
  const design = themed();
  assert.match(failure(setThemes(design, ["light"])).message, /dark/);
  const unused = success(setFrameTheme(design, "dark-screen", null));
  const reduced = success(setThemes(unused, ["light", "sepia"]));
  assert.deepEqual(reduced.themes, ["light", "sepia"]);
  assert.equal(Object.hasOwn(reduced.palette[0], "themes"), false);
  assert.equal(setThemes(unused, []).type, "Failure");
  const none = success(setThemes(success(setFrameTheme(unused, "light-island", null)), []));
  assert.equal(Object.hasOwn(none, "themes"), false);
  assert.equal(setThemes(design, ["light", "light", "dark"]).type, "Failure");
  assert.equal(setThemes(design, ["light", " ", "dark"]).type, "Failure");
});

test("テーマの名前を変えると、パレット色の値とフレームのテーマも付け替える", () => {
  const renamed = success(renameTheme(themed(), "dark", "night"));
  assert.deepEqual(renamed.themes, ["light", "night"]);
  assert.deepEqual(renamed.palette[0].themes, { night: "#111111" });
  const screen = renamed.children[1];
  assert.equal(screen.type === "frame" ? screen.theme : undefined, "night");
  assert.equal(renameTheme(themed(), "dark", "light").type, "Failure");
  assert.equal(renameTheme(themed(), "sepia", "x").type, "Failure");
});

test("パレット色のテーマ別の値は最初以外のテーマだけに設定し、null で外す", () => {
  const design = themed();
  const updated = success(setPaletteThemeColor(design, "pc_bg", "dark", "#222222"));
  assert.deepEqual(updated.palette[0].themes, { dark: "#222222" });
  assert.equal(Object.hasOwn(success(setPaletteThemeColor(design, "pc_bg", "dark", null)).palette[0], "themes"), false);
  assert.equal(setPaletteThemeColor(design, "pc_bg", "light", "#000000").type, "Failure");
  assert.equal(setPaletteThemeColor(design, "pc_bg", "sepia", "#000000").type, "Failure");
  assert.equal(setPaletteThemeColor(design, "pc_bg", "dark", "black").type, "Failure");
  assert.equal(success(setPaletteThemeColor(design, "pc_bg", "dark", "#111111")), design);
  assert.equal(setFrameTheme(design, "light-card", "dark").type, "Failure");
  assert.equal(setFrameTheme(design, "light-screen", "sepia").type, "Failure");
});

test("MCP からテーマの一覧・色の値・フレームのテーマを編集できる", () => {
  let current: Document = { ...document(frame({ id: "screen" })), palette: [paletteColor({ id: "pc_bg", color: "#ffffff" })] };
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_themes", { themes: ["light", "dark"] }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_palette_theme_color", { id: "pc_bg", theme: "dark", color: "#000000" }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_frame_theme", { id: "screen", theme: "dark" }).ok, true);
  assert.equal(success(api.getElement("screen")).theme, "dark");
  assert.deepEqual(success(api.listThemes()), { themes: ["light", "dark"] });
  assert.equal(dispatchAgentRequest(api, "rename_theme", { from: "dark", to: "night" }).ok, true);
  assert.deepEqual(current.palette[0].themes, { night: "#000000" });
  assert.equal(dispatchAgentRequest(api, "set_frame_theme", { id: "screen", theme: null }).ok, true);
  assert.equal(Object.hasOwn(success(api.getElement("screen")), "theme"), false);
  assert.equal(dispatchAgentRequest(api, "set_palette_theme_color", { id: "pc_bg", theme: "light", color: "#000000" }).ok, false);
});
