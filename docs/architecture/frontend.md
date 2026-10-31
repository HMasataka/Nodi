# フロントエンドの構成

エディタ画面は `src/pages/editor/` に置き、共通のドキュメント操作は `src/document/`、Tauri への接続は `src/ipc/` に置く。

| 場所 | 責務 |
| --- | --- |
| `src/App.tsx` | エディタページの起点 |
| `src/pages/editor/index.tsx` | ツールの選択、キャンバス操作、各画面領域の接続 |
| `src/pages/<page>/components/atoms/` | 単一の入力やアイコン、リサイズハンドル |
| `src/pages/<page>/components/molecules/` | 入力を組み合わせた編集欄や描画ノード |
| `src/pages/<page>/components/organisms/` | キャンバス、レイヤー一覧、プロパティなど画面領域 |
| `src/pages/editor/hooks/useEditorDocument.ts` | ドキュメント・選択・履歴・保存状態、ファイル操作 |
| `src/pages/editor/hooks/useCanvasInteraction.ts` | ポインター操作、パン・ズーム、描画ツールとショートカット |
| `src/pages/editor/hooks/useMcpBridge.ts` | 実行中のアプリへの MCP 要求を編集 API に渡す |
| `src/document/` | React や Tauri に依存しない保存形式、編集操作、履歴、エージェント API |
| `src/ipc/` | Tauri のダイアログ・コマンドとブラウザの画像読み込みを扱う境界 |

依存方向は `atoms ← molecules ← organisms ← page`。下位のコンポーネントから上位のコンポーネントを import しない。各コンポーネントは専用フォルダに実装と re-export 専用の `index.ts` を置き、層全体のバレルは作らない。ページ固有の部品はまずそのページの `components/` に置く。

画面からドキュメントを変更するときは `src/document/` の操作結果を `useEditorDocument` に渡す。MCP からの変更も同じ履歴を通る。描画要素が増えたときは `CanvasNode`、レイヤーの表示が増えたときは `LayersPanel`、編集項目が増えたときは対応する編集欄と `Inspector` を更新する。`Canvas` は表示、`useCanvasInteraction` はその操作を担当する。
