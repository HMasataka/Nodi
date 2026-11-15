import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "vitest";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { createAgentApi } from "../src/agent/api.ts";
import { createNodiRequest } from "../scripts/nodi-instances.ts";
import { commit, createHistory, isDirty } from "../src/document/history.ts";
import { createDocumentSession, dispatchSessionRequest } from "../src/agent/sessionBridge.ts";
import { document, rectangle } from "./support/factories.ts";

async function startInstance(directory: string, name: string, port = 0) {
  const instanceId = randomUUID();
  const token = randomUUID();
  const session = createDocumentSession();
  session.replace(`/designs/${name}.nodi`);
  let history = createHistory(document(rectangle({ name })), true);
  let ready = true;
  let replaceBeforeDispatch = false;
  let beforeProbe: (() => Promise<void>) | undefined;
  const api = createAgentApi({ getDocument: () => history.present, getHistory: () => history, getSelectedId: () => null,
    apply(next) { history = commit(history, next); } });
  const requests: string[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    response.setHeader("Content-Type", "application/json");
    if (request.headers["x-nodi-token"] !== token || payload.instanceId !== instanceId) {
      response.writeHead(403).end(JSON.stringify({ ok: false, error: "接続先が一致しません" }));
      return;
    }
    requests.push(payload.method);
    if (payload.method === "get_instance_info") await beforeProbe?.();
    if (replaceBeforeDispatch && payload.method !== "get_instance_info") {
      session.replace(`/designs/${name}.nodi`);
      replaceBeforeDispatch = false;
    }
    const result = dispatchSessionRequest(api, session.info(ready), payload);
    if (payload.method === "get_instance_info" && result.ok) result.data = { ...result.data, instanceId, pid: process.pid };
    response.end(JSON.stringify(result));
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const actualPort = (server.address() as { port: number }).port;
  const file = join(directory, `${instanceId}.json`);
  const registration = { instanceId, token, port: actualPort, pid: process.pid };
  await writeFile(file, JSON.stringify(registration));
  let stopped = false;
  return {
    instanceId, session, file, registration, requests,
    selection: () => ({ instanceId, documentSessionId: session.info().documentSessionId }),
    history: () => history,
    setReady: (value: boolean) => { ready = value; },
    changeOnNextRequest: () => { replaceBeforeDispatch = true; },
    setProbeHook: (hook: () => Promise<void>) => { beforeProbe = hook; },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("複数アプリを一覧・選択し、追加起動や別クライアントの選択で対象を変えない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nodi-instances-"));
  const first = await startInstance(directory, "first");
  const second = await startInstance(directory, "second");
  try {
    const clientA = createNodiRequest(directory);
    const clientB = createNodiRequest(directory);
    assert.equal((await clientA("rename_element", { id: "rectangle", name: "未選択" })).ok, false);
    const listed = await clientA("list_instances");
    assert.equal(listed.ok, true);
    const data = listed.data as { instances: { instanceId: string; filePath: string }[]; unavailable: number };
    assert.equal(data.instances.length, 2);
    assert.deepEqual(new Set(data.instances.map((item) => item.filePath)), new Set(["/designs/first.nodi", "/designs/second.nodi"]));
    assert.ok(!JSON.stringify(data).includes(first.registration.token));
    assert.ok(!JSON.stringify(data).includes('"port"'));
    assert.equal((await clientA("select_instance", first.selection())).ok, true);
    assert.equal((await clientB("select_instance", second.selection())).ok, true);
    const third = await startInstance(directory, "third");
    try {
      await clientA("list_instances");
      assert.equal((await clientA("rename_element", { id: "rectangle", name: "A" })).ok, true);
      assert.equal((await clientB("rename_element", { id: "rectangle", name: "B" })).ok, true);
      assert.equal(first.history().present.children[0].name, "A");
      assert.equal(second.history().present.children[0].name, "B");
      assert.equal(third.history().present.children[0].name, "third");
      // 登録ファイルを後で書き換えても、選択した接続情報は固定される。
      await writeFile(first.file, JSON.stringify({ ...third.registration, instanceId: first.instanceId }));
      assert.equal((await clientA("rename_element", { id: "rectangle", name: "still A" })).ok, true);
      assert.equal(first.history().present.children[0].name, "still A");
      assert.equal(third.history().present.children[0].name, "third");
    } finally { await third.stop(); }
  } finally {
    await first.stop(); await second.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("遅れて完了した選択要求が、新しく選んだアプリを上書きしない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nodi-select-race-"));
  const first = await startInstance(directory, "first");
  const second = await startInstance(directory, "second");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const probing = new Promise<void>((resolve) => { started = resolve; });
  first.setProbeHook(async () => { started(); await gate; });
  try {
    const request = createNodiRequest(directory);
    const older = request("select_instance", first.selection());
    await probing;
    assert.equal((await request("select_instance", second.selection())).ok, true);
    release();
    assert.equal((await older).ok, false);
    assert.equal((await request("rename_element", { id: "rectangle", name: "second only" })).ok, true);
    assert.equal(first.history().present.children[0].name, "first");
    assert.equal(second.history().present.children[0].name, "second only");
  } finally { release(); await first.stop(); await second.stop(); await rm(directory, { recursive: true, force: true }); }
});

