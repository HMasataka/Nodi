# フロントエンドの構成

エディタ画面は `src/pages/editor/` に置き、共通のドキュメント操作は `src/document/`、Tauri への接続は `src/ipc/` に置く。

| 場所 | 責務 |
| --- | --- |
| `src/App.tsx` | エディタページの起点 |
| `src/pages/editor/index.tsx` | ツールの選択、キャンバス操作、各画面領域の接続 |
| `src/pages/editor/components/` | キャンバス、レイヤー一覧、プロパティの表示 |
| `src/pages/editor/hooks/useEditorDocument.ts` | ドキュメント・選択・履歴・保存状態、ファイル操作 |
| `src/pages/editor/hooks/useMcpBridge.ts` | 実行中のアプリへの MCP 要求を編集 API に渡す |
| `src/document/` | React や Tauri に依存しない保存形式、編集操作、履歴、エージェント API |
| `src/ipc/` | Tauri のダイアログとコマンドを呼ぶ境界 |

画面からドキュメントを変更するときは `src/document/` の操作結果を `useEditorDocument` に渡す。MCP からの変更も同じ履歴を通る。描画要素が増えたときは `Canvas`、レイヤーの表示が増えたときは `LayersPanel`、編集項目が増えたときは `Inspector` を更新する。
