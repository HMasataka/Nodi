import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNodes } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { createAgentApi } from "../src/agent/api.ts";
import { createHistory } from "../src/document/history.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { maskGroups } from "../src/document/masks.ts";
import { nodesInBounds } from "../src/pages/editor/geometry.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { resolveDocumentInstances } from "../src/document/instances.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { component, document, frame, instance, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { setInstanceOverride, setVisible } from "../src/document/commands/index.ts";

const interaction = { onNodePointerDown() {}, onResizePointerDown() {}, onNodePointerMove() {}, onNodePointerUp() {}, onImageError() {} };

test("表示は既定で true とし、隠したときだけ visible: false を保存する", () => {
  const shown = document(rectangle());
  const json = success(serializeDocument(shown));
  assert.equal(Object.hasOwn(JSON.parse(json).children[0], "visible"), false);
  assert.equal(success(parseDocument(json)).children[0].visible, true);
  const hidden = success(setVisible(shown, "rectangle", false));
  const saved = JSON.parse(success(serializeDocument(hidden)));
  assert.equal(saved.children[0].visible, false);
  assert.deepEqual(success(parseDocument(JSON.stringify(saved))), hidden);
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...saved.children[0], visible: "no" }] })).type, "Failure");
  assert.equal(setVisible(shown, "missing", false).type, "Failure");
  assert.equal(success(setVisible(shown, "rectangle", true)), shown);
});

test("隠した要素はマスクの組に入れず、隠したマスクは切り抜かない", () => {
  const mask = rectangle({ id: "mask", isMask: true, visible: false });
  const first = rectangle({ id: "first" });
  const hidden = rectangle({ id: "hidden", visible: false });
  assert.deepEqual(maskGroups([mask, first, hidden]).map(({ mask: item, children }) => [item?.id ?? null, children.map((node) => node.id)]),
    [[null, ["first"]]]);
});

test("隠した要素はキャンバス・範囲選択・PNG に出さず、レイヤーの木には残す", async () => {
  const root = frame({ id: "root", width: 200, height: 100, children: [
    rectangle({ id: "shown", name: "見える矩形", x: 0, y: 0, width: 40, height: 40 }),
    text({ id: "secret", name: "隠したテキスト", x: 50, y: 0, content: "隠した文字", visible: false }),
  ] });
  const markup = renderToStaticMarkup(<CanvasNodes nodes={[root]} selectedId={null} interaction={interaction} />);
  assert.match(markup, /aria-label="見える矩形"/);
  assert.doesNotMatch(markup, /隠したテキスト|隠した文字/);
  assert.deepEqual(nodesInBounds(document(root), { x: 0, y: 0, width: 200, height: 100 }), ["root", "shown"]);
  assert.equal(root.children.length, 2);

  const texts: string[] = [];
  const ctx = new Proxy({ measureText: (value: string) => ({ width: value.length * 8 }), letterSpacing: "0px" } as Record<string | symbol, unknown>, {
    get: (target, key) => key in target ? target[key] : key === "fillText" ? (value: string) => texts.push(value) : () => ({ addColorStop() {} }),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"], { type: "image/png" })) };
  success(await renderFramePng(root, { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) as HTMLImageElement }));
  assert.deepEqual(texts, []);
});

test("自動レイアウトは隠した子を並びから外し、隠した子の位置とサイズは保つ", () => {
  const row = frame({ id: "row", width: 300, height: 50, layoutMode: "horizontal", gap: 10, children: [
    rectangle({ id: "a", width: 40, height: 20 }),
    rectangle({ id: "hidden", x: 7, y: 8, width: 100, height: 20, visible: false }),
    rectangle({ id: "b", width: 40, height: 20 }),
    rectangle({ id: "fill", width: 0, height: 20, widthConstraint: { mode: "fill" } }),
  ] });
  const [resolved] = resolveDocumentLayout(document(row)).children;
  assert.equal(resolved.type, "frame");
  if (resolved.type !== "frame") return;
  assert.deepEqual(resolved.children.map(({ id, x, width }) => [id, x, width]), [["a", 0, 40], ["hidden", 7, 100], ["b", 50, 40], ["fill", 100, 200]]);
});

test("コンポーネントで隠した子をインスタンスのオーバーライドで出し、インスタンス自身の表示にも従う", () => {
  const definition = component({ node: frame({ id: "button", width: 100, height: 40, children: [
    rectangle({ id: "arrow", visible: false }),
  ] }) });
  const base = { ...document(instance({ id: "use" })), components: [definition] };
  const childOf = (doc: typeof base) => {
    const [node] = resolveDocumentInstances(doc).children;
    return node.type === "frame" ? node : null;
  };
  assert.equal(childOf(base)?.children[0].visible, false);
  const shown = success(setInstanceOverride(base, "use", "arrow", { visible: true }));
  assert.equal(childOf(shown)?.children[0].visible, true);
  assert.equal(JSON.parse(success(serializeDocument(shown))).children[0].overrides.arrow.visible, true);
  const hiddenInstance = success(setVisible(shown, "use", false));
  assert.equal(childOf(hiddenInstance)?.visible, false);
});

test("MCP から表示を切り替え、要素の参照に visible を返す", () => {
  const definition = component({ node: frame({ id: "button", children: [rectangle({ id: "arrow", visible: false })] }) });
  let current = { ...document(rectangle(), instance({ id: "use" })), components: [definition] };
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(success(api.getElement("rectangle")).visible, true);
  assert.equal(dispatchAgentRequest(api, "set_visible", { id: "rectangle", visible: false }).ok, true);
  assert.equal(success(api.getElement("rectangle")).visible, false);
  assert.equal(dispatchAgentRequest(api, "set_visible", { id: "rectangle", visible: "false" }).ok, false);
  assert.equal(dispatchAgentRequest(api, "set_instance_override", { id: "use", childId: "arrow", visible: true }).ok, true);
  const use = current.children[1];
  assert.equal(use.type === "instance" ? use.overrides.arrow?.visible : undefined, true);
});
