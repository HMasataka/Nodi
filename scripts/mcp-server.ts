import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { readFile } from "node:fs/promises";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const configDir = process.platform === "darwin"
  ? join(homedir(), "Library", "Application Support")
  : process.platform === "win32"
    ? process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
    : process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const discoveryPath = process.env.NODI_BRIDGE_FILE ?? join(configDir, "com.hmasataka.nodi", "mcp-bridge.json");

export interface NodiBridgeResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export type NodiRequest = (method: string, args?: Record<string, unknown>) => Promise<NodiBridgeResponse>;

type ToolSchema = z.ZodObject<z.ZodRawShape> | ReturnType<typeof z.discriminatedUnion>;

export const PR_EVIDENCE_INSTRUCTIONS = [
  "Nodi を使って画面デザインや実装を変更し PR を作る場合、変更前と変更後の実画面スクリーンショットを同じ画面・ビューポート・データで撮影し、PR 本文に ![Before](URL) と ![After](URL) で添付する。",
  "画像は人間のレビュー用。AI はスクリーンショットの目視だけで正しさを判断せず、要素の ID・座標・寸法などの数値とテストでも検証する。",
  "画像を撮影・添付できない場合は捏造せず、PR 作成前に利用者へ知らせる。画面に変化がない PR ではその理由を本文に明記する。",
].join("\n");

export async function callNodi(
  method: string,
  args: Record<string, unknown> = {},
  path = discoveryPath,
): Promise<NodiBridgeResponse> {
  const { port, token } = JSON.parse(await readFile(path, "utf8")) as { port: number; token: string };
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Nodi-Token": token },
    body: JSON.stringify({ method, args }),
    signal: AbortSignal.timeout(16_000),
  });
  return await response.json() as NodiBridgeResponse;
}

export function createNodiMcpServer(request: NodiRequest = callNodi) {
  const server = new McpServer({ name: "nodi", version: "0.1.0" }, { instructions: PR_EVIDENCE_INSTRUCTIONS });
  function tool(name: string, description: string, inputSchema: ToolSchema, modifiesDesign = false) {
    const evidenceNote = modifiesDesign ? " PR 作成時は実画面の Before/After 画像を本文に添付し、正しさは数値とテストでも確認する。" : "";
    server.registerTool(name, { description: description + evidenceNote, inputSchema }, async (args: unknown) => {
      const response: NodiBridgeResponse = await request(name, args as Record<string, unknown>)
        .catch((error: unknown): NodiBridgeResponse => ({ ok: false, error: String(error) }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(response.ok ? response.data : { error: response.error }) }],
        isError: !response.ok,
      };
    });
  }
  tool("get_state", "開いている Nodi ドキュメントと選択要素、名前と ID の一覧を取得", z.object({}));
  tool("get_element", "ID で要素を取得", z.object({ id: z.string() }));
  tool("select_element", "ID で要素を画面上で選択し、境界が見えるようにパン・ズーム。名前・親階層・表示後の座標を返す（ドキュメントは変更しない）", z.strictObject({ id: z.string().min(1) }));
  tool("list_revisions", "現在のドキュメントのリビジョン ID・親 ID・現在/保存済み状態を作成順に取得", z.strictObject({}));
  tool("get_revision_element", "指定時点の要素の親基準座標・回転角・ドキュメント基準の四隅と境界を取得", z.strictObject({ revisionId: z.string().min(1), elementId: z.string().min(1) }));
  tool("compare_revisions", "同じ要素の2時点の座標・寸法・回転角の符号付き差分を取得", z.strictObject({ fromRevisionId: z.string().min(1), toRevisionId: z.string().min(1), elementId: z.string().min(1) }));
  tool("measure_elements", "指定時点の2要素間のドキュメント基準の距離・方向・重なりを px で取得", z.strictObject({ revisionId: z.string().min(1), firstId: z.string().min(1), secondId: z.string().min(1) }));
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
  tool("set_element_geometry", "ID で要素の親基準 x・y・width・height を変更（px）", z.strictObject({ id: z.string().min(1), ...geometry }), true);
  tool("set_rotation", "ID で要素を中心基準で時計回りに回転（度）", z.strictObject({ id: z.string().min(1), rotation: z.number().finite() }), true);
  tool("set_mask", "矩形・楕円をマスクに設定または解除", z.strictObject({ id: z.string().min(1), isMask: z.boolean() }), true);
  const boxStyle = { fill: z.string().nullable().optional(), stroke: z.strictObject({ color: z.string(), width: z.number() }).nullable().optional(), cornerRadii: z.strictObject({ topLeft: z.number(), topRight: z.number(), bottomRight: z.number(), bottomLeft: z.number() }).optional() };
  tool("set_shape_style", "矩形・楕円の塗り・内側線、矩形の角丸を変更", z.strictObject({ id: z.string().min(1), ...boxStyle }), true);
  tool("set_frame_style", "フレームの塗り・内側線・角丸と子要素のクリップを変更", z.strictObject({ id: z.string().min(1), ...boxStyle, clipContent: z.boolean().optional() }), true);
  const borderEdge = z.strictObject({ color: z.string(), width: z.number() });
  tool("set_border", "矩形・フレームの4辺の内側線を置換（省略した辺は線なし、角丸との併用不可）", z.strictObject({ id: z.string().min(1), border: z.strictObject({ top: borderEdge.optional(), right: borderEdge.optional(), bottom: borderEdge.optional(), left: borderEdge.optional() }) }), true);
  tool("set_image_style", "画像のフィット・焦点位置・4隅の角丸を変更", z.strictObject({ id: z.string().min(1), fit: z.enum(["cover", "contain", "fill"]).optional(), focalPoint: z.strictObject({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).optional(), cornerRadii: boxStyle.cornerRadii }), true);
  tool("set_image_filters", "画像の明るさ・コントラスト・彩度・グレースケール・セピア・色相を変更", z.strictObject({ id: z.string().min(1), filters: z.strictObject({ brightness: z.number().finite().nonnegative().optional(), contrast: z.number().finite().nonnegative().optional(), saturate: z.number().finite().nonnegative().optional(), grayscale: z.number().finite().min(0).max(1).optional(), sepia: z.number().finite().min(0).max(1).optional(), hueRotate: z.number().finite().optional() }) }), true);
  tool("set_text_style", "テキストの文字サイズ・色・揃え・フォント・太さ・行高・字間を変更", z.strictObject({ id: z.string().min(1), fontSize: z.number().optional(), color: z.string().optional(), textAlign: z.enum(["left", "center", "right"]).optional(), fontFamily: z.enum(["default", "system", "serif", "monospace"]).optional(), fontWeight: z.number().optional(), lineHeight: z.number().optional(), letterSpacing: z.number().optional() }), true);
  tool("set_text_marks", "テキスト本文の装飾範囲を指定・置換（色・太さ・下線・インラインコード）", z.strictObject({ id: z.string().min(1), marks: z.array(z.strictObject({ start: z.number(), end: z.number(), color: z.string().optional(), fontWeight: z.number().optional(), underline: z.literal(true).optional(), code: z.literal(true).optional() })) }), true);
  tool("delete_element", "ID で要素とその子孫を削除", z.strictObject({ id: z.string().min(1) }), true);
  tool("duplicate_element", "ID で要素と子孫を複製し、すべてに新しい ID を付ける", z.strictObject({ id: z.string().min(1) }), true);
  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createNodiMcpServer().connect(new StdioServerTransport()).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
