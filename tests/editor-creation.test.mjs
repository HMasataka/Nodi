import assert from "node:assert/strict";
import test from "node:test";

import { addNode, createDocument } from "../src/document/commands/index.ts";
import { creationInput, imageCreationInput } from "../src/pages/editor/creation.ts";

test("作成の初期位置・寸法は種類と選択フレームで決まり、文書を変更しない", () => {
  const document = createDocument();
  assert.deepEqual(creationInput("rectangle", document), { type: "rectangle", x: 80, y: 80, width: 184, height: 112 });
  assert.deepEqual(creationInput("ellipse", document), { type: "ellipse", x: 80, y: 80, width: 112, height: 112 });
  assert.deepEqual(creationInput("text", document), { type: "text", x: 80, y: 80, content: "テキスト", width: 220, height: 48 });
  assert.deepEqual(creationInput("frame", document), { type: "frame", x: 80, y: 80, width: 360, height: 260 });
  assert.deepEqual(imageCreationInput(document, undefined, "風景.png", "data:image/png;base64,aGVsbG8="), {
    type: "image", source: "data:image/png;base64,aGVsbG8=", name: "風景", x: 80, y: 80, width: 240, height: 160,
  });

  const frame = addNode(document, creationInput("frame", document));
  assert.equal(frame.type, "Success");
  const nested = creationInput("rectangle", frame.value.document, frame.value.node);
  assert.deepEqual(nested, { type: "rectangle", parentId: frame.value.node.id, x: 24, y: 50, width: 184, height: 112 });
  assert.deepEqual(creationInput("frame", frame.value.document, frame.value.node), { type: "frame", x: 108, y: 108, width: 360, height: 260 });
  const child = addNode(frame.value.document, nested);
  assert.equal(child.type, "Success");
  assert.deepEqual(creationInput("text", child.value.document, child.value.node), {
    type: "text", content: "テキスト", x: 108, y: 108, width: 220, height: 48,
  });
  assert.deepEqual(imageCreationInput(frame.value.document, frame.value.node, "風景.png", "data:image/png;base64,aGVsbG8="), {
    type: "image", source: "data:image/png;base64,aGVsbG8=", name: "風景", parentId: frame.value.node.id,
    x: 24, y: 50, width: 240, height: 160,
  });
  assert.equal(document.children.length, 0);
});

test("トップレベルのずらし幅は共通で、フレームだけ早く起点へ戻る", () => {
  let document = createDocument();
  for (let index = 0; index < 6; index++) {
    const added = addNode(document, creationInput("rectangle", document));
    assert.equal(added.type, "Success");
    document = added.value.document;
  }
  assert.deepEqual([creationInput("rectangle", document).x, creationInput("text", document).y,
    imageCreationInput(document, undefined, "photo.png", "data:image/png;base64,aGVsbG8=").x], [248, 248, 248]);
  assert.deepEqual([creationInput("frame", document).x, creationInput("frame", document).y], [80, 80]);

  for (let index = 0; index < 2; index++) {
    const added = addNode(document, creationInput("ellipse", document));
    assert.equal(added.type, "Success");
    document = added.value.document;
  }
  assert.equal(creationInput("rectangle", document).x, 80);
});
