import { agentInputs } from "../src/agent/contracts.ts";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createNodiRequest, instanceInputs, type NodiBridgeResponse, type NodiRequest } from "./nodi-instances.ts";

type ToolSchema = (typeof agentInputs)[keyof typeof agentInputs] | (typeof instanceInputs)[keyof typeof instanceInputs];

export const PR_EVIDENCE_INSTRUCTIONS = [
  "Nodi を使って画面デザインや実装を変更し PR を作る場合、変更前と変更後の実画面スクリーンショットを同じ画面・ビューポート・データで撮影し、PR 本文に ![Before](URL) と ![After](URL) で添付する。",
  "画像は人間のレビュー用。AI はスクリーンショットの目視だけで正しさを判断せず、要素の ID・座標・寸法などの数値とテストでも検証する。",
  "画像を撮影・添付できない場合は捏造せず、PR 作成前に利用者へ知らせる。画面に変化がない PR ではその理由を本文に明記する。",
].join("\n");

export function createNodiMcpServer(request: NodiRequest = createNodiRequest()) {
  const server = new McpServer({ name: "nodi", version: "0.1.0" }, { instructions: [
    "最初にlist_instancesで起動中のNodiと文書を確認し、instanceIdとdocumentSessionIdをselect_instanceへ渡してください。文書が切り替わった場合は一覧から選び直してください。",
    PR_EVIDENCE_INSTRUCTIONS,
  ].join("\n") });
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
  tool("list_instances", "起動中のNodiと現在の文書を一覧取得。接続情報のトークンは返さない", instanceInputs.list_instances);
  tool("select_instance", "一覧で確認したアプリと文書を、このMCPサーバーの操作対象として選択", instanceInputs.select_instance);
  tool("get_state", "開いている Nodi ドキュメントと選択要素、名前と ID の一覧を取得", agentInputs.get_state);
  tool("get_element", "ID で要素を取得", agentInputs.get_element);
  tool("select_element", "ID で要素を画面上で選択し、境界が見えるようにパン・ズーム。名前・親階層・表示後の座標を返す（ドキュメントは変更しない）", agentInputs.select_element);
  tool("list_revisions", "現在のドキュメントのリビジョン ID・親 ID・現在/保存済み状態を作成順に取得", agentInputs.list_revisions);
  tool("get_revision_element", "指定時点の要素の親基準座標・回転角・ドキュメント基準の四隅と境界を取得", agentInputs.get_revision_element);
  tool("compare_revisions", "同じ要素の2時点の座標・寸法・回転角の符号付き差分を取得", agentInputs.compare_revisions);
  tool("measure_elements", "指定時点の2要素間のドキュメント基準の距離・方向・重なりを px で取得", agentInputs.measure_elements);
  tool("add_element", "名前付き要素を追加", agentInputs.add_element, true);
  tool("rename_element", "ID で要素を改名", agentInputs.rename_element, true);
  tool("move_element", "ID で要素を移動", agentInputs.move_element, true);
  tool("set_text_content", "ID でテキスト本文を変更", agentInputs.set_text_content, true);
  tool("set_element_geometry", "ID で要素の親基準 x・y・width・height を変更（px）", agentInputs.set_element_geometry, true);
  tool("set_rotation", "ID で要素を中心基準で時計回りに回転（度）", agentInputs.set_rotation, true);
  tool("set_mask", "矩形・楕円をマスクに設定または解除", agentInputs.set_mask, true);
  tool("set_opacity", "要素全体の不透明度を0〜1で設定", agentInputs.set_opacity, true);
  tool("set_shadow", "要素全体の外側影を設定または解除", agentInputs.set_shadow, true);
  tool("set_blur", "要素全体のぼかし量をpxで設定", agentInputs.set_blur, true);
  tool("set_shape_style", "矩形・楕円・パスの塗りと線、矩形の角丸を変更", agentInputs.set_shape_style, true);
  tool("set_path", "パスの命令列と塗り規則を変更", agentInputs.set_path, true);
  tool("set_frame_style", "フレームの塗り・内側線・角丸と子要素のクリップを変更", agentInputs.set_frame_style, true);
  tool("set_border", "矩形・フレームの4辺の内側線を置換（省略した辺は線なし、角丸との併用不可）", agentInputs.set_border, true);
  tool("set_image_style", "画像のフィット・焦点位置・4隅の角丸を変更", agentInputs.set_image_style, true);
  tool("set_image_filters", "画像の明るさ・コントラスト・彩度・グレースケール・セピア・色相を変更", agentInputs.set_image_filters, true);
  tool("set_text_style", "テキストの文字サイズ・色・揃え・フォント・太さ・行高・字間を変更", agentInputs.set_text_style, true);
  tool("set_text_marks", "テキスト本文の装飾範囲を指定・置換（色・太さ・下線・インラインコード）", agentInputs.set_text_marks, true);
  tool("delete_element", "ID で要素とその子孫を削除", agentInputs.delete_element, true);
  tool("duplicate_element", "ID で要素と子孫を複製し、すべてに新しい ID を付ける", agentInputs.duplicate_element, true);
  return server;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createNodiMcpServer().connect(new StdioServerTransport()).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
