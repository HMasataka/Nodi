import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { addNode } from "../src/document/commands/create.ts";
import { Canvas } from "../src/pages/editor/components/organisms/Canvas/Canvas.tsx";
import { FloatingTools } from "../src/pages/editor/components/molecules/FloatingTools/FloatingTools.tsx";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, frame, success } from "./support/factories.ts";
import { extendPen, finishPenInput, penLocalPoint } from "../src/pages/editor/pen.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const parent = { a: 0, b: 1, c: -1, d: 0, e: 100, f: 50 };
const initial = { points: [{ x: 10, y: 20 }], cursor: { x: 10, y: 20 }, parentId: "frame", parentTransform: parent };

test("ペンの点追加・重複防止・閉路判定はズームと親の回転に追従する", () => {
  assert.deepEqual(penLocalPoint({ x: 80, y: 60 }, parent), { x: 10, y: 20 });
  assert.equal(finishPenInput(initial, false), null);
  const second = extendPen(initial, { x: 90, y: 20 }, 1);
  assert.equal(second.kind, "append");
  if (second.kind !== "append") assert.fail("点を追加できません");
  assert.equal(extendPen(second.draft, { x: 90.5, y: 20 }, 1).kind, "ignore");
  assert.equal(extendPen(second.draft, { x: 10, y: 20 }, 1).kind, "ignore");
  const third = extendPen(second.draft, { x: 60, y: 80 }, 1);
  assert.equal(third.kind, "append");
  if (third.kind !== "append") assert.fail("点を追加できません");
  assert.equal(extendPen(third.draft, { x: 13, y: 20 }, 1).kind, "close");
  assert.equal(extendPen(third.draft, { x: 13, y: 20 }, 4).kind, "append");
  const closed = finishPenInput(third.draft, true);
  assert.equal(closed?.commands[closed.commands.length - 1].kind, "close");
  assert.equal(extendPen({ ...third.draft, points: Array.from({ length: 2048 }, (_, x) => ({ x, y: x })) }, { x: 5000, y: 5000 }, 1).kind, "limit");
});

test("開路・閉路は一度の作成で保存でき、Undo/Redoできる", () => {
  const original = document(frame());
  const twoPoints = { ...initial, points: [initial.points[0], { x: 90, y: 20 }] };
  const openInput = finishPenInput(twoPoints, false);
  assert.ok(openInput);
  assert.deepEqual({ x: openInput.x, y: openInput.y, width: openInput.width, height: openInput.height }, { x: 10, y: 20, width: 80, height: 1 });
  const opened = success(addNode(original, openInput));
  assert.equal(opened.node.type, "path");
  const closedInput = finishPenInput({ ...twoPoints, points: [...twoPoints.points, { x: 50, y: 80 }] }, true);
  assert.ok(closedInput);
  const closed = success(addNode(opened.document, closedInput));
  assert.equal(closed.node.type, "path");
  assert.deepEqual(success(parseDocument(success(serializeDocument(closed.document)))), closed.document);
  const history = commit(createHistory(original), closed.document);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, closed.document);
  assert.equal(finishPenInput(twoPoints, true), null);
});

test("描画ツールと作画中の線・アンカーのプレビューを表示する", () => {
  const toolbar = renderToStaticMarkup(<FloatingTools drawTool="path" onDrawToolChange={() => {}} onImportImage={async () => {}} timelineOpen={false} onToggleTimeline={() => {}} />);
  assert.match(toolbar, /aria-label="ペン" title="ペン" aria-pressed="true"/);
  const noOp = () => {};
  const markup = renderToStaticMarkup(<Canvas design={document(frame())} selectedId={null} zoom={2} onZoom={noOp}
    drawTool="path" drawing={null} pen={{ ...initial, cursor: { x: 60, y: 80 } }}
    onPanPointerDown={noOp} onPanPointerMove={noOp} onPanPointerUp={noOp} onWorldPointerDown={noOp}
    onWorldDoubleClick={noOp} onWorldPointerMove={noOp} onWorldPointerUp={noOp} onWorldPointerCancel={noOp}
    onNodePointerDown={noOp} onNodePointerMove={noOp} onNodePointerUp={noOp} onResizePointerDown={noOp} onImageError={noOp} />);
  assert.match(markup, /class="pen-preview"/);
  assert.match(markup, /class="pen-path" points="80,60"/);
  assert.match(markup, /class="pen-next-segment" x1="80" y1="60" x2="20" y2="110"/);
  assert.match(markup, /class="path-anchor is-selected" x="78" y="58" width="4" height="4"/);
});
