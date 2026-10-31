---
name: pr-post-merge
description: PR をマージした後、GitHub の head ブランチを削除し、ローカルを main へ戻して更新し、完全にマージ済みの古いローカルブランチを整理する。PR のマージ後や「後処理して」「ブランチを片付けて」で使用する。
---

# PR マージ後の後処理

マージ済みであることを確認してから、リモートとローカルのブランチを整理する。

1. `gh pr view <number> --json state,headRefName` で PR が `MERGED` であることを確認する。未マージなら止める。
2. GitHub の head ブランチを削除する。`git push origin --delete <headRefName>` が既に削除済みなら、その結果を確認して続ける。
3. `git switch main` でローカルを `main` に戻す。
4. `git pull --ff-only origin main` でローカルの `main` をリモートの最新へ更新する。fast-forward できないときは止める。
5. `git fetch --prune origin` で削除済みリモートブランチの追跡参照を消す。
6. `git branch --merged main` で削除候補を確認し、`main` 以外の完全にマージ済みローカルブランチだけを `git branch -d <branch>` で削除する。

未マージのローカルブランチは削除しない。`git branch -D` は使わない。
