# Nodi

Tauri v2 と React / TypeScript (Vite) のデスクトップアプリです。

## 開発

Node.js、pnpm、Rust、macOS では Xcode Command Line Tools が必要です。

```sh
pnpm install
pnpm tauri dev
```

フロントエンドのみの確認は `pnpm dev`、配布用アプリの生成は `pnpm tauri build` で行います。

エディタの「保存」「開く」は Tauri のデスクトップアプリで使用します。`.nodi` ファイルの中身は JSON（[v1 形式](docs/document-format.md)）です。読み込みに失敗した場合は編集中のドキュメントを維持します。

編集は「元に戻す」「やり直す」ボタン、または `⌘/Ctrl+Z` と `⌘/Ctrl+Shift+Z` で取り消し・再実行できます。

`pnpm test` でドキュメントモデルのテストを実行します。`pnpm lint` は TypeScript/JavaScript の `throw` 文を禁止し、`pnpm build` でも lint を実行します。失敗する操作は `@praha/byethrow` の `Result` で返します。

外部 AI クライアントとの接続は [MCP の手順](docs/mcp.md) を参照してください。

現在作成できる画面の例は [サンプル](samples/README.md) から開けます。新しい描画機能を追加するときはサンプルも更新します。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
