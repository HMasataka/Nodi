import assert from "node:assert/strict";
import { test } from "vitest";

import { readFile } from "node:fs/promises";

import { togglePanel, workspaceColumns } from "../src/pages/editor/panelLayout.ts";

test("左パネル 240px・キャンバス・右パネル 280px を並べ、閉じた列はキャンバスに譲る", () => {
  assert.equal(workspaceColumns({ left: true, right: true }), "240px minmax(0, 1fr) 280px");
  assert.equal(workspaceColumns({ left: false, right: true }), "minmax(0, 1fr) 280px");
  assert.equal(workspaceColumns({ left: true, right: false }), "240px minmax(0, 1fr)");
  assert.equal(workspaceColumns({ left: false, right: false }), "minmax(0, 1fr)");
});

test("左右のパネルを個別に開閉する", () => {
  const both = { left: true, right: true };
  assert.deepEqual(togglePanel(both, "left"), { left: false, right: true });
  assert.deepEqual(togglePanel(both, "right"), { left: true, right: false });
  assert.deepEqual(togglePanel(togglePanel(both, "left"), "left"), both);
});

test("パネルは画面の上端から下端まで伸ばし、ツールバー・タイムライン・状態表示はキャンバスの列に置く", async () => {
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const center = page.slice(page.indexOf('<div className="editor-center">'), page.indexOf("{panels.layout.right && <Inspector"));
  for (const part of ["<EditorToolbar", "<Canvas", "<Timeline", "<EditorStatus"]) assert.ok(center.includes(part), part);
  assert.ok(page.indexOf("{panels.layout.left && <div className=\"left-panels\">") < page.indexOf('<div className="editor-center">'));
  // 開閉しても Canvas の位置が変わらず、選択やズームを持つ状態がアンマウントされない。
  assert.match(page, /\{panels\.layout\.left && <div className="left-panels">/);
  assert.match(page, /\{panels\.layout\.right && <Inspector/);
});
