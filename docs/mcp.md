# MCP から Nodi を操作する

Nodi デスクトップアプリを起動してドキュメントを開いた状態で、外部 MCP クライアントから接続できる。MCP サーバーは stdio で動作し、ローカルの Nodi アプリに接続する。`pnpm dev` のブラウザ表示だけでは接続できない。

## 接続

1. `pnpm tauri dev` で Nodi を起動する。
2. MCP クライアントのサーバー設定で、`node` と Nodi リポジトリ内の `scripts/mcp-server.mjs` の絶対パスを指定する。
3. クライアントを再起動し、`nodi` サーバーのツールが表示されることを確認する。

設定例（`/path/to/Nodi` を実際のパスに置き換える）:

```json
{
  "mcpServers": {
    "nodi": {
      "command": "node",
      "args": ["/path/to/Nodi/scripts/mcp-server.mjs"]
    }
  }
}
```

接続先はアプリがユーザーの設定ディレクトリに作る `com.hmasataka.nodi/mcp-bridge.json` から自動取得する。別の場所にある場合は MCP サーバーの環境変数 `NODI_BRIDGE_FILE` にそのファイルの絶対パスを指定する。ファイルにはローカル接続用のトークンが入るため、リポジトリへ追加しない。

## ツールと確認手順

- `get_state`: 開いているドキュメント・選択要素・要素一覧。
- `get_element`: ID で要素を参照。
- `add_element`: `type`（`frame`・`rectangle`・`ellipse`・`text`）、`name`、`x`、`y`、`width`、`height`（必要なら `parentId`）を指定して追加。テキストの場合は `content` も必須。
- `rename_element`: ID と新しい名前で改名。
- `move_element`: ID と親基準の X・Y で移動。
- `set_text_content`: ID と本文でテキストを変更。

`get_state` を呼び、続けて `add_element` で名前付き矩形を追加する。返された名前と ID を使って `rename_element`・`move_element` を呼ぶと、画面にも変更が反映される。画面の「元に戻す」で操作を戻せることを確認する。存在しない ID を指定した場合はエラーとなり、ドキュメントは変わらない。

## Nodi を使った変更の PR

MCP サーバーは接続時の指示と編集ツールの説明で、利用側の AI に次を伝える。

- 画面デザインや実装を変更して PR を作るときは、変更前・後の実画面を同じ画面・ビューポート・データで撮影し、PR 本文に `![Before](URL)` と `![After](URL)` として添付する。
- 画像は人間のレビュー用。AI は目視だけで正しさを判断せず、ID、座標、寸法などの数値とテストでも検証する。
- 撮影・添付ができない場合は画像を捏造せず、PR 作成前に利用者へ伝える。画面に変化のない PR はその理由を記載する。

MCP の指示は利用側クライアントへの依頼であり、利用側の `gh pr create` を技術的に止めるものではない。厳格に必須化する場合は、その利用側リポジトリの PR チェックが必要になる。
