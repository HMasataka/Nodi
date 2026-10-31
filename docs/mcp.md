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
