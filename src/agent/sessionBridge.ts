import type { AgentApi } from "@/agent/api.ts";
import { dispatchAgentRequest } from "@/agent/bridge.ts";

export interface DocumentSessionInfo {
  documentSessionId: string;
  filePath: string | null;
  documentName: string;
  ready: boolean;
}

// 文書を開き直したら同じファイルでも別セッション。保存やUndoではIDを変えない。
export function createDocumentSession() {
  let documentSessionId = crypto.randomUUID();
  let filePath: string | null = null;
  return {
    replace(path: string | null) { documentSessionId = crypto.randomUUID(); filePath = path; },
    saved(path: string) { filePath = path; },
    info(ready = true): DocumentSessionInfo {
      return { documentSessionId, filePath, ready, documentName: filePath?.split(/[\\/]/).pop() || "無題のドキュメント" };
    },
  };
}

export interface SessionRequest { method: string; args: unknown; documentSessionId?: string }

export function dispatchSessionRequest(api: AgentApi, session: DocumentSessionInfo, request: SessionRequest) {
  if (request.method === "get_instance_info") return { ok: true, data: session };
  // 検査と編集を同じJSイベントで実行する。送信前の照会だけでは文書切替との競合を防げない。
  if (request.documentSessionId !== session.documentSessionId) {
    return { ok: false, code: "document_changed", error: "文書が切り替わりました。list_instancesで確認し、select_instanceで選び直してください" };
  }
  if (!session.ready) return { ok: false, error: "復元データの確認が完了するまで操作できません" };
  return dispatchAgentRequest(api, request.method, request.args);
}
