import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { AgentApi } from "../../../document/agent";
import { dispatchAgentRequest } from "../../../document/agentBridge";

export function useMcpBridge(agentApi: AgentApi, setError: Dispatch<SetStateAction<string | null>>) {
  const apiRef = useRef(agentApi);
  apiRef.current = agentApi;

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    void listen<{ id: string; method: string; args: unknown }>("nodi:mcp-request", (event) => {
      const { id, method, args } = event.payload;
      const response = dispatchAgentRequest(apiRef.current, method, args);
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
