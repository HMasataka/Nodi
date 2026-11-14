import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { PathPointEditor } from "../src/pages/editor/components/molecules/PathPointEditor/PathPointEditor.tsx";
import { setPath } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { composeTransform, invertTransform, nodeTransform, transformPoint } from "../src/document/transform.ts";
import { deletePathPoint, insertPathPoint, movePathPoint, togglePathCurve } from "../src/document/pathEdit.ts";
import { document, frame, path, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

const line = [{ kind: "move" as const, x: 0, y: 0 }, { kind: "line" as const, x: 1, y: 0 }, { kind: "line" as const, x: 1, y: 1 }];

test("点の挿入・削除・直線と曲線の切り替えが開路／閉路の制約を保つ", () => {
  const curved = togglePathCurve(line, 1);
  assert.equal(curved?.[1].kind, "cubic");
  if (!curved || curved[1].kind !== "cubic") assert.fail("曲線へ変換できません");
  assert.deepEqual([curved[1].x1, curved[1].x2], [1 / 3, 2 / 3]);
  const split = insertPathPoint(curved, 1);
  assert.ok(split);
  assert.equal(split[1].kind, "cubic");
  assert.equal(split[2].kind, "cubic");
  if (split[1].kind !== "cubic" || split[2].kind !== "cubic") assert.fail("曲線が消えました");
  assert.deepEqual([split[1].x, split[2].x], [0.5, 1]);
  assert.deepEqual(togglePathCurve(curved, 1), line);
  assert.deepEqual(deletePathPoint(line, 1), [line[0], line[2]]);
  assert.deepEqual(deletePathPoint(line, 0), [{ kind: "move", x: 1, y: 0 }, line[2]]);
  const closed = [...line, { kind: "close" as const }];
  assert.equal(deletePathPoint(closed, 1), null);
  assert.equal(insertPathPoint(closed, 3)?.[3].kind, "line");
  const multiple = [...closed, { kind: "move" as const, x: 0, y: 0.5 },
    { kind: "line" as const, x: 1, y: 0.5 }, { kind: "line" as const, x: 1, y: 0.9 }];
  assert.deepEqual(deletePathPoint(multiple, 4)?.[4], { kind: "move", x: 1, y: 0.5 });
});

test("アンカー移動は隣接ハンドルを保ち、回転した親の座標から逆変換できる", () => {
  const commands = [line[0], { kind: "cubic" as const, x1: 0.25, y1: 0, x2: 0.75, y2: 0, x: 1, y: 0 },
    { kind: "cubic" as const, x1: 1, y1: 0.25, x2: 1, y2: 0.75, x: 1, y: 1 }];
  const moved = movePathPoint(commands, 1, "anchor", { x: 0.8, y: 0.2 });
  assert.ok(moved);
  assert.equal(moved[1].kind, "cubic");
  assert.equal(moved[2].kind, "cubic");
  if (moved[1].kind !== "cubic" || moved[2].kind !== "cubic") assert.fail("曲線が消えました");
  assert.deepEqual([moved[1].x2, moved[1].y2, moved[2].x1, moved[2].y1], [0.55, 0.2, 0.8, 0.45]);
  const handle = movePathPoint(moved, 2, "in", { x: 1.2, y: -0.3 });
  assert.equal(handle?.[2].kind, "cubic");
  if (handle?.[2].kind !== "cubic") assert.fail("ハンドルが消えました");
  assert.deepEqual([handle[2].x1, handle[2].y1], [1.2, -0.3]);
  assert.equal(movePathPoint(commands, 1, "anchor", { x: NaN, y: 0 }), null);
  const parent = frame({ x: 80, y: 30, width: 200, height: 150, rotation: 45 });
  const node = path({ x: 20, y: 30, width: 100, height: 50, rotation: 30 });
  const world = composeTransform(nodeTransform(parent), nodeTransform(node));
  const point = { x: 80, y: 20 };
  const screen = transformPoint(world, point);
  const local = transformPoint(invertTransform(world), screen);
  assert.ok(Math.abs(local.x - point.x) < 1e-9 && Math.abs(local.y - point.y) < 1e-9);
});

test("点編集のUIと保存は開いた／複合パスに追従し、操作ハンドルは未選択時に出ない", () => {
  const node = path({ commands: [...line, { kind: "close" },
    { kind: "move", x: 0.2, y: 0.2 }, { kind: "cubic", x1: 0.3, y1: 0, x2: 0.7, y2: 0, x: 0.8, y: 0.2 },
    { kind: "line", x: 0.5, y: 0.8 }, { kind: "close" }], fillRule: "evenodd" });
  const noOp = () => {};
  const interaction = { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp,
    onNodePointerUp: noOp, onImageError: noOp, onPathPointPointerDown: noOp };
  const selected = renderToStaticMarkup(<CanvasNode node={node} selectedId={node.id} interaction={interaction} zoom={2} />);
  assert.match(selected, /class="path-controls"/);
  assert.match(selected, /data-path-control="anchor-0"/);
  assert.match(selected, /data-path-control="in-5"/);
  assert.doesNotMatch(renderToStaticMarkup(<CanvasNode node={node} selectedId={null} interaction={interaction} />), /path-controls/);
  const editor = renderToStaticMarkup(<PathPointEditor node={node} onChange={noOp} />);
  assert.match(editor, /中間点/);
  assert.match(editor, /直線へ/);
  const initial = document(frame({ children: [node] }));
  const commands = insertPathPoint(node.commands, 5);
  assert.ok(commands);
  const updated = success(setPath(initial, node.id, { commands }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(updated)))), updated);
  const history = commit(createHistory(initial), updated);
  assert.deepEqual(undo(history).present, initial);
  assert.deepEqual(redo(undo(history)).present, updated);
});
