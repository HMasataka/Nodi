import assert from "node:assert/strict";
import { test } from "vitest";

import { applyOverride, resolveDocumentInstances } from "../src/document/instances.ts";
import { createComponent, createInstance } from "../src/document/commands/index.ts";
import { document, frame, image, instance, rectangle, success, text } from "./support/factories.ts";
import type { FrameNode, RectangleNode, TextNode } from "../src/document/types.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("定義を参照するインスタンスを作成できる", () => {
  const base = success(createComponent(document(frame({ id: "frame1", width: 200, height: 100 })), { sourceId: "frame1", name: "ボタン" })).document;
  const created = success(createInstance(base, { componentRef: base.components[0].id, x: 30, y: 40 }));
  assert.match(created.node.id, /^nd_/);
  assert.equal(created.node.type, "instance");
  assert.equal(created.node.componentRef, base.components[0].id);
  assert.deepEqual(created.node.overrides, {});
  assert.equal(created.node.width, 200);
  assert.equal(created.node.height, 100);
  assert.equal(created.node.name, "ボタン");
  assert.equal(created.document.children[0].id, "frame1");
  assert.equal(created.document.children[1].id, created.node.id);
});

test("存在しない定義へのインスタンス作成を拒否する", () => {
  assert.equal(createInstance(document(), { componentRef: "missing", x: 0, y: 0 }).type, "Failure");
});

test("インスタンスを定義ツリーへ解決し、位置とサイズを適用する", () => {
  const source = frame({ id: "frame1", width: 200, height: 100, children: [text({ id: "t1", content: "ラベル" })] });
  const base = success(createComponent(document(source), { sourceId: "frame1", name: "ボタン" })).document;
  const definition = base.components[0];
  const labelId = definition.node.children[0].id;
  const withInstance = success(createInstance(base, { componentRef: definition.id, x: 50, y: 60 })).document;

  const resolved = resolveDocumentInstances(withInstance);
  assert.equal(resolved.children.length, 2);
  assert.equal(resolved.children[0].id, "frame1");
  const root = resolved.children[1] as FrameNode;
  assert.equal(root.type, "frame");
  assert.equal(root.id, definition.node.id);
  assert.equal(root.x, 50);
  assert.equal(root.y, 60);
  assert.equal(root.width, 200);
  assert.equal(root.height, 100);
  assert.equal(root.children[0].id, labelId);
  assert.equal((root.children[0] as TextNode).content, "ラベル");
});

test("オーバーライドで文言・文字色・塗り・線を変更する", () => {
  const source = frame({ id: "frame1", width: 200, height: 100, children: [text({ id: "t1", content: "元のラベル" }), rectangle({ id: "r1" })] });
  const base = success(createComponent(document(source), { sourceId: "frame1", name: "カード" })).document;
  const definition = base.components[0];
  const textId = definition.node.children[0].id;
  const rectId = definition.node.children[1].id;
  const doc = { ...document(), components: [definition], children: [instance({
    componentRef: definition.id, width: 200, height: 100,
    overrides: { [textId]: { content: "変更後", color: "#ff0000" }, [rectId]: { fill: "#00ff00", stroke: null } },
  })] };

  const root = resolveDocumentInstances(doc).children[0] as FrameNode;
  const label = root.children[0] as TextNode;
  const box = root.children[1] as RectangleNode;
  assert.equal(label.content, "変更後");
  assert.equal(label.style.color, "#ff0000");
  assert.equal(box.style.fill, "#00ff00");
  assert.equal(box.style.stroke, null);
});

test("オーバーライドで画像とサイズを変更する", () => {
  const source = frame({ id: "frame1", width: 200, height: 100, children: [image({ id: "img1" }), rectangle({ id: "r1" })] });
  const base = success(createComponent(document(source), { sourceId: "frame1", name: "メディア" })).document;
  const definition = base.components[0];
  const imageId = definition.node.children[0].id;
  const rectId = definition.node.children[1].id;
  const nextSource = "data:image/png;base64,aGVsbG8=";
  const doc = { ...document(), components: [definition], children: [instance({
    componentRef: definition.id, width: 200, height: 100,
    overrides: { [imageId]: { source: nextSource }, [rectId]: { width: 120, height: 60 } },
  })] };

  const root = resolveDocumentInstances(doc).children[0] as FrameNode;
  const picture = root.children[0];
  const box = root.children[1] as RectangleNode;
  assert.equal(picture.type, "image");
  assert.equal(picture.type === "image" ? picture.source : "", nextSource);
  assert.equal(box.width, 120);
  assert.equal(box.height, 60);
});

