# Nodi

Tauri v2 と React / TypeScript (Vite) のデスクトップアプリです。

## 開発

開発環境は [Nix](https://nixos.org/) の flake で管理しています。Node.js・pnpm・Rust（cargo / rustfmt / clippy）が `nix develop` で揃います。

```sh
nix develop          # direnv を使う場合は代わりに direnv allow
pnpm install
pnpm tauri dev
```

[direnv](https://direnv.net/) と [nix-direnv](https://github.com/nix-community/nix-direnv) を導入済みなら、リポジトリで `direnv allow` するだけで同じ環境に自動で入ります（`.envrc`）。macOS では Xcode Command Line Tools が別途必要です。

フロントエンドのみの確認は `pnpm dev`、配布用アプリの生成は `pnpm tauri build` で行います。

`nix develop`（または direnv）の環境では Kache が Rust コンパイラのラッパーとして有効になり、`pnpm tauri dev` にも引き継がれます。Kache のローカルストアはユーザー単位で共有されるため、worktree ごとの `src-tauri/target/` は分離したまま、同じツールチェーン・ビルド条件の成果物を再利用できます。`kache init` は不要です。

初回ビルドの後、別の worktree でビルドし、`kache stats --last-build` で再利用状況を確認できます。新しい worktree の依存関係を `target/` に先に複製する機能も使う場合は、`kache daemon start` を実行してください。

エディタの「保存」「開く」は Tauri のデスクトップアプリで使用します。`.nodi` ファイルの中身は JSON（[v1 形式](docs/document-format.md)）です。読み込みに失敗した場合は編集中のドキュメントを維持します。開いている `.nodi` ファイルが外部で更新された場合は、未保存の変更がなければ自動で再読み込みし、未保存の変更があれば確認してから再読み込みします。

フレームを選択すると [PNG 書き出し](docs/export-png.md) で画面を共有できます。

画像は「画像を追加」から PNG・JPEG・WEBP・SVG（5 MB 以下）を選べます。画像データは `.nodi` ファイル内に埋め込まれます。

編集は「元に戻す」「やり直す」ボタン、または `⌘/Ctrl+Z` と `⌘/Ctrl+Shift+Z` で取り消し・再実行できます。

起動中の履歴には [安定したリビジョン ID](docs/revision-history.md) が付きます。

`pnpm test` で Vitest により TypeScript のテストを実行します。`pnpm lint` は TypeScript/JavaScript の `throw` 文を禁止し、`pnpm build` でも lint を実行します。失敗する操作は `@praha/byethrow` の `Result` で返します。

外部 AI クライアントとの接続は [MCP の手順](docs/mcp.md) を参照してください。

フロントエンドの責務と配置は [構成メモ](docs/architecture/frontend.md) にまとめています。

現在作成できる画面の例は [サンプル](samples/README.md) から開けます。新しい描画機能を追加するときはサンプルも更新します。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