test("送信中の文書切替をアプリ側で拒否し、明示的な再選択まで更新しない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nodi-session-"));
  const instance = await startInstance(directory, "same-path");
  try {
    const request = createNodiRequest(directory);
    const old = instance.selection();
    await request("select_instance", old);
    const before = instance.history();
    instance.changeOnNextRequest();
    const result = await request("rename_element", { id: "rectangle", name: "wrong" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "document_changed");
    assert.equal(instance.history(), before);
    assert.equal(isDirty(instance.history()), false);
    assert.equal((await request("get_state")).ok, false);
    assert.equal((await request("select_instance", old)).ok, false);
    assert.equal((await request("select_instance", instance.selection())).ok, true);
    instance.session.saved("/designs/renamed.nodi");
    assert.equal((await request("rename_element", { id: "rectangle", name: "valid" })).ok, true);
    assert.equal(instance.history().present.children[0].name, "valid");
  } finally { await instance.stop(); await rm(directory, { recursive: true, force: true }); }
});

test("終了済み・不正な登録を一覧から除き、終了や同じポートでの再起動時も別アプリへ送らない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nodi-dead-"));
  const first = await startInstance(directory, "first");
  const second = await startInstance(directory, "second");
  try {
    const request = createNodiRequest(directory);
    await request("select_instance", first.selection());
    await first.stop(); // 異常終了相当: 登録だけ残す。
    await writeFile(join(directory, `${randomUUID()}.json`), "invalid json");
    const listed = (await request("list_instances")).data as { instances: { instanceId: string }[]; unavailable: number };
    assert.deepEqual(listed.instances.map((item) => item.instanceId), [second.instanceId]);
    assert.equal(listed.unavailable, 2);
    assert.equal((await request("rename_element", { id: "rectangle", name: "wrong" })).ok, false);
    assert.equal(second.history().present.children[0].name, "second");
    const restarted = await startInstance(directory, "restarted", first.registration.port);
    try {
      assert.equal((await request("get_state")).ok, false);
      assert.equal((await request("select_instance", first.selection())).ok, false);
      assert.equal((await request("select_instance", restarted.selection())).ok, true);
      assert.equal((await request("rename_element", { id: "rectangle", name: "new" })).ok, true);
      assert.equal(restarted.history().present.children[0].name, "new");
    } finally { await restarted.stop(); }
  } finally { await first.stop(); await second.stop(); await rm(directory, { recursive: true, force: true }); }
});

test("復元確認中はメタデータのみ取得でき、保存では文書セッションを変えない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nodi-not-ready-"));
  const instance = await startInstance(directory, "recovering");
  try {
    instance.setReady(false);
    const request = createNodiRequest(directory);
    const listed = (await request("list_instances")).data as { instances: { ready: boolean }[] };
    assert.equal(listed.instances[0].ready, false);
    assert.equal((await request("select_instance", instance.selection())).ok, false);
    instance.setReady(true);
    assert.equal((await request("select_instance", instance.selection())).ok, true);
    const id = instance.session.info().documentSessionId;
    instance.session.saved("/designs/saved.nodi");
    assert.equal(instance.session.info().documentSessionId, id);
    assert.equal((await request("get_state")).ok, true);
    instance.session.replace(null); // 復元文書への置換。
    assert.notEqual(instance.session.info().documentSessionId, id);
    assert.equal(instance.session.info().filePath, null);
    assert.equal((await request("get_state")).ok, false);
  } finally { await instance.stop(); await rm(directory, { recursive: true, force: true }); }
});
