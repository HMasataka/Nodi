# フロントエンドの構成

エディタ画面は `src/pages/editor/` に置き、ドキュメントのモデル・操作・履歴・保存形式は `src/document/` に置く。ファイル入出力、MCP 向け API、Tauri への接続はそれぞれ別の境界に置く。

| 場所 | 責務 |
| --- | --- |
| `src/App.tsx` | エディタページの起点 |
| `src/pages/editor/index.tsx` | 3列の全高レイアウト（左パネル・キャンバス・右パネル）と、キャンバスに浮かせるチップ・作成ツール・タイムラインの接続 |
| `src/pages/<page>/components/atoms/` | 単一の入力やアイコン、リサイズハンドル |
| `src/pages/<page>/components/molecules/` | 入力を組み合わせた編集欄や描画ノード |
| `src/pages/<page>/components/organisms/` | キャンバス、レイヤー一覧、プロパティなど画面領域 |
| `src/pages/editor/hooks/useEditorDocument.ts` | ドキュメント・選択・履歴・保存状態、ファイル操作 |
| `src/pages/editor/creation.ts`・`hooks/useElementCreation.ts` | 要素の作成初期値と作成・画像読み込み操作 |
| `src/pages/editor/hooks/useEditorActions.ts` | 選択要素の編集・削除・複製・書き出し |
| `src/pages/editor/components/organisms/Timeline/` | 再生操作とキーフレーム・タイムラインの編集 |
| `src/pages/editor/components/molecules/FileChip/` | キャンバス左上のファイルのチップとファイルメニュー（開く・保存・SVG 取り込み・元に戻す・やり直す） |
| `src/pages/editor/components/molecules/ActionChip/` | キャンバス右上の倍率、プレビューの切り換え、右パネルの開閉 |
| `src/pages/editor/components/organisms/PreviewStage/` | 選択中のフレームを指定した幅で描くプレビュー（幅の切り換え・入力、× と Esc で編集に戻る） |
| `src/pages/editor/components/molecules/FloatingTools/` | キャンバス下中央の作成ツール（描くツール・画像の取り込み・タイムラインの開閉） |
| `src/pages/editor/panelLayout.ts`・`hooks/usePanelLayout.ts` | 左右のパネルとタイムラインの開閉状態と列の幅 |
| `src/pages/editor/components/molecules/TextAppearance/` | テキストの本文・選択範囲の装飾・文字の見た目の編集欄 |
| `src/pages/editor/hooks/useCanvasInteraction.ts` | 要素のドラッグ・範囲選択・描画ツールと Undo / Redo |
| `src/pages/editor/hooks/useCanvasViewport.ts` | パン・ズーム、Space キー操作、MCP からの表示位置調整 |
| `src/pages/editor/hooks/useMcpBridge.ts` | 実行中のアプリへの MCP 要求を編集 API に渡す |
| `src/pages/editor/shortcuts.ts`・`hooks/useEditorShortcuts.ts` | キーボードショートカットの判定と実行。割り当ては `docs/shortcuts.md` |
| `src/pages/editor/hooks/usePlayback.ts` | アニメーション再生ヘッドの再生・停止・シーク |
| `src/pages/editor/geometry.ts`・`viewport.ts`・`camera.ts` | 仮想カメラ、画面座標・ズームからドキュメント座標への変換 |
| `src/document/types.ts` | ドキュメントの型・既定値 |
| `src/document/geometry.ts` | 親フレームのアフィン変換を含む絶対座標・AABB走査と、マスク／クリップを加味した表示領域AABBの問い合わせ |
| `src/document/commands/` | ツリー走査と作成・更新・スタイル・構造変更。`index.ts` が公開操作の入口 |
| `src/document/history.ts`・`measure.ts` | 編集履歴と履歴時点の数値計測 |
| `src/document/layout.ts` | 自動レイアウトの座標解決（編集画面と PNG 書き出しが共用する純粋関数） |
| `src/document/animation.ts` | キーフレーム・遅延・緩急・繰り返しから時刻 `t` の属性値を計算する純粋関数 |
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
- `:root` の色は2層に分ける。
  - パレットの段：`--white`、`--grey-900`〜`--grey-050`、`--purple-900`〜`--purple-050`、`--red-900`〜`--red-050`。色のリテラルはここにだけ書く。配色は `designs/README.md` の「配色」に合わせ、灰色は Swatches の Grey、主役は Palette 18 の紫、エラーは Palette 18 の補助色 Red (Vivid) を使う。
  - 用途名：`--ink`、`--line`、`--accent` など。段を `var()` で参照し、半透明は `color-mix()` で作る。ルールは用途名だけを参照し、段を直接参照しない。
- 紫は選択と主な操作に限って使い、それ以外の面・線・文字は灰色の段から選ぶ。
- キャンバスと PNG の両方で使う描画色は `src/rendering/colors.ts` に置く。テキストのインラインコード背景など、2つの描画経路で一致させる必要がある色が対象。
- 文書の既定色（`src/document/types.ts` の `DEFAULT_RECTANGLE_STYLE` など）は保存データの意味を持つため、UI トークンとは分けて扱う。

## 寸法

- 余白・角丸・文字サイズ・行高は `src/App.css` の `:root` にある段を使う。値は `designs/README.md` の「共通の約束」に合わせている。
  - 余白：`--space-0`・`4`・`8`・`12`・`16`・`20`・`24`・`32`
  - 角丸：`--radius-4`・`6`・`8`・`12`
  - 文字サイズ：`--font-size-11`・`12`・`13`・`15`
  - 行高：`--line-height-11`・`12`・`13`・`15`。対応する文字サイズと組にして使う。
- 新しく書くルールでは、`padding`・`margin`・`gap`・`border-radius`・`font-size`・`line-height` に数値を直接書かず、段を参照する。段にない値が必要になったら、先にデザインを見直す。
- 既存のルールは、デザインに合わせて書き換えるときに段へ置き換える。

