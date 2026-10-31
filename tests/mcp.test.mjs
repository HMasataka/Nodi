import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createAgentApi } from "../src/document/agent.ts";
import { dispatchAgentRequest } from "../src/document/agentBridge.ts";
import { createDocument } from "../src/document/commands.ts";
import { commit, createHistory, isDirty } from "../src/document/history.ts";

test("MCP クライアントから参照・追加・改名・移動でき、画面と同じ履歴に入る", { timeout: 20000 }, async () => {
  let history = createHistory(createDocument(), true);
  const api = createAgentApi({
    getDocument: () => history.present,
    getSelectedId: () => null,
    apply: (document) => { history = commit(history, document); },
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
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "add_element"));
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
    assert.equal(history.past.length, 7);
    assert.ok(isDirty(history));
  } finally {
    await client.close();
    await new Promise((done) => http.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
