import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { createAgentApi } from "../src/agent/api.ts";
import { CreationTools } from "../src/pages/editor/components/molecules/CreationTools/CreationTools.tsx";
import { importSvgIcon } from "../src/document/commands/svgImport.ts";
import { importSvgPaths } from "../src/document/svgPath.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, frame, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const parse = (source: string) => new DOMParser().parseFromString(source, "image/svg+xml") as unknown as XMLDocument;
const svg = (content: string, attributes = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 40 20" ${attributes}>${content}</svg>`;

test("相対・省略・滑らかな曲線を正規化し、複数パスの順序と色を保つ", () => {
  const source = svg('<path d="M10 20 50 20 50 40 10 40z M20 25 l20 0 0 10 -20 0z" fill-rule="evenodd" fill="#abc"/>' +
    '<path d="M10 20 C20 10 30 10 40 20 S50 30 50 40" fill="none" stroke="currentColor" stroke-width="2"/>',
    'color="#234567"');
  const icon = success(importSvgPaths(source, parse));
  assert.deepEqual([icon.width, icon.height, icon.paths.length], [40, 20, 2]);
  assert.deepEqual(icon.paths[0].commands[0], { kind: "move", x: 0, y: 0 });
  assert.deepEqual(icon.paths[0].commands[1], { kind: "line", x: 1, y: 0 });
  assert.equal(icon.paths[0].commands.filter((command) => command.kind === "close").length, 2);
  assert.deepEqual(icon.paths[0].style, { fill: "#aabbcc", stroke: null });
  assert.equal(icon.paths[0].fillRule, "evenodd");
  const smooth = icon.paths[1].commands[2];
  assert.equal(smooth.kind, "cubic");
  if (smooth.kind !== "cubic") assert.fail("曲線へ変換できません");
  assert.deepEqual([smooth.x1, smooth.y1], [1, 0.5]);
  assert.deepEqual(icon.paths[1].style, { fill: null, stroke: { color: "#234567", width: 2 } });
});

test("H/V/Q/Tの絶対・相対命令を直線と3次ベジェへ変換する", () => {
  const icon = success(importSvgPaths(svg('<path d="M10,20 h20 v10 H10 V20 M10 20 Q20 0 30 20 T50 20"/>'), parse));
  const commands = icon.paths[0].commands;
  assert.deepEqual(commands[1], { kind: "line", x: 0.5, y: 0 });
  assert.deepEqual(commands[2], { kind: "line", x: 0.5, y: 0.5 });
  assert.equal(commands[6].kind, "cubic");
  assert.equal(commands[7].kind, "cubic");
  if (commands[7].kind !== "cubic") assert.fail("曲線へ変換できません");
  assert.ok(commands[7].y1 > 0);
});

test("SVGの複数パスを一つの透明フレームとして取り込み、Undo/Redo・保存・描画で保つ", () => {
  const icon = success(importSvgPaths(svg('<path d="M10 20 L50 20 L30 40z" fill="#d9e8e1"/>' +
    '<path d="M20 25 L40 25 L30 35z" fill="none" stroke="#24383a" stroke-width="3"/>'), parse));
  const original = document(frame());
  const imported = success(importSvgIcon(original, { icon, name: "編集可能なアイコン", x: 24, y: 50, parentId: "frame" }));
  assert.equal(imported.node.type, "frame");
  if (imported.node.type !== "frame") assert.fail("フレームへ取り込めません");
  assert.equal(imported.node.style.fill, null);
  assert.deepEqual([imported.node.width, imported.node.height], [96, 48]);
  assert.deepEqual(imported.node.children.map((node) => node.type), ["path", "path"]);
  assert.deepEqual(imported.node.children.map((node) => node.style.fill), ["#d9e8e1", null]);
  assert.deepEqual(success(parseDocument(success(serializeDocument(imported.document)))), imported.document);
  const history = commit(createHistory(original), imported.document);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, imported.document);
  const noOp = () => {};
  const markup = renderToStaticMarkup(<CanvasNode node={imported.node} selectedId={null}
    interaction={{ onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp }} />);
  assert.ok(markup.indexOf('fill="#d9e8e1"') < markup.indexOf('stroke="#24383a"'));
  let current = original;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null,
    apply(next) { current = next; } });
  assert.equal(api.importSvg({ icon, name: "別のアイコン", x: 24, y: 50, parentId: "frame" }).type, "Success");
  assert.equal(current.children[0].type === "frame" && current.children[0].children.length, 1);
});

