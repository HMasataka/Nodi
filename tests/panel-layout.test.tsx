import assert from "node:assert/strict";
import { test } from "vitest";

import { readFile } from "node:fs/promises";

import { INITIAL_PANEL_LAYOUT, togglePanel, workspaceColumns } from "../src/pages/editor/panelLayout.ts";

test("左パネル 240px・キャンバス・右パネル 280px を並べ、閉じた列はキャンバスに譲る", () => {
  assert.equal(workspaceColumns({ left: true, right: true }), "240px minmax(0, 1fr) 280px");
  assert.equal(workspaceColumns({ left: false, right: true }), "minmax(0, 1fr) 280px");
  assert.equal(workspaceColumns({ left: true, right: false }), "240px minmax(0, 1fr)");
  assert.equal(workspaceColumns({ left: false, right: false }), "minmax(0, 1fr)");
});

test("左右のパネルとタイムラインを個別に開閉し、タイムラインは閉じて始める", () => {
  assert.deepEqual(INITIAL_PANEL_LAYOUT, { left: true, right: true, timeline: false });
  const initial = INITIAL_PANEL_LAYOUT;
  assert.deepEqual(togglePanel(initial, "left"), { left: false, right: true, timeline: false });
  assert.deepEqual(togglePanel(initial, "right"), { left: true, right: false, timeline: false });
  assert.deepEqual(togglePanel(initial, "timeline"), { left: true, right: true, timeline: true });
  assert.deepEqual(togglePanel(togglePanel(initial, "left"), "left"), initial);
});

test("パネルは画面の上端から下端まで伸ばし、タイムラインはキャンバスの列に置く", async () => {
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const center = page.slice(page.indexOf('<div className="editor-center">'), page.indexOf("{panels.layout.right && <Inspector"));
  for (const part of ["<Canvas", "<Timeline"]) assert.ok(center.includes(part), part);
  for (const removed of ["EditorToolbar", "EditorStatus"]) assert.ok(!page.includes(removed), removed);
  assert.match(center, /\{panels\.layout\.timeline && <Timeline /);
  assert.ok(page.indexOf("{panels.layout.left && <div className=\"left-panels\">") < page.indexOf('<div className="editor-center">'));
  // 開閉しても Canvas の位置が変わらず、選択やズームを持つ状態がアンマウントされない。
  assert.match(page, /\{panels\.layout\.left && <div className="left-panels">/);
  assert.match(page, /\{panels\.layout\.right && <Inspector/);
});
