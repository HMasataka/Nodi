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

export const PR_EVIDENCE_INSTRUCTIONS = [
  "Nodi を使って画面デザインや実装を変更し PR を作る場合、変更前と変更後の実画面スクリーンショットを同じ画面・ビューポート・データで撮影し、PR 本文に ![Before](URL) と ![After](URL) で添付する。",
  "画像は人間のレビュー用。AI はスクリーンショットの目視だけで正しさを判断せず、要素の ID・座標・寸法などの数値とテストでも検証する。",
  "画像を撮影・添付できない場合は捏造せず、PR 作成前に利用者へ知らせる。画面に変化がない PR ではその理由を本文に明記する。",
].join("\n");

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
  const server = new McpServer({ name: "nodi", version: "0.1.0" }, { instructions: PR_EVIDENCE_INSTRUCTIONS });
  function tool(name, description, inputSchema, modifiesDesign = false) {
    const evidenceNote = modifiesDesign ? " PR 作成時は実画面の Before/After 画像を本文に添付し、正しさは数値とテストでも確認する。" : "";
    server.registerTool(name, { description: description + evidenceNote, inputSchema }, async (args) => {
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
    z.object({ type: z.literal("ellipse"), name: z.string().optional(), parentId: z.string().optional(), ...geometry }),
    z.object({ type: z.literal("frame"), name: z.string().optional(), parentId: z.string().optional(), ...geometry }),
    z.object({ type: z.literal("text"), name: z.string(), content: z.string(), parentId: z.string().optional(), ...geometry }),
  ]), true);
  tool("rename_element", "ID で要素を改名", z.object({ id: z.string(), name: z.string() }), true);
  tool("move_element", "ID で要素を移動", z.object({ id: z.string(), x: z.number(), y: z.number() }), true);
  tool("set_text_content", "ID でテキスト本文を変更", z.object({ id: z.string(), content: z.string() }), true);
  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createNodiMcpServer().connect(new StdioServerTransport()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
