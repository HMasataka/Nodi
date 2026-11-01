import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { absoluteGeometry } from "../src/pages/editor/geometry.ts";
import { createAgentApi } from "../src/agent/api.ts";
import { createDocument } from "../src/document/commands/index.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { canvasExtent, focusViewport } from "../src/pages/editor/viewport.ts";
import { commit, createHistory, isDirty, redo, undo } from "../src/document/history.ts";

test("MCP クライアントから編集と履歴の数値照会ができ、照会は履歴を変えない", { timeout: 20000 }, async () => {
  let history = createHistory(createDocument(), true);
  let selectedId = null;
  const api = createAgentApi({
    getDocument: () => history.present,
    getHistory: () => history,
    getSelectedId: () => selectedId,
    apply: (document) => { history = commit(history, document); },
    focus: (id) => {
      const absolute = absoluteGeometry(history.present, id);
      const extent = canvasExtent(history.present);
      const view = focusViewport(absolute, extent, { width: 240, height: 160 }, 1);
      selectedId = id;
      return { type: "Success", value: {
        absolute, ...view,
        screen: { x: (extent.originX + absolute.x) * view.zoom - view.scrollLeft, y: (extent.originY + absolute.y) * view.zoom - view.scrollTop, width: absolute.width * view.zoom, height: absolute.height * view.zoom },
      } };
    },
  });
  const http = createServer(async (request, response) => {
    assert.equal(request.headers["x-nodi-token"], "test-secret");
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const { method, args } = JSON.parse(Buffer.concat(chunks).toString());
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(dispatchAgentRequest(api, method, args)));
  });
  await new Promise((done) => http.listen(0, "127.0.0.1", done));
  const directory = await mkdtemp(join(tmpdir(), "nodi-mcp-"));
  const discovery = join(directory, "mcp-bridge.json");
  await writeFile(discovery, JSON.stringify({ port: http.address().port, token: "test-secret" }));
  const client = new Client({ name: "nodi-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("scripts/mcp-server.mjs")],
    env: { ...process.env, NODI_BRIDGE_FILE: discovery },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    assert.match(client.getInstructions(), /変更前と変更後の実画面スクリーンショット/);
    assert.match(client.getInstructions(), /数値とテスト/);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "add_element"));
    assert.match(tools.tools.find((tool) => tool.name === "add_element").description, /Before\/After/);
    for (const name of ["list_revisions", "get_revision_element", "compare_revisions", "measure_elements"]) {
      assert.ok(tools.tools.some((tool) => tool.name === name));
    }
    const initial = await client.callTool({ name: "list_revisions", arguments: {} });
    assert.equal(initial.isError, false);
    assert.deepEqual(JSON.parse(initial.content[0].text).revisions, [{
      id: history.presentRevisionId, parentId: null, isCurrent: true, isSaved: true,
    }]);
    assert.equal(isDirty(history), false);
    const added = await client.callTool({ name: "add_element", arguments: { type: "rectangle", name: "ボタン", x: 0, y: 0, width: 100, height: 40 } });
    assert.equal(added.isError, false);
    const element = JSON.parse(added.content[0].text);
    assert.equal(element.name, "ボタン");
    assert.ok(element.id.startsWith("nd_"));
    const state = await client.callTool({ name: "get_state", arguments: {} });
    assert.equal(JSON.parse(state.content[0].text).elements[0].id, element.id);
    const moved = await client.callTool({ name: "move_element", arguments: { id: element.id, x: 24, y: 32 } });
    assert.equal(JSON.parse(moved.content[0].text).x, 24);
    const renamed = await client.callTool({ name: "rename_element", arguments: { id: element.id, name: "送信" } });
    assert.equal(JSON.parse(renamed.content[0].text).path, "送信");
    const missing = await client.callTool({ name: "get_element", arguments: { id: "missing" } });
    assert.equal(missing.isError, true);
    const frame = await client.callTool({ name: "add_element", arguments: { type: "frame", name: "画面", x: 0, y: 0, width: 400, height: 300 } });
    const frameId = JSON.parse(frame.content[0].text).id;
    const addedText = await client.callTool({ name: "add_element", arguments: { type: "text", parentId: frameId, name: "見出し", content: "Hello", x: 10, y: 50, width: 200, height: 40 } });
    assert.equal(addedText.isError, false);
    const text = JSON.parse(addedText.content[0].text);
    assert.equal(text.path, "画面 › 見出し");
    assert.equal(text.content, "Hello");
    assert.equal(text.fontSize, 16);
    const updated = await client.callTool({ name: "set_text_content", arguments: { id: text.id, content: "Nodi" } });
    assert.equal(JSON.parse(updated.content[0].text).content, "Nodi");
    const invalid = await client.callTool({ name: "set_text_content", arguments: { id: frameId, content: "invalid" } });
    assert.equal(invalid.isError, true);
    const ellipse = await client.callTool({ name: "add_element", arguments: { type: "ellipse", name: "状態", x: 10, y: 10, width: 24, height: 24 } });
    assert.equal(ellipse.isError, false);
    const ellipseId = JSON.parse(ellipse.content[0].text).id;
    const ellipseRef = await client.callTool({ name: "get_element", arguments: { id: ellipseId } });
    assert.equal(JSON.parse(ellipseRef.content[0].text).type, "ellipse");
    assert.equal(JSON.parse(ellipseRef.content[0].text).fill, "#f3d9c8");
    const image = api.add({ type: "image", source: "data:image/png;base64,aGVsbG8=", x: 0, y: 0, width: 20, height: 20 });
    assert.equal(image.type, "Success");
    const imageRef = await client.callTool({ name: "get_element", arguments: { id: image.value.id } });
    assert.equal(JSON.parse(imageRef.content[0].text).source, "data:image/png;base64,aGVsbG8=");
    assert.equal(history.past.length, 8);
    assert.ok(isDirty(history));

    const beforeId = history.presentRevisionId;
    const before = await client.callTool({ name: "get_revision_element", arguments: { revisionId: beforeId, elementId: text.id } });
    assert.equal(before.isError, false);
    const measured = JSON.parse(before.content[0].text);
    assert.equal(measured.id, text.id);
    assert.equal(measured.name, "見出し");
    assert.equal(measured.path, "画面 › 見出し");
    assert.equal(measured.parentId, frameId);
    assert.deepEqual({ unit: measured.unit, localOrigin: measured.localOrigin, absoluteOrigin: measured.absoluteOrigin }, {
      unit: "px", localOrigin: "parent", absoluteOrigin: "document",
    });
    assert.deepEqual(measured.local, { x: 10, y: 50, width: 200, height: 40 });
    assert.deepEqual(measured.absolute, { x: 10, y: 50, width: 200, height: 40, left: 10, top: 50, right: 210, bottom: 90, centerX: 110, centerY: 70 });

    const frameMoved = await client.callTool({ name: "move_element", arguments: { id: frameId, x: 30, y: 40 } });
    assert.equal(frameMoved.isError, false);
    const afterId = history.presentRevisionId;
    const compared = await client.callTool({ name: "compare_revisions", arguments: { fromRevisionId: beforeId, toRevisionId: afterId, elementId: text.id } });
    assert.equal(compared.isError, false);
    const comparison = JSON.parse(compared.content[0].text);
    assert.equal(comparison.unit, "px");
    assert.equal(comparison.from.path, "画面 › 見出し");
    assert.equal(comparison.to.absolute.x, 40);
    assert.deepEqual(comparison.delta.local, { x: 0, y: 0, width: 0, height: 0 });
    assert.deepEqual(comparison.delta.absolute, { x: 30, y: 40, width: 0, height: 0, centerX: 30, centerY: 40 });

    const relative = await client.callTool({ name: "measure_elements", arguments: { revisionId: afterId, firstId: ellipseId, secondId: text.id } });
    assert.equal(relative.isError, false);
    const relation = JSON.parse(relative.content[0].text);
    assert.equal(relation.unit, "px");
    assert.equal(relation.absoluteOrigin, "document");
    assert.equal(relation.first.id, ellipseId);
    assert.equal(relation.second.path, "画面 › 見出し");
    assert.equal(relation.horizontal, "right");
    assert.equal(relation.vertical, "below");
    assert.deepEqual({ gapX: relation.gapX, gapY: relation.gapY, overlap: relation.overlap }, {
      gapX: 6, gapY: 56, overlap: { width: 0, height: 0, area: 0 },
    });

    const snapshot = history;
    const dirty = isDirty(history);
    const listed = await client.callTool({ name: "list_revisions", arguments: {} });
    const revisions = JSON.parse(listed.content[0].text).revisions;
    assert.equal(revisions.length, 10);
    assert.equal(revisions.at(-1).id, afterId);
    assert.equal(revisions.at(-1).parentId, beforeId);
    assert.equal(revisions.at(-1).isCurrent, true);
    assert.equal(revisions[0].isSaved, true);
    for (const [name, args] of [
      ["get_revision_element", { revisionId: "rev_missing", elementId: text.id }],
      ["get_revision_element", { revisionId: afterId, elementId: "missing" }],
      ["compare_revisions", { fromRevisionId: beforeId, toRevisionId: "rev_missing", elementId: text.id }],
      ["measure_elements", { revisionId: afterId, firstId: ellipseId, secondId: "missing" }],
      ["measure_elements", { revisionId: afterId, firstId: text.id, secondId: text.id }],
    ]) {
      const invalid = await client.callTool({ name, arguments: args });
      assert.equal(invalid.isError, true);
      assert.ok(JSON.parse(invalid.content[0].text).error);
    }
    const blank = await client.callTool({ name: "get_revision_element", arguments: { revisionId: "", elementId: text.id } });
    assert.equal(blank.isError, true);
    const unexpected = await client.callTool({ name: "list_revisions", arguments: { unexpected: true } });
    assert.equal(unexpected.isError, true);
    assert.equal(history, snapshot);
    assert.equal(isDirty(history), dirty);

    history = undo(history);
    const branched = await client.callTool({ name: "move_element", arguments: { id: frameId, x: -20, y: 0 } });
    assert.equal(branched.isError, false);
    const branchRevisions = JSON.parse((await client.callTool({ name: "list_revisions", arguments: {} })).content[0].text).revisions;
    assert.equal(branchRevisions.length, 11);
    assert.equal(branchRevisions.at(-1).parentId, beforeId);
    assert.equal(branchRevisions.find((item) => item.id === afterId).isCurrent, false);
    const oldBranch = await client.callTool({ name: "get_revision_element", arguments: { revisionId: afterId, elementId: text.id } });
    assert.equal(JSON.parse(oldBranch.content[0].text).absolute.x, 40);

    assert.ok(tools.tools.some((tool) => tool.name === "select_element"));
    const sibling = await client.callTool({ name: "add_element", arguments: { type: "text", parentId: frameId, name: "見出し", content: "同名", x: 100, y: 90, width: 300, height: 50 } });
    const siblingId = JSON.parse(sibling.content[0].text).id;
    const beforeSelection = history;
    const dirtyBeforeSelection = isDirty(history);
    const focused = await client.callTool({ name: "select_element", arguments: { id: siblingId } });
    assert.equal(focused.isError, false);
    const selected = JSON.parse(focused.content[0].text);
    assert.equal(selected.id, siblingId);
    assert.equal(selected.name, "見出し");
    assert.equal(selected.path, "画面 › 見出し");
    assert.equal(selected.parentId, frameId);
    assert.equal(selected.unit, "px");
    assert.equal(selected.absoluteOrigin, "document");
    assert.deepEqual(selected.absolute, { x: 80, y: 90, width: 300, height: 50 });
    assert.ok(selected.zoom < 1);
    assert.ok(selected.screen.x >= 0 && selected.screen.x + selected.screen.width <= 240);
    assert.ok(selected.screen.y >= 0 && selected.screen.y + selected.screen.height <= 160);
    assert.equal(JSON.parse((await client.callTool({ name: "get_state", arguments: {} })).content[0].text).selected.id, siblingId);
    assert.equal(history, beforeSelection);
    assert.equal(isDirty(history), dirtyBeforeSelection);
    const missingSelection = await client.callTool({ name: "select_element", arguments: { id: "missing" } });
    assert.equal(missingSelection.isError, true);
    assert.equal(selectedId, siblingId);
    assert.equal(history, beforeSelection);

    for (const name of ["set_element_geometry", "set_shape_style", "set_frame_style", "set_text_style", "delete_element", "duplicate_element"]) {
      assert.ok(tools.tools.some((tool) => tool.name === name));
      assert.match(tools.tools.find((tool) => tool.name === name).description, /Before\/After/);
    }
    const beforeEditCount = history.past.length;
    const geometryChanged = await client.callTool({ name: "set_element_geometry", arguments: { id: siblingId, x: 120, y: 110, width: 320, height: 70 } });
    assert.equal(geometryChanged.isError, false);
    assert.equal(JSON.parse(geometryChanged.content[0].text).width, 320);
    assert.equal(history.past.length, beforeEditCount + 1);
    assert.equal(undo(history).present.children.find((node) => node.id === frameId).children.find((node) => node.id === siblingId).width, 300);
    const shapeChanged = await client.callTool({ name: "set_shape_style", arguments: { id: element.id, fill: "#123456", cornerRadius: 8 } });
    assert.equal(JSON.parse(shapeChanged.content[0].text).fill, "#123456");
    const frameChanged = await client.callTool({ name: "set_frame_style", arguments: { id: frameId, background: "#abcdef", clipContent: false } });
    assert.equal(JSON.parse(frameChanged.content[0].text).clipContent, false);
    const textChanged = await client.callTool({ name: "set_text_style", arguments: { id: text.id, fontSize: 24, color: "#654321", textAlign: "center" } });
    assert.equal(JSON.parse(textChanged.content[0].text).fontSize, 24);
    const beforeInvalid = history;
    for (const [name, args] of [
      ["set_element_geometry", { id: siblingId, x: 0, y: 0, width: -1, height: 20 }],
      ["set_shape_style", { id: element.id, strokeWidth: -1 }],
      ["set_shape_style", { id: element.id }],
      ["set_text_style", { id: frameId, fontSize: 12 }],
      ["set_frame_style", { id: "missing", clipContent: true }],
      ["delete_element", { id: "missing" }],
    ]) {
      assert.equal((await client.callTool({ name, arguments: args })).isError, true);
    }
    assert.equal(history, beforeInvalid);

    const duplicated = await client.callTool({ name: "duplicate_element", arguments: { id: frameId } });
    assert.equal(duplicated.isError, false);
    const copyId = JSON.parse(duplicated.content[0].text).id;
    const frames = history.present.children.filter((node) => node.type === "frame");
    const originalFrame = frames.find((node) => node.id === frameId);
    const copiedFrame = frames.find((node) => node.id === copyId);
    assert.ok(copiedFrame);
    assert.deepEqual(copiedFrame.children.map((node) => node.name), originalFrame.children.map((node) => node.name));
    assert.ok(copiedFrame.children.every((node, index) => node.id !== originalFrame.children[index].id));
    const deleted = await client.callTool({ name: "delete_element", arguments: { id: frameId } });
    assert.equal(JSON.parse(deleted.content[0].text).deleted, true);
    assert.ok(!history.present.children.some((node) => node.id === frameId));
    assert.ok(isDirty(history));
    history = undo(history);
    assert.ok(history.present.children.some((node) => node.id === frameId));
    history = redo(history);
    assert.ok(!history.present.children.some((node) => node.id === frameId));
  } finally {
    await client.close();
    await new Promise((done) => http.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
