import { listen } from "@tauri-apps/api/event";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

import type { AgentApi } from "@/agent/api";
import { dispatchSessionRequest, type DocumentSessionInfo, type SessionRequest } from "@/agent/sessionBridge.ts";

export function useMcpBridge(agentApi: AgentApi, setError: Dispatch<SetStateAction<string | null>>, getSession: () => DocumentSessionInfo) {
  const apiRef = useRef(agentApi);
  const sessionRef = useRef(getSession);
  apiRef.current = agentApi;
  sessionRef.current = getSession;

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    void listen<SessionRequest & { id: string }>("nodi:mcp-request", (event) => {
      const { id } = event.payload;
      const response = dispatchSessionRequest(apiRef.current, sessionRef.current(), event.payload);
      void invoke("resolve_mcp_request", { id, response }).catch((error: unknown) => {
        setError(`MCP 応答に失敗しました: ${String(error)}`);
      });
    }).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    }).catch((error: unknown) => setError(`MCP 接続に失敗しました: ${String(error)}`));
    return () => { active = false; unlisten?.(); };
  }, [setError]);
}
