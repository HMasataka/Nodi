# Nodi

Tauri v2 と React / TypeScript (Vite) のデスクトップアプリです。

## 開発

Node.js、pnpm、Rust、macOS では Xcode Command Line Tools が必要です。

```sh
pnpm install
pnpm tauri dev
```

フロントエンドのみの確認は `pnpm dev`、配布用アプリの生成は `pnpm tauri build` で行います。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
