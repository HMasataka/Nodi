# MCP から Nodi を操作する

Nodi デスクトップアプリを起動してドキュメントを開いた状態で、外部 MCP クライアントから接続できる。MCP サーバーは stdio で動作し、ローカルの Nodi アプリに接続する。`pnpm dev` のブラウザ表示だけでは接続できない。

## 接続

1. `pnpm tauri dev` で Nodi を起動する。
2. MCP クライアントのサーバー設定で、`node` と Nodi リポジトリ内の `scripts/mcp-server.ts` の絶対パスを指定する。
3. クライアントを再起動し、`nodi` サーバーのツールが表示されることを確認する。

設定例（`/path/to/Nodi` を実際のパスに置き換える）:

```json
{
  "mcpServers": {
    "nodi": {
      "command": "node",
      "args": ["/path/to/Nodi/scripts/mcp-server.ts"]
    }
  }
}
```

接続先はアプリがユーザーの設定ディレクトリに作る `com.hmasataka.nodi/mcp-bridge.json` から自動取得する。別の場所にある場合は MCP サーバーの環境変数 `NODI_BRIDGE_FILE` にそのファイルの絶対パスを指定する。ファイルにはローカル接続用のトークンが入るため、リポジトリへ追加しない。

## ツールと確認手順

- `get_state`: 開いているドキュメント・選択要素・要素一覧。
- `get_element`: ID で要素を参照。
- `select_element`: `id` で要素を選択し、全体が見えるように画面をパン・ズーム。名前・親階層、ドキュメント絶対位置、表示後の画面座標と倍率を返す。選択と表示だけなので未保存状態や履歴は変わらない。
- `list_revisions`: 作成順のリビジョン ID・親 ID・現在/保存済み状態。Undo 後に分岐した旧時点も含む。
- `get_revision_element`: `revisionId` と `elementId` で、指定時点の要素の親基準座標とドキュメント基準の四辺・中心を取得。
- `compare_revisions`: `fromRevisionId`、`toRevisionId`、`elementId` で、同じ要素の2時点の座標・寸法差分を取得。
- `measure_elements`: `revisionId`、`firstId`、`secondId` で、2要素の方向、中心差、軸ごとの間隔と重なりを取得。
- `add_element`: `type`（`frame`・`rectangle`・`ellipse`・`text`）、`name`、`x`、`y`、`width`、`height`（必要なら `parentId`）を指定して追加。テキストの場合は `content` も必須。
- `rename_element`: ID と新しい名前で改名。
- `move_element`: ID と親基準の X・Y で移動。
- `set_text_content`: ID と本文でテキストを変更。
- `set_element_geometry`: ID と親基準の `x`・`y`・`width`・`height`（px）で位置と寸法を変更。
- `set_shape_style`: 矩形・楕円の `fill`（`#RRGGBB` または `null`）・`stroke`（`{ color, width }` または `null`）、矩形の `cornerRadii`（`topLeft`・`topRight`・`bottomRight`・`bottomLeft`）を変更。線は均一な内側線。
- `set_mask`: 矩形・楕円の `isMask` を真偽値で切り替える。マスクは後続の同じ親の兄弟を、次のマスクまでクリップする。未選択時のマスクはレイヤー一覧から選択する。
- `set_opacity`: 要素全体の不透明度 `opacity` を0〜1で設定する。フレームは子を含むグループに適用する。
- `set_shadow`: 要素全体の外側影を `{ color, offsetX, offsetY, blur }` で設定する。`null` で解除する。色は6桁／8桁HEX、ぼかしは0以上。
- `set_shape_style`・`set_frame_style` の `fill` は単色や `null` のほか、`type: "linear"`、正規化した `start`・`end`、2個以上の `{ position, color }` の `stops` を持つ線形グラデーションを指定できる。
- `fill` に `type: "radial"`、正規化した `center`、短辺に対する0より大きく1以下の `radius`、線形と同じ `stops` を持つ放射状グラデーションも指定できる。
- `set_frame_style`: フレームの `fill`・`stroke`・`cornerRadii` と `clipContent` を変更。スタイルの形式は矩形と共通。
- `set_image_filters`: 画像の `filters` に明るさ・コントラスト・彩度・グレースケール・セピア・色相の変更項目を指定。未指定の項目は維持される。
- `set_text_style`: テキストの `fontSize`・`color`・`textAlign`・`fontFamily`（`default`・`system`・`serif`・`monospace`）・`fontWeight`（100〜900 の 100 刻み）・`lineHeight`（倍率）・`letterSpacing`（px、負値も可）を変更。
- `set_text_marks`: テキスト本文の UTF-16 範囲 `start`・`end` と、その範囲の `color`・`fontWeight`・`underline: true`・`code: true` を配列で指定して置換。範囲は昇順・非重複で文字境界に揃える。
- `delete_element` / `duplicate_element`: ID で削除・複製。フレームの子孫も対象に含み、複製した全要素の ID を再生成。

