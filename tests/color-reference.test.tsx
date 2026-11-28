import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { ColorResolverContext } from "../src/pages/editor/colorContext.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { createColorResolver, resolveColor, resolveDocumentColors } from "../src/document/colorRef.ts";
import { detachPaletteColor, removePaletteColor } from "../src/document/commands/index.ts";
import { document, frame, paletteColor, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const ref = { type: "palette" as const, id: "pc1" };

test("resolveColor は HEX をそのまま、参照をパレットの色へ解決する", () => {
  const palette = [paletteColor({ id: "pc1", color: "#12345680" })];
  assert.equal(resolveColor("#00ff00", palette), "#00ff00");
  assert.equal(resolveColor(ref, palette), "#12345680");
  assert.equal(resolveColor({ type: "palette", id: "missing" }, palette), "#000000");
});

test("resolveDocumentColors は塗り・線・辺線・文字・装飾・影・ストップの参照を HEX に解決する", () => {
  const palette = [paletteColor({ id: "pc1", color: "#123456" })];
  const box = rectangle({
    style: { fill: ref, stroke: { color: ref, width: 1 }, border: { top: { color: ref, width: 1 } },
      cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 } },
    shadow: { color: ref, offsetX: 1, offsetY: 2, blur: 3 },
  });
  const label = text({ id: "label", style: { color: ref }, marks: [{ start: 0, end: 2, color: ref }] });
  const gradient = { type: "linear" as const, start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ position: 0, color: ref }, { position: 1, color: "#000000" }] };
  const framed = frame({ style: { fill: gradient } });
  const resolved = resolveDocumentColors({ ...document(box, label, framed), palette });

  const [rbox, rlabel, rframe] = resolved.children;
  assert.equal(rbox.type === "rectangle" && rbox.style.fill, "#123456");
  assert.equal(rbox.type === "rectangle" && rbox.style.stroke?.color, "#123456");
  assert.equal(rbox.type === "rectangle" && rbox.style.border.top?.color, "#123456");
  assert.equal(rbox.shadow?.color, "#123456");
  assert.equal(rlabel.type === "text" && rlabel.style.color, "#123456");
  assert.equal(rlabel.type === "text" && rlabel.marks?.[0].color, "#123456");
  assert.equal(rframe.type === "frame" && rframe.style.fill && typeof rframe.style.fill !== "string" && rframe.style.fill.stops[0].color, "#123456");
});

test("8桁HEXのアルファを保ち、要素全体の opacity とは独立に解決する", () => {
  const palette = [paletteColor({ id: "pc1", color: "#12345680" })];
  const box = rectangle({ style: { fill: ref }, opacity: 0.5 });
  const resolved = resolveDocumentColors({ ...document(box), palette }).children[0];
  assert.equal(resolved.style.fill, "#12345680");
  assert.equal(resolved.opacity, 0.5);
});

test("色参照は保存・再読込で参照のまま保持する", () => {
  const doc = { ...document(rectangle({ style: { fill: ref } })), palette: [paletteColor({ id: "pc1", name: "主色", color: "#123456" })] };
  const json = success(serializeDocument(doc));
  assert.match(json, /"type": "palette"/);
  assert.deepEqual(success(parseDocument(json)), doc);
});

test("存在しないパレット参照は保存・読み込みで拒否する", () => {
  const broken = { ...document(rectangle({ style: { fill: { type: "palette", id: "missing" } } })), palette: [paletteColor({ id: "pc1", color: "#123456" })] };
  assert.equal(serializeDocument(broken).type, "Failure");
  const wire = { version: 1, children: [{ id: "r", name: "矩形", type: "rectangle", x: 0, y: 0, width: 10, height: 10,
    style: { fill: { type: "palette", id: "missing" } } }], palette: [{ id: "pc1", name: "主色", color: "#123456" }] };
  assert.equal(parseDocument(JSON.stringify(wire)).type, "Failure");
});

test("参照を解除すると現在の解決色へ変換し、パレットは残す", () => {
  const doc = { ...document(rectangle({ style: { fill: ref } })), palette: [paletteColor({ id: "pc1", color: "#123456" })] };
  const detached = success(detachPaletteColor(doc, "pc1"));
  const node = detached.children[0];
  assert.equal(node.type === "rectangle" && node.style.fill, "#123456");
  assert.equal(detached.palette.length, 1);
  assert.equal(detachPaletteColor(doc, "missing").type, "Failure");
});

test("使用中のパレット色を削除すると参照を HEX に変換してから消す", () => {
  const doc = { ...document(rectangle({ style: { fill: ref } })), palette: [paletteColor({ id: "pc1", color: "#123456" })] };
  const removed = success(removePaletteColor(doc, "pc1"));
  const node = removed.children[0];
  assert.equal(node.type === "rectangle" && node.style.fill, "#123456");
  assert.deepEqual(removed.palette, []);
});

test("編集画面と PNG は同じ解決色を使う", async () => {
  const palette = [paletteColor({ id: "pc1", color: "#123456" })];
  const box = rectangle({ id: "box", style: { fill: ref } });
  const root = frame({ id: "root", width: 100, height: 50, style: { fill: null }, children: [box] });
  const noOp = () => {};
  const markup = renderToStaticMarkup(
    <ColorResolverContext.Provider value={createColorResolver(palette)}>
      <CanvasNode node={root} selectedId={null}
        interaction={{ onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp }} />
    </ColorResolverContext.Provider>,
  );
  assert.match(markup, /fill="#123456"/);

  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, ellipse() {}, closePath() {},
    fillStyle: "", strokeStyle: "", fill() {}, stroke() {}, setTransform() {}, drawImage() {}, measureText: () => ({ width: 0 }) };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(root, { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({}) as HTMLImageElement }, {}, palette));
  assert.equal(ctx.fillStyle, "#123456");
});
