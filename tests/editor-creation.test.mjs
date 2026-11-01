import assert from "node:assert/strict";
import test from "node:test";

import { addNode, createDocument } from "../src/document/commands/index.ts";
import { creationInput, imageCreationInput } from "../src/pages/editor/creation.ts";

test("作成の初期位置・寸法は種類と選択フレームで決まり、文書を変更しない", () => {
  const document = createDocument();
  assert.deepEqual(creationInput("rectangle", document), { type: "rectangle", parentId: undefined, x: 80, y: 80, width: 184, height: 112 });
  assert.deepEqual(creationInput("ellipse", document), { type: "ellipse", parentId: undefined, x: 80, y: 80, width: 112, height: 112 });
  assert.deepEqual(creationInput("text", document), { type: "text", parentId: undefined, x: 80, y: 80, content: "テキスト", width: 220, height: 48 });
  assert.deepEqual(creationInput("frame", document), { type: "frame", x: 80, y: 80, width: 360, height: 260 });

  const frame = addNode(document, creationInput("frame", document));
  assert.equal(frame.type, "Success");
  const nested = creationInput("rectangle", frame.value.document, frame.value.node);
  assert.deepEqual(nested, { type: "rectangle", parentId: frame.value.node.id, x: 24, y: 50, width: 184, height: 112 });
  assert.deepEqual(creationInput("frame", frame.value.document, frame.value.node), { type: "frame", x: 108, y: 108, width: 360, height: 260 });
  assert.deepEqual(imageCreationInput(frame.value.document, frame.value.node, "風景.png", "data:image/png;base64,aGVsbG8="), {
    type: "image", source: "data:image/png;base64,aGVsbG8=", name: "風景", parentId: frame.value.node.id,
    x: 24, y: 50, width: 240, height: 160,
  });
  assert.equal(document.children.length, 0);
});
