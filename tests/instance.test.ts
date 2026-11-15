import assert from "node:assert/strict";
import { test } from "vitest";

import { applyOverride, resolveDocumentInstances } from "../src/document/instances.ts";
import { createComponent, createInstance, detachInstance, duplicateNode, removeComponent, renameComponent, resetInstanceOverride, setInstanceOverride } from "../src/document/commands/index.ts";
import { document, frame, image, instance, rectangle, success, text } from "./support/factories.ts";
import type { DocumentNode, FrameNode, RectangleNode, TextNode } from "../src/document/types.ts";
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
  assert.equal(root.id, withInstance.children[1].id);
  assert.equal(root.name, "ボタン");
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
  assert.equal(root.id, "instance");
  const nested = root.children[0] as FrameNode;
  assert.equal(nested.id, "nested");
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

test("定義の名前変更は参照を壊さない", () => {
  const base = success(createComponent(document(frame({ id: "frame1", width: 200, height: 100 })), { sourceId: "frame1", name: "ボタン" })).document;
  const definitionId = base.components[0].id;
  const withInstance = success(createInstance(base, { componentRef: definitionId, x: 0, y: 0 })).document;
  const renamed = success(renameComponent(withInstance, definitionId, "新しい名前"));
  assert.equal(renamed.components[0].name, "新しい名前");
  assert.equal(renamed.components[0].id, definitionId);
  const instanceNode = renamed.children[1];
  assert.equal(instanceNode.type, "instance");
  assert.equal(instanceNode.type === "instance" ? instanceNode.componentRef : "", definitionId);
  const resolved = resolveDocumentInstances(renamed);
  assert.equal(resolved.children[1].type, "frame");
});

test("空のオーバーライドは保存時に省略する", () => {
  const base = success(createComponent(document(frame({ id: "frame1" })), { sourceId: "frame1", name: "ボタン" })).document;
  const withInstance = success(createInstance(base, { componentRef: base.components[0].id, x: 0, y: 0 })).document;
  const wire = JSON.parse(success(serializeDocument(withInstance)));
  const instanceWire = wire.children[1];
  assert.equal(instanceWire.type, "instance");
  assert.equal(Object.hasOwn(instanceWire, "overrides"), false);
});

test("オーバーライドを設定・解除できる", () => {
  const source = frame({ id: "frame1", width: 200, height: 100, children: [text({ id: "t1", content: "元" })] });
  const base = success(createComponent(document(source), { sourceId: "frame1", name: "ボタン" })).document;
  const definition = base.components[0];
  const textId = definition.node.children[0].id;
  const withInstance = success(createInstance(base, { componentRef: definition.id, x: 0, y: 0 })).document;
  const instanceId = withInstance.children[1].id;

  const overridden = success(setInstanceOverride(withInstance, instanceId, textId, { content: "変更後" }));
  const root = resolveDocumentInstances(overridden).children[1] as FrameNode;
  assert.equal((root.children[0] as TextNode).content, "変更後");

  const reset = success(resetInstanceOverride(overridden, instanceId, textId));
  const resetRoot = resolveDocumentInstances(reset).children[1] as FrameNode;
  assert.equal((resetRoot.children[0] as TextNode).content, "元");
});

test("オーバーライド設定は不正な対象を拒否する", () => {
  const base = success(createComponent(document(frame({ id: "frame1", width: 200, height: 100 })), { sourceId: "frame1", name: "ボタン" })).document;
  const definitionId = base.components[0].id;
  const rootId = base.components[0].node.id;
  const withInstance = success(createInstance(base, { componentRef: definitionId, x: 0, y: 0 })).document;
  const instanceId = withInstance.children[1].id;
  assert.equal(setInstanceOverride(withInstance, instanceId, "missing", { content: "x" }).type, "Failure");
  assert.equal(setInstanceOverride(withInstance, instanceId, rootId, {}).type, "Failure");
  assert.equal(setInstanceOverride(withInstance, instanceId, rootId, { width: 0 }).type, "Failure");
  assert.equal(setInstanceOverride(withInstance, "missing", rootId, { content: "x" }).type, "Failure");
  assert.equal(resetInstanceOverride(withInstance, instanceId, "missing").type, "Failure");
});

test("インスタンスを切り離して通常の要素にする", () => {
  const source = frame({ id: "frame1", width: 200, height: 100, children: [text({ id: "t1", content: "ラベル" })] });
  const base = success(createComponent(document(source), { sourceId: "frame1", name: "ボタン" })).document;
  const definition = base.components[0];
  const textId = definition.node.children[0].id;
  const withInstance = success(createInstance(base, { componentRef: definition.id, x: 10, y: 20 })).document;
  const instanceId = withInstance.children[1].id;
  const overridden = success(setInstanceOverride(withInstance, instanceId, textId, { content: "変更後" }));

  const detached = success(detachInstance(overridden, instanceId));
  assert.equal(detached.node.type, "frame");
  assert.notEqual(detached.node.id, instanceId);
  const frameNode = detached.node as FrameNode;
  assert.equal(frameNode.x, 10);
  assert.equal(frameNode.y, 20);
  assert.equal((frameNode.children[0] as TextNode).content, "変更後");
  assert.equal(detached.document.children[1].type, "frame");
  assert.equal(detached.document.components.length, 1);

  const ids = new Set<string>();
  function collect(nodes: DocumentNode[]): void {
    for (const node of nodes) {
      assert.ok(!ids.has(node.id), `ID が重複しています: ${node.id}`);
      ids.add(node.id);
      if (node.type === "frame") collect(node.children);
    }
  }
  collect(detached.document.children);
  collect([detached.document.components[0].node]);
});

test("使用中のコンポーネントは削除を拒否し、未使用なら削除できる", () => {
  const base = success(createComponent(document(frame({ id: "frame1", width: 200, height: 100 })), { sourceId: "frame1", name: "ボタン" })).document;
  const definitionId = base.components[0].id;
  const withInstance = success(createInstance(base, { componentRef: definitionId, x: 0, y: 0 })).document;
  assert.equal(removeComponent(withInstance, definitionId).type, "Failure");

  const detached = success(detachInstance(withInstance, withInstance.children[1].id)).document;
  const removed = success(removeComponent(detached, definitionId));
  assert.equal(removed.components.length, 0);
});

test("インスタンスの複製は同じ定義を参照する別インスタンスになる", () => {
  const base = success(createComponent(document(frame({ id: "frame1", width: 200, height: 100 })), { sourceId: "frame1", name: "ボタン" })).document;
  const definitionId = base.components[0].id;
  const withInstance = success(createInstance(base, { componentRef: definitionId, x: 0, y: 0 })).document;
  const duplicated = success(duplicateNode(withInstance, withInstance.children[1].id));
  assert.notEqual(duplicated.node.id, withInstance.children[1].id);
  assert.equal(duplicated.node.type, "instance");
  assert.equal(duplicated.node.type === "instance" ? duplicated.node.componentRef : "", definitionId);
});