test("未対応要素・属性・色・弧を欠けたアイコンにせず拒否する", () => {
  for (const source of [
    svg('<circle cx="1" cy="2" r="4"/>'),
    svg('<g><path d="M10 20 L20 20"/></g>'),
    svg('<path d="M10 20 L20 20" transform="rotate(20)"/>'),
    svg('<path d="M10 20 L20 20" class="icon"/>'),
    svg('<path d="M10 20 A10 10 0 0 0 20 20"/>'),
    svg('<path d="M10 20 L20 20" fill="url(#gradient)"/>'),
    svg('<path d="M10 20 L20 20"/><image href="https://example.com/icon.png"/>'),
    svg('<path d="M10 20 L20 20"/>', 'transform="scale(2)"'),
    svg('<path d="M10 20 L20 20"/>', 'viewBox="0 0 1 1"'),
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L1 1"/></svg>',
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 L1 1"/></svg>',
  ]) assert.equal(importSvgPaths(source, parse).type, "Failure", source);
});

test("取り込みUIが画像取り込みと並存し、PNGは複数パスを背面から描く", async () => {
  const noOp = () => {};
  const controls = renderToStaticMarkup(<CreationTools onCreate={noOp} onImportImage={async () => {}} onImportSvg={async () => {}}
    drawTool="select" onDrawToolChange={noOp} />);
  assert.match(controls, /SVGパスを取り込む/);
  assert.match(controls, /画像を追加/);
  const icon = success(importSvgPaths(svg('<path d="M10 20 L50 20 L30 40z" fill="#e8b487"/>' +
    '<path d="M20 25 L40 25 L30 35z" fill="none" stroke="#24383a" stroke-width="3"/>'), parse));
  const imported = success(importSvgIcon(document(), { icon, name: "ロゴ", x: 0, y: 0 }));
  if (imported.node.type !== "frame") assert.fail("フレームへ取り込めません");
  const calls: [string, string][] = [];
  const ctx = { save() {}, restore() {}, translate() {}, beginPath() {}, rect() {}, clip() {},
    moveTo() {}, lineTo() {}, closePath() {}, fillStyle: "", strokeStyle: "",
    fill() { calls.push(["fill", this.fillStyle]); }, stroke() { calls.push(["stroke", this.strokeStyle]); } };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(imported.node, { createCanvas: () => canvas as unknown as HTMLCanvasElement,
    loadImage: async () => ({}) as HTMLImageElement }));
  assert.deepEqual(calls, [["fill", "#e8b487"], ["stroke", "#24383a"]]);
});

test("サンプルのSVGアイコンを2つの編集可能なパスへ取り込める", async () => {
  const source = await readFile(new URL("../samples/path-icon.svg", import.meta.url), "utf8");
  const icon = success(importSvgPaths(source, parse));
  assert.equal(icon.paths.length, 2);
  assert.ok(icon.paths[0].commands.some((command) => command.kind === "cubic"));
  const imported = success(importSvgIcon(document(), { icon, name: "方位アイコン", x: 10, y: 20 }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(imported.document)))), imported.document);
});

test("GitHub Docsサンプルの埋め込みマークもパスとして解釈できる", async () => {
  const sample = JSON.parse(await readFile(new URL("../samples/github-docs-hello-world.nodi", import.meta.url), "utf8"));
  const locate = (nodes: Array<{ type: string; source?: string; children?: typeof nodes }>): string | undefined => {
    for (const node of nodes) {
      if (node.type === "image" && node.source?.startsWith("data:image/svg+xml;base64,")) return node.source;
      const nested = node.children && locate(node.children);
      if (nested) return nested;
    }
  };
  const source = locate(sample.children);
  assert.ok(source);
  const icon = success(importSvgPaths(Buffer.from(source.split(",")[1], "base64").toString("utf8"), parse));
  assert.equal(icon.paths.length, 1);
  assert.ok(icon.paths[0].commands.some((command) => command.kind === "cubic"));
});
