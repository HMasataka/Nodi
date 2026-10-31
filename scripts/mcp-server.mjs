import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const configDir = process.platform === "darwin"
  ? join(homedir(), "Library", "Application Support")
  : process.platform === "win32"
    ? process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
    : process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const discoveryPath = process.env.NODI_BRIDGE_FILE ?? join(configDir, "com.hmasataka.nodi", "mcp-bridge.json");

export async function callNodi(method, args = {}, path = discoveryPath) {
  const { port, token } = JSON.parse(await readFile(path, "utf8"));
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Nodi-Token": token },
    body: JSON.stringify({ method, args }),
    signal: AbortSignal.timeout(16_000),
  });
  return await response.json();
}

export function createNodiMcpServer(request = callNodi) {
  const server = new McpServer({ name: "nodi", version: "0.1.0" });
  function tool(name, description, inputSchema) {
    server.registerTool(name, { description, inputSchema }, async (args) => {
      const response = await request(name, args).catch((error) => ({ ok: false, error: String(error) }));
      return {
        content: [{ type: "text", text: JSON.stringify(response.ok ? response.data : { error: response.error }) }],
        isError: !response.ok,
      };
    });
  }
  tool("get_state", "開いている Nodi ドキュメントと選択要素、名前と ID の一覧を取得", z.object({}));
  tool("get_element", "ID で要素を取得", z.object({ id: z.string() }));
  const geometry = { x: z.number(), y: z.number(), width: z.number(), height: z.number() };
  tool("add_element", "名前付き要素を追加", z.discriminatedUnion("type", [
    z.object({ type: z.literal("rectangle"), name: z.string().optional(), parentId: z.string().optional(), ...geometry }),
    z.object({ type: z.literal("frame"), name: z.string().optional(), parentId: z.string().optional(), ...geometry }),
    z.object({ type: z.literal("text"), name: z.string(), content: z.string(), parentId: z.string().optional(), ...geometry }),
  ]));
  tool("rename_element", "ID で要素を改名", z.object({ id: z.string(), name: z.string() }));
  tool("move_element", "ID で要素を移動", z.object({ id: z.string(), x: z.number(), y: z.number() }));
  tool("set_text_content", "ID でテキスト本文を変更", z.object({ id: z.string(), content: z.string() }));
  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createNodiMcpServer().connect(new StdioServerTransport()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
