import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { addNode } from "../src/document/commands/create.ts";
import { CanvasNode } from "../src/pages/editor/components/molecules/CanvasNode/CanvasNode.tsx";
import { createAgentApi } from "../src/agent/api.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { vectorPathIssue } from "../src/document/vectorPath.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, frame, path, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { setNodeStyle, setPath } from "../src/document/commands/index.ts";

const outline = [
  { kind: "move" as const, x: 0, y: 0 },
  { kind: "cubic" as const, x1: 0, y1: -0.2, x2: 1, y2: 0.2, x: 1, y: 0 },
  { kind: "line" as const, x: 1, y: 1 },
  { kind: "line" as const, x: 0, y: 1 },
  { kind: "close" as const },
  { kind: "move" as const, x: 0.25, y: 0.25 },
  { kind: "line" as const, x: 0.75, y: 0.25 },
  { kind: "line" as const, x: 0.5, y: 0.75 },
  { kind: "close" as const },
];

test("開路・複合閉路と曲線を作成・更新し、保存・履歴・MCPで保持する", () => {
  const initial = document(frame());
  const open = success(addNode(initial, { type: "path", parentId: "frame", x: 10, y: 12, width: 80, height: 60,
    commands: [{ kind: "move", x: 0, y: 0 }, { kind: "line", x: 1, y: 1 }] }));
  assert.equal(open.node.type, "path");
  if (open.node.type !== "path") assert.fail("パスを作成できません");
  assert.deepEqual(open.node.style, { fill: null, stroke: { color: "#24383a", width: 2 } });
  const edited = success(setPath(open.document, open.node.id, { commands: outline, fillRule: "evenodd" }));
  const colored = success(setNodeStyle(edited, open.node.id, { fill: "#12345680", stroke: { color: "#fedcba", width: 3 } }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(colored)))), colored);
  assert.deepEqual(undo(commit(createHistory(initial), colored)).present, initial);
  assert.deepEqual(redo(undo(commit(createHistory(initial), colored))).present, colored);
  assert.equal(setPath(colored, open.node.id, { commands: outline, fillRule: "evenodd" }).type, "Success");
  assert.equal(setNodeStyle(colored, open.node.id, { cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 } }).type, "Failure");
  let current = initial;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null,
    apply(next) { current = next; } });
  const created = dispatchAgentRequest(api, "add_element", { type: "path", parentId: "frame", x: 10, y: 10, width: 80, height: 60, commands: outline });
  assert.equal(created.ok, true);
  const id = current.children[0].type === "frame" ? current.children[0].children[0].id : "";
  assert.equal(dispatchAgentRequest(api, "set_path", { id, fillRule: "evenodd" }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_shape_style", { id, fill: "#abcdef" }).ok, true);
  assert.equal(dispatchAgentRequest(api, "get_element", { id }).ok, true);
});

test("不正なパス命令をWire・コマンドで拒否する", () => {
  const cases = [[], [{ kind: "line", x: 0, y: 0 }, { kind: "line", x: 1, y: 1 }],
    [{ kind: "move", x: 0, y: 0 }, { kind: "move", x: 0, y: 1 }, { kind: "line", x: 1, y: 1 }],
    [{ kind: "move", x: 0, y: 0 }, { kind: "line", x: 1, y: 1 }, { kind: "close" }],
    [{ kind: "move", x: 0, y: 0 }, { kind: "line", x: Infinity, y: 1 }],
    [{ kind: "move", x: 0, y: 0 }, { kind: "cubic", x1: NaN, y1: 0, x2: 1, y2: 1, x: 1, y: 1 }],
  ];
  for (const commands of cases) {
    assert.notEqual(vectorPathIssue(commands, "nonzero"), null);
    assert.equal(addNode(document(), { type: "path", x: 0, y: 0, width: 20, height: 20, commands: commands as typeof outline }).type, "Failure");
    assert.equal(parseDocument(JSON.stringify(document(path({ commands: commands as typeof outline })))).type, "Failure");
  }
  assert.equal(vectorPathIssue(outline, "unknown"), "塗り規則が不正です");
});

test("SVGとPNGは同じローカル座標・ベジェ・evenoddを描く", async () => {
  const node = path({ width: 100, height: 50, commands: outline, fillRule: "evenodd", style: { fill: "#12345680" }, rotation: 30 });
  const noOp = () => {};
  const markup = renderToStaticMarkup(<CanvasNode node={node} selectedId={null}
    interaction={{ onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp }} />);
  assert.match(markup, /fill-rule="evenodd"/);
  assert.match(markup, /C 0 -10 100 10 100 0/);
  assert.match(markup, /M 25 12.5 L 75 12.5 L 50 37.5 Z/);
  const calls: unknown[][] = [];
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, rect() {}, clip() {},
    moveTo(...args: number[]) { calls.push(["M", ...args]); }, lineTo(...args: number[]) { calls.push(["L", ...args]); },
    bezierCurveTo(...args: number[]) { calls.push(["C", ...args]); }, closePath() { calls.push(["Z"]); },
    fillStyle: "", strokeStyle: "", fill(rule: string) { calls.push(["fill", rule, this.fillStyle]); }, stroke() { calls.push(["stroke", this.strokeStyle]); } };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) };
  success(await renderFramePng(frame({ children: [node] }), { createCanvas: () => canvas as unknown as HTMLCanvasElement,
    loadImage: async () => ({}) as HTMLImageElement }));
  assert.ok(calls.some((call) => call[0] === "C" && call[2] === -10 && call[4] === 10));
  assert.ok(calls.some((call) => call[0] === "fill" && call[1] === "evenodd" && call[2] === "#12345680"));
});
