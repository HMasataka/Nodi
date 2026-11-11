import assert from "node:assert/strict";
import { test } from "vitest";

import { document, frame, image, rectangle, success, text } from "./support/factories.ts";
import { documentSchema, internalDocumentSchema, parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("Wire の省略値は内部モデルで必須となり、マスク false は保存時だけ省略する", () => {
  const wire = { version: 1, children: [
    { id: "rect", name: "矩形", type: "rectangle", x: 0, y: 0, width: 40, height: 30, style: { fill: "#ffffff" } },
    { id: "image", name: "画像", type: "image", x: 0, y: 0, width: 40, height: 30,
      source: "data:image/png;base64,aGVsbG8=", style: {} },
  ] };
  assert.equal(documentSchema.safeParse(wire).success, true);
  assert.equal(internalDocumentSchema.safeParse(wire).success, false);
  const normalized = success(parseDocument(JSON.stringify(wire)));
  assert.equal(internalDocumentSchema.safeParse(normalized).success, true);
  assert.equal(documentSchema.safeParse(normalized).success, false);
  assert.equal(normalized.children[0].isMask, false);
  assert.deepEqual(JSON.parse(success(serializeDocument(normalized))), wire);
  assert.equal(parseDocument(JSON.stringify({ ...wire, children: [{ ...wire.children[0], isMask: false }] })).type, "Failure");
});

test("内部モデルの欠落・未知項目・不正な子孫は省略値で隠さず保存を拒否する", () => {
  const original = document(frame({ children: [rectangle({ id: "rect" }), text({ id: "text" }), image({ id: "image" })] }));
  const root = original.children[0];
  if (root.type !== "frame") assert.fail("フレームが必要です");
  const [box, label, picture] = root.children;
  const invalid = [
    { ...root, children: [{ ...box, isMask: undefined }, label, picture] },
    { ...root, children: [{ ...box, style: { ...box.style, border: undefined } }, label, picture] },
    { ...root, children: [box, { ...label, style: { ...label.style, fontFamily: undefined } }, picture] },
    { ...root, children: [box, label, { ...picture, style: { ...picture.style, filters: { brightness: 1 } } }] },
    { ...root, children: [box, label, { ...picture, style: { ...picture.style, unknown: 1 } }] },
    { ...root, children: undefined },
  ];
  for (const node of invalid) assert.equal(serializeDocument({ version: 1, children: [node] }).type, "Failure");
});

test("保存時の角度正規化は入力を変えずに Wire だけを正規化する", () => {
  const original = document(rectangle({ rotation: 360 }), rectangle({ id: "negative", rotation: -45, isMask: true }));
  const before = structuredClone(original);
  const wire = JSON.parse(success(serializeDocument(original)));
  assert.equal(Object.hasOwn(wire.children[0], "rotation"), false);
  assert.equal(wire.children[1].rotation, 315);
  assert.equal(wire.children[1].isMask, true);
  assert.deepEqual(original, before);
});
