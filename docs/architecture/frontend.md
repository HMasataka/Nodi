# フロントエンドの構成

エディタ画面は `src/pages/editor/` に置き、ドキュメントのモデル・操作・履歴・保存形式は `src/document/` に置く。ファイル入出力、MCP 向け API、Tauri への接続はそれぞれ別の境界に置く。

| 場所 | 責務 |
| --- | --- |
| `src/App.tsx` | エディタページの起点 |
| `src/pages/editor/index.tsx` | ツールバー、レイヤー、キャンバス、プロパティ、状態表示の接続 |
| `src/pages/<page>/components/atoms/` | 単一の入力やアイコン、リサイズハンドル |
| `src/pages/<page>/components/molecules/` | 入力を組み合わせた編集欄や描画ノード |
| `src/pages/<page>/components/organisms/` | キャンバス、レイヤー一覧、プロパティなど画面領域 |
| `src/pages/editor/hooks/useEditorDocument.ts` | ドキュメント・選択・履歴・保存状態、ファイル操作 |
| `src/pages/editor/creation.ts`・`hooks/useElementCreation.ts` | 要素の作成初期値と作成・画像読み込み操作 |
| `src/pages/editor/hooks/useEditorActions.ts` | 選択要素の編集・削除・複製・書き出し |
| `src/pages/editor/components/organisms/EditorToolbar/` | 文書操作と作成・描画ツールの組み立て |
| `src/pages/editor/components/molecules/CreationTools/`・`DocumentControls/`・`DrawingTools/` | ツールバー内の操作群 |
| `src/pages/editor/components/molecules/ElementAppearance/` | 要素種別ごとの編集欄の切り替え |
| `src/pages/editor/hooks/useCanvasInteraction.ts` | 要素のドラッグ・範囲選択・描画ツールと Undo / Redo |
| `src/pages/editor/hooks/useCanvasViewport.ts` | パン・ズーム、Space キー操作、MCP からの表示位置調整 |
| `src/pages/editor/hooks/useMcpBridge.ts` | 実行中のアプリへの MCP 要求を編集 API に渡す |
| `src/pages/editor/geometry.ts`・`viewport.ts` | 画面座標・ズームからドキュメント座標への変換 |
| `src/document/types.ts` | ドキュメントの型・既定値 |
| `src/document/geometry.ts` | 親フレームのアフィン変換を含む絶対座標・AABB走査と、マスク／クリップを加味した表示領域AABBの問い合わせ |
| `src/document/commands/` | ツリー走査と作成・更新・スタイル・構造変更。`index.ts` が公開操作の入口 |
| `src/document/history.ts`・`measure.ts` | 編集履歴と履歴時点の数値計測 |
| `src/document/layout.ts` | 自動レイアウトの座標解決（編集画面と PNG 書き出しが共用する純粋関数） |
| `src/persistence/` | 保存形式の検証・JSON 変換、ファイル選択・読み書き、復元データの検証 |
| `src/agent/` | ドキュメント操作を MCP 用の参照・要求・応答へ変換 |
| `src/export/` | フレームの画像描画とファイル保存処理 |
| `src/ipc/` | Tauri のダイアログ・コマンドとブラウザの画像読み込みを扱う境界 |

依存方向は `atoms ← molecules ← organisms ← page`。下位のコンポーネントから上位のコンポーネントを import しない。各コンポーネントは専用フォルダに実装と re-export 専用の `index.ts` を置き、層全体のバレルは作らない。ページ固有の部品はまずそのページの `components/` に置く。

画面からドキュメントを変更するときは `src/document/` の操作結果を `useEditorDocument` に渡す。MCP からの変更も同じ履歴を通る。描画要素が増えたときは `CanvasNode`、レイヤーの表示が増えたときは `LayersPanel`、編集項目が増えたときは対応する編集欄と `Inspector` を更新する。`Canvas` は表示、`useCanvasInteraction` はその操作を担当する。

依存方向はドキュメントの型・編集操作・履歴 → ファイル/MCP/画面側のアダプター。`src/document/` から React、Tauri、ファイル選択や MCP の都合を参照しない。編集コマンド内では `tree.ts` と `validation.ts` を共有し、各操作は他の操作ファイルを経由しない。

MCP の公開ツールとアプリ側の要求検証は `src/agent/contracts.ts` の入力スキーマを共有する。`scripts/mcp-server.ts` はツール説明と接続、`src/agent/bridge.ts` は検証済み要求の振り分けを担う。ドキュメント編集の制約はコマンド側で維持する。

## 色

- 編集画面の UI 色は `src/App.css` の `:root` に定義した CSS カスタムプロパティを使う。ルール内に色のリテラルを書かない。
- キャンバスと PNG の両方で使う描画色は `src/rendering/colors.ts` に置く。テキストのインラインコード背景など、2つの描画経路で一致させる必要がある色が対象。
- 文書の既定色（`src/document/types.ts` の `DEFAULT_RECTANGLE_STYLE` など）は保存データの意味を持つため、UI トークンとは分けて扱う。
