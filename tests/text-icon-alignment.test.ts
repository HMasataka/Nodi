import assert from "node:assert/strict";
import { test } from "vitest";

import { addNode, alignTextIcon, createDocument, measureTextIconAlignment, setFrameLayout, setRotation } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, frame, image, path, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("行高と2pxの内側余白で測り、アイコンだけを動かす", () => {
  const label = text({ id: "label", x: 10, y: 20, width: 200, height: 48, content: "設定", style: { fontSize: 20, lineHeight: 1.5 } });
  const icon = rectangle({ id: "icon", x: 230, y: 40, width: 20, height: 20 });
  const original = document(label, icon);
  const before = success(measureTextIconAlignment(original, [icon.id, label.id]));
  assert.equal(before.textY, 37);
  assert.equal(before.iconY, 50);
  const aligned = success(alignTextIcon(original, [icon.id, label.id]));
  assert.equal(aligned.children[0], label);
  assert.equal(aligned.children[1].y, 27);
  assert.equal(success(measureTextIconAlignment(aligned, [label.id, icon.id])).offset, 0);
  assert.equal(success(alignTextIcon(aligned, [label.id, icon.id])), aligned);
  assert.deepEqual(success(parseDocument(success(serializeDocument(aligned)))), aligned);
  const history = commit(createHistory(original, true), aligned);
  assert.equal(undo(history).present, original);
  assert.equal(redo(undo(history)).present, aligned);
});

test("回転した親・文字・画像・パスでも画面上の中心を合わせて親ローカル座標へ戻す", () => {
  const parent = frame({ id: "parent", x: 100, y: 80, width: 400, height: 250, rotation: 25,
    children: [text({ id: "label", x: 10, y: 20, width: 150, height: 44, content: "Search", rotation: -12 }),
      image({ id: "image", x: 180, y: 50, width: 32, height: 32, rotation: 35 })] });
  const original = document(parent);
  const before = success(measureTextIconAlignment(original, ["label", "image"]));
  const aligned = success(alignTextIcon(original, ["label", "image"]));
  const after = success(measureTextIconAlignment(aligned, ["label", "image"]));
  assert.ok(Math.abs(after.offset) < 1e-9);
  assert.equal(after.textY, before.textY);
  assert.notEqual(aligned.children[0].type === "frame" && aligned.children[0].children[1].x, 180);
  const pathDesign = document(text({ id: "label", x: 0, y: 0, content: "Path", height: 44 }), path({ id: "icon", x: 220, y: 50, width: 25, height: 100,
    commands: [{ kind: "move", x: 0.2, y: 0.1 }, { kind: "line", x: 0.8, y: 0.1 }, { kind: "line", x: 0.5, y: 0.4 }, { kind: "close" }] }));
  assert.equal(success(measureTextIconAlignment(pathDesign, ["label", "icon"])).iconY, 75);
  assert.ok(Math.abs(success(measureTextIconAlignment(success(alignTextIcon(pathDesign, ["label", "icon"])), ["label", "icon"])).offset) < 1e-9);
});

test("複数行・自動レイアウト・別の親・非アイコン・欠損IDは文書を変えずに拒否する", () => {
  const label = text({ id: "label", content: "A\nB", height: 80 });
  const icon = rectangle({ id: "icon" });
  assert.equal(alignTextIcon(document(label, icon), ["label", "icon"]).type, "Failure");
  assert.equal(alignTextIcon(document(text({ id: "label", width: 8 }), icon), ["label", "icon"]).type, "Failure");
  assert.equal(alignTextIcon(document(text({ id: "label" }), icon), ["label", "missing"]).type, "Failure");
  assert.equal(alignTextIcon(document(text({ id: "label" }), icon), ["label", "label"]).type, "Failure");
  assert.equal(alignTextIcon(document(text({ id: "label" }), text({ id: "other" })), ["label", "other"]).type, "Failure");
  const nested = document(frame({ id: "parent", children: [text({ id: "label" }), icon] }), rectangle({ id: "outside" }));
  assert.equal(alignTextIcon(nested, ["label", "outside"]).type, "Failure");
  const base = success(addNode(createDocument(), { type: "frame", x: 0, y: 0, width: 400, height: 200 }));
  const auto = success(setFrameLayout(base.document, base.node.id, { layoutMode: "horizontal" }));
  const textNode = success(addNode(auto, { type: "text", parentId: base.node.id, x: 0, y: 0, width: 150, height: 40, content: "Button" }));
  const iconNode = success(addNode(textNode.document, { type: "rectangle", parentId: base.node.id, x: 100, y: 0, width: 20, height: 20 }));
  assert.equal(alignTextIcon(iconNode.document, [textNode.node.id, iconNode.node.id]).type, "Failure");
  assert.equal(setRotation(iconNode.document, iconNode.node.id, 20).type, "Success");
});