`get_state` を呼び、続けて `add_element` で名前付き矩形を追加する。返された名前と ID を使って `rename_element`・`move_element` を呼ぶと、画面にも変更が反映される。画面の「元に戻す」で操作を戻せることを確認する。存在しない ID を指定した場合はエラーとなり、ドキュメントは変わらない。

### 要素のスタイルと v1 の破壊的変更

要素参照（`ElementReference`）は `id`・`name`・`path`・`parentId`・`type`・座標・寸法と、種別ごとの `style` を返す。文字の `content`・`marks`、フレームの `clipContent`、画像の `source` はノード直下にある。画像の `source` は `get_element` で取得でき、要素一覧では省略する。

応答は既定値補完済み。たとえば線なしは `style.stroke: null`、角丸なしは4隅とも 0、標準の文字は `style.fontFamily: "default"`・`fontWeight: 400`・`lineHeight: 1.4`・`letterSpacing: 0` を返す。保存用 JSON ではこれらを省略するが、MCP の応答では省略しない。

スタイル変更ツールの引数は `id` と変更するスタイル項目を直接指定する。`stroke` と `cornerRadii` は、それぞれオブジェクト全体を置換する。

```text
set_shape_style {"id":"nd_...","fill":null,"stroke":{"color":"#123456","width":2}}
set_mask {"id":"nd_...","isMask":true}
set_frame_style {"id":"nd_...","fill":"#ffffff","stroke":null,"clipContent":false}
set_image_filters {"id":"nd_...","filters":{"brightness":1.2,"sepia":0.3}}
```

文書の `version` は 1 のまま。未リリースのため、以前の平坦な応答や `background`・`strokeWidth`・`cornerRadius` の引数には互換対応しない。詳細は [文書形式](document-format.md)を参照。

### 履歴の数値照会例

`list_revisions` を `{}` で呼び、応答の `revisions` から `isCurrent: true` の ID を取得する。`get_state` または `get_element` の要素 ID と組み合わせて、次のように照会する（ID は実際の応答に置き換える）。

```text
get_revision_element  {"revisionId":"rev_...","elementId":"nd_..."}
compare_revisions     {"fromRevisionId":"rev_...","toRevisionId":"rev_...","elementId":"nd_..."}
measure_elements      {"revisionId":"rev_...","firstId":"nd_...","secondId":"nd_..."}
```

計測応答には要素の `id`・`name`・`path`（親階層）・`parentId` と、`unit: "px"`、`localOrigin: "parent"`、`absoluteOrigin: "document"` が含まれる。`local` は親フレーム基準、`absolute` と要素間の間隔はドキュメント基準であり、ズームやスクロールには依存しない。比較の `delta` は `to - from` の符号付き値、`gapX` / `gapY` は重ならない軸の非負の距離。詳細は [リビジョンと数値計測](revision-history.md)を参照。

照会は編集履歴・未保存状態を変えない。無効な引数や存在しない時点・要素は MCP ツールエラーとして返る。リビジョンはアプリ起動中のメモリにだけ存在し、別のドキュメントを開くと入れ替わる。

キャンバスで要素をドラッグしている間は、プレビューを上書きしないよう MCP の編集ツールはエラーを返す。照会ツールは引き続き利用でき、ドラッグ終了後に編集を再試行できる。

## Nodi を使った変更の PR

MCP サーバーは接続時の指示と編集ツールの説明で、利用側の AI に次を伝える。

- 画面デザインや実装を変更して PR を作るときは、変更前・後の実画面を同じ画面・ビューポート・データで撮影し、PR 本文に `![Before](URL)` と `![After](URL)` として添付する。
- 画像は人間のレビュー用。AI は目視だけで正しさを判断せず、ID、座標、寸法などの数値とテストでも検証する。
- 撮影・添付ができない場合は画像を捏造せず、PR 作成前に利用者へ伝える。画面に変化のない PR はその理由を記載する。

MCP の指示は利用側クライアントへの依頼であり、利用側の `gh pr create` を技術的に止めるものではない。厳格に必須化する場合は、その利用側リポジトリの PR チェックが必要になる。
