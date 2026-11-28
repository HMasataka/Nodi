import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNodes } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { createAgentApi } from "../src/agent/api.ts";
import { createHistory } from "../src/document/history.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { resolveDocumentInstances } from "../src/document/instances.ts";
import { collectNodes, findNode } from "../src/document/commands/tree.ts";
import { component, document, frame, instance, rectangle, success, text } from "./support/factories.ts";
import { deleteNode, duplicateNode, fillSlot, renameNode, resetSlot, setComponentSlot } from "../src/document/commands/index.ts";
import type { Document, DocumentNode, FrameNode } from "../src/document/types.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const interaction = { onNodePointerDown() {}, onResizePointerDown() {}, onNodePointerMove() {}, onNodePointerUp() {}, onImageError() {} };

// 見出しと本体（slot）を持つ Dock。本体の既定の中身は「既定」の文字。
const dock = component({ id: "cp_dock", name: "Dock", node: frame({ id: "dock-root", children: [
  text({ id: "dock-title", name: "見出し", content: "Dock" }),
  frame({ id: "dock-body", name: "本体", slot: true, children: [text({ id: "body-default", name: "既定の中身", content: "既定" })] }),
] }) });
// Dock を中に置いた Page。
const page = component({ id: "cp_page", name: "Page", node: frame({ id: "page-root", children: [instance({ id: "page-dock", name: "Page の Dock", componentRef: "cp_dock" })] }) });

function design(): Document {
  return { ...document(instance({ id: "dock", componentRef: "cp_dock" }), rectangle({ id: "chart", name: "グラフ" }), text({ id: "note", name: "メモ", content: "差し替えた文字" })), components: [dock, page] };
}

function body(doc: Document, index = 0): FrameNode {
  const root = resolveDocumentInstances(doc).children[index] as FrameNode;
  return root.children[1] as FrameNode;
}

