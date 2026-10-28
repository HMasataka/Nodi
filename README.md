# Nodi

Tauri v2 と React / TypeScript (Vite) のデスクトップアプリです。

## 開発

Node.js、pnpm、Rust、macOS では Xcode Command Line Tools が必要です。

```sh
pnpm install
pnpm tauri dev
```

フロントエンドのみの確認は `pnpm dev`、配布用アプリの生成は `pnpm tauri build` で行います。

エディタの「保存」「開く」は Tauri のデスクトップアプリで使用します。`.nodi` ファイルの中身は JSON（`docs/document-format.md` の v1）です。以前の `.json` ファイルも開けます。読み込みに失敗した場合は編集中のドキュメントを維持します。

`pnpm test` でドキュメントモデルのテストを実行します。`pnpm lint` は TypeScript/JavaScript の `throw` 文を禁止し、`pnpm build` でも lint を実行します。失敗する操作は `@praha/byethrow` の `Result` で返します。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
