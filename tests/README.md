# テスト

`pnpm test` で `tests/*.test.mjs` を実行する。

## 共通ヘルパー

- 成功・失敗の検証は `tests/support/factories.mjs` の `success` / `failure` を使う。
- 文書を直接組み立てるときは `document`、要素は `frame`・`rectangle`・`ellipse`・`text`・`image` を使い、変えたい値だけ上書きする。
- 複数の兄弟要素を作るときは `id` を明示する。
- PNG 用の fake canvas やファイルアクセスのように、そのテストだけが使うヘルパーは各ファイルに置く。
