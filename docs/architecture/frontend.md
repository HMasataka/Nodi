# フロントエンドの構成

エディタ画面は `src/pages/editor/` に置き、ドキュメントのモデル・操作・履歴・保存形式は `src/document/` に置く。ファイル入出力、MCP 向け API、Tauri への接続はそれぞれ別の境界に置く。

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
| `src/pages/editor/geometry.ts`・`viewport.ts` | 画面座標・ズームからドキュメント座標への変換 |
| `src/document/types.ts` | ドキュメントの型・既定値 |
| `src/document/commands/` | ツリー走査と作成・更新・スタイル・構造変更。`index.ts` が公開操作の入口 |
| `src/document/history.ts`・`measure.ts` | 編集履歴と履歴時点の数値計測 |
| `src/persistence/` | 保存形式の検証・JSON 変換、ファイル選択・読み書き、復元データの検証 |
| `src/agent/` | ドキュメント操作を MCP 用の参照・要求・応答へ変換 |
| `src/export/` | フレームの画像描画とファイル保存処理 |
| `src/ipc/` | Tauri のダイアログ・コマンドとブラウザの画像読み込みを扱う境界 |

依存方向は `atoms ← molecules ← organisms ← page`。下位のコンポーネントから上位のコンポーネントを import しない。各コンポーネントは専用フォルダに実装と re-export 専用の `index.ts` を置き、層全体のバレルは作らない。ページ固有の部品はまずそのページの `components/` に置く。

画面からドキュメントを変更するときは `src/document/` の操作結果を `useEditorDocument` に渡す。MCP からの変更も同じ履歴を通る。描画要素が増えたときは `CanvasNode`、レイヤーの表示が増えたときは `LayersPanel`、編集項目が増えたときは対応する編集欄と `Inspector` を更新する。`Canvas` は表示、`useCanvasInteraction` はその操作を担当する。

依存方向はドキュメントの型・編集操作・履歴 → ファイル/MCP/画面側のアダプター。`src/document/` から React、Tauri、ファイル選択や MCP の都合を参照しない。編集コマンド内では `tree.ts` と `validation.ts` を共有し、各操作は他の操作ファイルを経由しない。