test("slot を差し替えなければ既定の中身、差し替えたら中身を描き、編集画面と PNG にも出る", async () => {
  assert.deepEqual(body(design()).children.map((node) => node.id), ["body-default"]);
  const filled = success(fillSlot(design(), "dock", "dock-body", ["chart", "note"]));
  assert.deepEqual(filled.children.map((node) => node.id), ["dock"]);
  assert.deepEqual(body(filled).children.map((node) => node.id), ["chart", "note"]);

  const resolved = resolveDocumentInstances(filled).children;
  const markup = renderToStaticMarkup(<CanvasNodes nodes={resolved} selectedId={null} interaction={interaction} />);
  assert.match(markup, /aria-label="グラフ"/);
  assert.doesNotMatch(markup, /既定の中身/);

  const texts: string[] = [];
  const ctx = new Proxy({ measureText: (value: string) => ({ width: value.length * 8 }), letterSpacing: "0px" } as Record<string | symbol, unknown>, {
    get: (target, key) => key in target ? target[key] : key === "fillText" ? (value: string) => texts.push(value) : () => ({ addColorStop() {} }),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"], { type: "image/png" })) };
  const environment = { createCanvas: () => canvas as unknown as HTMLCanvasElement, loadImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) as HTMLImageElement };
  success(await renderFramePng(frame({ id: "screen", children: filled.children }), environment, { components: filled.components }));
  assert.ok(texts.includes("差し替えた文字"));
  assert.ok(!texts.includes("既定"));
});

test("入れ子のインスタンスの slot をパスで差し替え、内側の差し替えより外側を優先する", () => {
  const inner = instance({ id: "page-dock", name: "Page の Dock", componentRef: "cp_dock", slots: { "dock-body": [text({ id: "inner-content", content: "内側" })] } });
  const pageWithInner = component({ ...page, node: frame({ id: "page-root", children: [inner] }) });
  const base: Document = { ...document(instance({ id: "page", componentRef: "cp_page" })), components: [dock, pageWithInner] };
  const nested = (doc: Document) => (((resolveDocumentInstances(doc).children[0] as FrameNode).children[0] as FrameNode).children[1] as FrameNode).children.map((node) => node.id);
  assert.deepEqual(nested(base), ["inner-content"]);
  const outer = { ...base, children: [instance({ id: "page", componentRef: "cp_page", slots: { "page-dock/dock-body": [rectangle({ id: "outer-content" })] } })] };
  assert.deepEqual(nested(outer), ["outer-content"]);
  assert.equal(parseDocument(success(serializeDocument(outer))).type, "Success");
});

test("差し替えた中身の要素は、名前変更・削除・複製など普段の操作で個別に編集できる", () => {
  const filled = success(fillSlot(design(), "dock", "dock-body", ["chart", "note"]));
  assert.equal(findNode(filled, "chart")?.name, "グラフ");
  assert.equal(findNode(success(renameNode(filled, "chart", "売上")), "chart")?.name, "売上");
  assert.deepEqual(body(success(deleteNode(filled, "note"))).children.map((node) => node.id), ["chart"]);
  const copied = success(duplicateNode(filled, "chart"));
  assert.equal(body(copied.document).children.length, 3);
  // インスタンスを複製すると、slot の中身も新しい ID で写り、ID は文書内で重ならない。
  const instanceCopy = success(duplicateNode(filled, "dock"));
  const ids = collectNodes(instanceCopy.document.children).map((node: DocumentNode) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 6);
  assert.equal(parseDocument(success(serializeDocument(instanceCopy.document))).type, "Success");
});

test("slot を保存し、定義の外の slot・slot でないキー・中身の ID の重複は読み込みで拒否する", () => {
  const filled = success(fillSlot(design(), "dock", "dock-body", ["chart"]));
  const json = JSON.parse(success(serializeDocument(filled)));
  assert.deepEqual(success(parseDocument(JSON.stringify(json))), filled);
  assert.equal(json.components[0].node.children[1].slot, true);
  const broken = [
    { ...json, children: [{ ...json.children[0], slots: { "dock-title": [] } }] },
    { ...json, children: [{ ...json.children[0], slots: { missing: [] } }] },
    { ...json, children: [...json.children, { ...json.children[0].slots["dock-body"][0] }] },
    { ...json, children: [...json.children, { id: "loose", name: "x", type: "frame", x: 0, y: 0, width: 1, height: 1, style: { fill: null }, slot: true, children: [] }] },
  ];
  for (const value of broken) assert.equal(parseDocument(JSON.stringify(value)).type, "Failure");
});

test("slot の印を外すと差し替えも外れ、既定に戻すと定義の中身を描く", () => {
  const filled = success(fillSlot(design(), "dock", "dock-body", ["chart"]));
  const unmarked = success(setComponentSlot(filled, "cp_dock", "dock-body", false));
  assert.equal(Object.hasOwn(unmarked.children[0], "slots"), false);
  assert.equal(setComponentSlot(filled, "cp_dock", "dock-title", true).type, "Failure");
  assert.equal(setComponentSlot(filled, "cp_dock", "missing", true).type, "Failure");
  assert.deepEqual(body(success(resetSlot(filled, "dock", "dock-body"))).children.map((node) => node.id), ["body-default"]);
  assert.equal(resetSlot(design(), "dock", "dock-body").type, "Failure");
  assert.equal(fillSlot(design(), "dock", "dock-title", ["chart"]).type, "Failure");
  assert.equal(fillSlot(design(), "dock", "dock-body", ["dock"]).type, "Failure");
  assert.equal(fillSlot(design(), "dock", "dock-body", ["chart", "chart"]).type, "Failure");
  assert.deepEqual(body(success(fillSlot(design(), "dock", "dock-body", []))).children, []);
});

test("MCP から slot の印付け・差し替え・既定に戻すことができ、中身は要素一覧に並ぶ", () => {
  let current = design();
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_component_slot", { componentId: "cp_dock", nodeId: "dock-title", slot: true }).ok, false);
  assert.equal(dispatchAgentRequest(api, "fill_slot", { id: "dock", slotId: "dock-body", nodeIds: ["chart"] }).ok, true);
  assert.deepEqual(success(api.getElement("dock")).slots, { "dock-body": ["chart"] });
  assert.equal(success(api.getElement("chart")).parentId, "dock");
  assert.equal(dispatchAgentRequest(api, "reset_slot", { id: "dock", slotId: "dock-body" }).ok, true);
  assert.equal(api.getElement("chart").type, "Failure");
  assert.equal(dispatchAgentRequest(api, "set_component_slot", { componentId: "cp_dock", nodeId: "dock-body", slot: false }).ok, true);
  assert.equal(dispatchAgentRequest(api, "fill_slot", { id: "dock", slotId: "dock-body", nodeIds: ["note"] }).ok, false);
});
