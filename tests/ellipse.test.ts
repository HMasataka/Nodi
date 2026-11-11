import assert from "node:assert/strict";
import { test } from "vitest";

import { addNode, createDocument, findNode, setNodeGeometry, setNodeStyle } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { corners, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("フレーム内の楕円は編集・保存・Undo / Redo できる", () => {
  const frame = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 300, height: 200 }));
  const ellipse = success(addNode(frame.document, { type: "ellipse", parentId: frame.node.id, x: 20, y: 30, width: 40, height: 40 }));
  const styled = success(setNodeStyle(ellipse.document, ellipse.node.id, { fill: "#112233", stroke: { color: "#445566", width: 3 } }));
  const resized = success(setNodeGeometry(styled, ellipse.node.id, { x: 24, y: 32, width: 80, height: 50 }));
  assert.equal(findNode(resized, ellipse.node.id).style.fill, "#112233");
  assert.deepEqual(success(parseDocument(success(serializeDocument(resized)))), resized);
  const history = commit(createHistory(ellipse.document), resized);
  assert.equal(undo(history).present, ellipse.document);
  assert.equal(redo(undo(history)).present, resized);
});

test("楕円の不正な色・線幅・角丸と余分な保存項目を拒否する", () => {
  const ellipse = success(addNode(createDocument(), { type: "ellipse", x: 0, y: 0, width: 30, height: 30 }));
  assert.equal(ellipse.node.name, "楕円 1");
  assert.equal(setNodeStyle(ellipse.document, ellipse.node.id, { fill: "red" }).type, "Failure");
  assert.equal(setNodeStyle(ellipse.document, ellipse.node.id, { stroke: { color: "#000000", width: -1 } }).type, "Failure");
  assert.equal(setNodeStyle(ellipse.document, ellipse.node.id, { cornerRadii: corners(4) }).type, "Failure");
  const invalid = { ...ellipse.document, children: [{ ...ellipse.node, style: { ...ellipse.node.style, cornerRadii: corners(4) } }] };
  assert.equal(parseDocument(JSON.stringify(invalid)).type, "Failure");
});
