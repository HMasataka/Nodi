import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { readdir, readFile } from "node:fs/promises";

const configDir = process.platform === "darwin" ? join(homedir(), "Library", "Application Support")
  : process.platform === "win32" ? process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
    : process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const defaultDirectory = process.env.NODI_INSTANCES_DIR ?? join(configDir, "com.hmasataka.nodi", "instances");

export const instanceInputs = {
  list_instances: z.strictObject({}),
  select_instance: z.strictObject({ instanceId: z.string().uuid(), documentSessionId: z.string().min(1) }),
};

const registrationSchema = z.strictObject({ instanceId: z.string().uuid(), pid: z.number().int().positive(),
  port: z.number().int().min(1).max(65535), token: z.string().min(1) });
const infoSchema = z.object({ instanceId: z.string().uuid(), pid: z.number().int().positive(),
  documentSessionId: z.string().min(1), filePath: z.string().nullable(), documentName: z.string(), ready: z.boolean() });
const responseSchema = z.object({ ok: z.boolean(), data: z.unknown().optional(), error: z.string().optional(), code: z.string().optional() });
type Registration = z.infer<typeof registrationSchema>;
type InstanceInfo = z.infer<typeof infoSchema>;
export type NodiBridgeResponse = z.infer<typeof responseSchema>;
export type NodiRequest = (method: string, args?: Record<string, unknown>) => Promise<NodiBridgeResponse>;
interface Selection { registration: Registration; documentSessionId: string }

async function send(registration: Registration, method: string, args: Record<string, unknown>, documentSessionId?: string, timeout = 16_000): Promise<NodiBridgeResponse> {
  const response = await fetch(`http://127.0.0.1:${registration.port}/`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Nodi-Token": registration.token },
    body: JSON.stringify({ instanceId: registration.instanceId, documentSessionId, method, args }),
    signal: AbortSignal.timeout(timeout),
  });
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) return { ok: false, code: "target_unavailable", error: "Nodiからの応答形式が不正です" };
  if (!response.ok) return { ok: false, code: "target_unavailable", error: parsed.data.error ?? `Nodiへの接続に失敗しました (${response.status})` };
  return parsed.data;
}

async function readRegistration(directory: string, instanceId: string): Promise<Registration | null> {
  try {
    const parsed = registrationSchema.safeParse(JSON.parse(await readFile(join(directory, `${instanceId}.json`), "utf8")));
    return parsed.success && parsed.data.instanceId === instanceId ? parsed.data : null;
  } catch { return null; }
}

async function probe(registration: Registration): Promise<InstanceInfo | null> {
  try {
    const response = await send(registration, "get_instance_info", {}, undefined, 2000);
    if (!response.ok) return null;
    const info = infoSchema.safeParse(response.data);
    return info.success && info.data.instanceId === registration.instanceId && info.data.pid === registration.pid ? info.data : null;
  } catch { return null; }
}

/** 接続先はMCPサーバー単位で保持する。別インスタンスへの自動選択・再送は行わない。 */
export function createNodiRequest(directory = defaultDirectory): NodiRequest {
  let selected: Selection | null = null;
  let selectionVersion = 0;
  return async (method, args = {}) => {
    if (method === "list_instances") {
      let files: string[];
      try { files = await readdir(directory); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ok: true, data: { instances: [], unavailable: 0 } };
        return { ok: false, error: "Nodiのインスタンス登録を読み取れません" };
      }
      const candidates = files.filter((file) => file.endsWith(".json"));
      const instances: InstanceInfo[] = [];
      // 応答のない登録が多くても同時接続数を制限する。残ったファイルは削除せず一覧から除く。
      for (let offset = 0; offset < candidates.length; offset += 8) {
        const batch = await Promise.all(candidates.slice(offset, offset + 8).map(async (file) => {
          const id = file.slice(0, -5);
          if (!z.string().uuid().safeParse(id).success) return null;
          const entry = await readRegistration(directory, id);
          return entry ? probe(entry) : null;
        }));
        for (const info of batch) if (info) instances.push(info);
      }
      instances.sort((a, b) => a.instanceId.localeCompare(b.instanceId));
      return { ok: true, data: { instances, unavailable: candidates.length - instances.length } };
    }
    if (method === "select_instance") {
      const version = ++selectionVersion;
      selected = null;
      const input = instanceInputs.select_instance.safeParse(args);
      if (!input.success) return { ok: false, error: "instanceIdとdocumentSessionIdを指定してください" };
      const entry = await readRegistration(directory, input.data.instanceId);
      const info = entry ? await probe(entry) : null;
      if (version !== selectionVersion) return { ok: false, error: "別の接続先選択が開始されました" };
      if (!entry || !info) return { ok: false, error: "対象のNodiに接続できません。list_instancesで確認してください" };
      if (info.documentSessionId !== input.data.documentSessionId) return { ok: false, error: "文書が切り替わりました。list_instancesで確認してください" };
      if (!info.ready) return { ok: false, error: "対象のNodiは復元データを確認中です" };
      selected = { registration: entry, documentSessionId: info.documentSessionId };
      return { ok: true, data: info };
    }
    const target = selected;
    if (!target) return { ok: false, error: "list_instancesで対象を確認し、select_instanceで選択してください" };
    try {
      // 登録ファイルを読み直さず、選択したポート・トークン・文書セッションへ送信する。
      const response = await send(target.registration, method, args, target.documentSessionId);
      if ((response.code === "document_changed" || response.code === "target_unavailable") && selected === target) selected = null;
      return response;
    } catch {
      if (selected === target) selected = null;
      return { ok: false, error: "対象のNodiから応答がありません。操作は再送していません。状態を確認して選び直してください" };
    }
  };
}
