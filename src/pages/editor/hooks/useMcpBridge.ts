import { listen } from "@tauri-apps/api/event";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

import type { AgentApi } from "@/agent/api";
import { dispatchAgentRequest } from "@/agent/bridge";

export function useMcpBridge(agentApi: AgentApi, setError: Dispatch<SetStateAction<string | null>>, enabled = true) {
  const apiRef = useRef(agentApi);
  const enabledRef = useRef(enabled);
  apiRef.current = agentApi;
  enabledRef.current = enabled;

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    void listen<{ id: string; method: string; args: unknown }>("nodi:mcp-request", (event) => {
      const { id, method, args } = event.payload;
      const response = enabledRef.current
        ? dispatchAgentRequest(apiRef.current, method, args)
        : { ok: false, error: "復元データの確認が完了するまで編集できません" };
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
