---
name: worktree-workflow
description: このリポジトリで作業用 git worktree を作る、仮ブランチで作業を始める、PR 前にブランチを改名する、worktree から Rust のビルドキャッシュを再利用するときに使う。
---

# 作業用 worktree

作業内容が未定でも、仮のブランチ名で worktree を作ってよい。ブランチ名と worktree のディレクトリ名は別々に扱う。

## 作業開始

1. `git worktree list` で main の worktree を特定し、そのルートで `git branch --show-current` が `main` であることと `git status --short` を確認する。既存の変更や worktree を上書きしない。
2. main の worktree のルートで次を実行する。`MAIN_WORKTREE` は、worktree に移動する前に記録する。

   ```bash
   MAIN_WORKTREE="$(git rev-parse --show-toplevel)"
   WORKTREE="../Nodi-work-$(date +%Y%m%d-%H%M%S)"
   git worktree add -b "wip/$(date +%Y%m%d-%H%M%S)" "$WORKTREE" main
   ```

   名前が既に使われていたら、別の名前を選ぶ。`main` が必要な基点より古い場合は、作成前に基点を確認する。
3. `cd "$WORKTREE"` で移動し、その worktree の `.envrc` を確認して `direnv allow .` を実行する。direnv が使えない環境では `nix develop` を使う。`printenv RUSTC_WRAPPER` で `kache` を確認する。エージェントなどがシェルの direnv フックを通さず実行する場合は、`direnv exec <worktree のパス> <コマンド>` を使う。

## Rust のビルド

このリポジトリでは、worktree ごとの `src-tauri/target/` を分けたまま kache が成果物を共有する。同じコミットなら、別の worktree の `cargo build` は2回目以降キャッシュから復元される。`kache stats --last-build` でヒット数、`kache explain` でミスの理由を確認できる。

`src-tauri/target/` を worktree 間で共有する必要はない。共有すると Cargo のロック待ちや、`cargo clean` による他 worktree への影響が起きる。新しい worktree の依存関係を `src-tauri/target/` に先に複製する機能も使う場合は、`kache daemon start` を実行する。

## PR の前

作業内容が決まったら、worktree 内で仮ブランチを適切な名前に変え、変更後の名前で初めて push する。

```bash
git branch -m feature/descriptive-name
git push -u origin feature/descriptive-name
```

ブランチ名を変えても worktree のディレクトリ名は変わらず、PR のブランチ名には影響しない。必要なら `git worktree move <元のパス> <新しいパス>` でディレクトリも移す。仮ブランチをすでに push 済みなら、古いリモートブランチと upstream の扱いを確認してから PR を作る。