test("ネストしたコンポーネントのインスタンスを再帰的に解決する", () => {
  const inner = frame({ id: "inner-root", width: 100, height: 50, children: [text({ id: "inner-text", content: "内部" })] });
  const outer = frame({ id: "outer-root", width: 120, height: 70, children: [instance({ id: "nested", componentRef: "inner-cp", width: 100, height: 50 })] });
  const doc = { ...document(), components: [
    { id: "inner-cp", name: "内側", node: inner },
    { id: "outer-cp", name: "外側", node: outer },
  ], children: [instance({ componentRef: "outer-cp", width: 120, height: 70 })] };

  const root = resolveDocumentInstances(doc).children[0] as FrameNode;
  assert.equal(root.type, "frame");
  assert.equal(root.id, "outer-root");
  const nested = root.children[0] as FrameNode;
  assert.equal(nested.id, "inner-root");
  assert.equal((nested.children[0] as TextNode).content, "内部");
});

test("applyOverride は該当しない属性を無視する", () => {
  const box = rectangle({ id: "r1" });
  const updated = applyOverride(box, { content: "無視", color: "#ff0000", width: 80 }) as RectangleNode;
  assert.equal(updated.width, 80);
  assert.deepEqual(updated.style, box.style);
  assert.equal("content" in updated, false);
});

test("存在しない定義への参照は読み込み時に拒否する", () => {
  const doc = { version: 1, children: [instance({ componentRef: "missing" })] };
  assert.equal(parseDocument(JSON.stringify(doc)).type, "Failure");
});

test("コンポーネントの循環参照は読み込み時に拒否する", () => {
  const aNode = frame({ id: "a-root", width: 100, height: 50, children: [instance({ id: "a-inst", componentRef: "cp-b", width: 100, height: 50 })] });
  const bNode = frame({ id: "b-root", width: 100, height: 50, children: [instance({ id: "b-inst", componentRef: "cp-a", width: 100, height: 50 })] });
  const doc = { version: 1, children: [], components: [
    { id: "cp-a", name: "A", node: aNode },
    { id: "cp-b", name: "B", node: bNode },
  ] };
  assert.equal(parseDocument(JSON.stringify(doc)).type, "Failure");
});

test("インスタンスとオーバーライドを保存・再読込して round-trip する", () => {
  const source = frame({ id: "frame1", width: 200, height: 100, children: [text({ id: "t1", content: "ラベル" })] });
  const base = success(createComponent(document(source), { sourceId: "frame1", name: "ボタン" })).document;
  const definition = base.components[0];
  const textId = definition.node.children[0].id;
  const original = { ...base, children: [...base.children, instance({
    componentRef: definition.id, x: 10, y: 20, width: 200, height: 100,
    overrides: { [textId]: { content: "変更" } },
  })] };
  const before = structuredClone(original);
  const json = success(serializeDocument(original));
  const wire = JSON.parse(json);
  assert.equal(wire.children[1].type, "instance");
  assert.equal(wire.children[1].componentRef, definition.id);
  assert.deepEqual(wire.children[1].overrides, { [textId]: { content: "変更" } });
  assert.deepEqual(success(parseDocument(json)), original);
  assert.deepEqual(original, before);
  assert.equal(success(serializeDocument(success(parseDocument(json)))), json);
});

test("空のオーバーライドは保存時に省略する", () => {
  const base = success(createComponent(document(frame({ id: "frame1" })), { sourceId: "frame1", name: "ボタン" })).document;
  const withInstance = success(createInstance(base, { componentRef: base.components[0].id, x: 0, y: 0 })).document;
  const wire = JSON.parse(success(serializeDocument(withInstance)));
  const instanceWire = wire.children[1];
  assert.equal(instanceWire.type, "instance");
  assert.equal(Object.hasOwn(instanceWire, "overrides"), false);
});
