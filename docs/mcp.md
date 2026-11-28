# MCP から Nodi を操作する

Nodi デスクトップアプリを起動すると、外部 MCP クライアントから接続できる。MCP サーバーは stdio で動作し、選択したローカルの Nodi アプリのメモリ上の文書を操作する。複数アプリの同時起動に対応し、無題の文書も対象にできる。`pnpm dev` のブラウザ表示だけでは接続できない。

## 接続

1. `pnpm tauri dev` で Nodi を起動する。
2. MCP クライアントのサーバー設定で、`node` と Nodi リポジトリ内の `scripts/mcp-server.ts` の絶対パスを指定する。
3. クライアントを再起動し、`nodi` サーバーのツールが表示されることを確認する。
4. `list_instances` を呼び、起動中のアプリと文書を確認する。
5. 一覧の `instanceId` と `documentSessionId` を `select_instance` へ渡して対象を選ぶ。アプリが1つでも選択は必須。

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

各アプリはユーザーの設定ディレクトリの `com.hmasataka.nodi/instances/<instanceId>.json` に、自分の接続情報（ID・PID・ポート・トークン）を登録する。macOSの既定の親ディレクトリは `~/Library/Application Support`。MCPサーバーが読む登録ディレクトリは環境変数 `NODI_INSTANCES_DIR` で指定できる。登録ファイルには接続トークンが入るため、リポジトリへ追加しない。

## 対象アプリと文書の選択

`list_instances` は各登録先へ問い合わせ、`instances` に `instanceId`、`pid`、`documentSessionId`、`filePath`、`documentName`、`ready` を返す。未保存の文書は `filePath: null`。復元確認中のアプリも表示するが `ready: false` の間は選択できない。ポートとトークンは返さない。応答がない、または登録が不正な項目は一覧から除き、件数を `unavailable` で返す。登録ディレクトリ自体を読めない場合はエラーになる。

```text
list_instances {}
select_instance {"instanceId":"一覧で得たアプリID","documentSessionId":"一覧で得た文書セッションID"}
get_state {}
```

- 選択先はMCPサーバープロセスごとに独立して保持する。別アプリの起動、ウィンドウの前面化、一覧の再取得では変わらない。
- 接続情報は選択時に固定する。各要求はその時点の選択先へ送信し、別アプリへの自動切り替えや失敗した編集の自動再送はしない。
- 文書を開く／復元すると、新しい `documentSessionId` を発行する。同じファイルを開き直した場合も変わる。通常の編集・保存・Undo/Redoでは変わらない。
- 取得・選択・編集ツールのすべてで文書セッションをアプリ側の実行直前に照合する。不一致なら文書を変更せず、MCP側の選択を解除する。再び一覧を取得し、選び直す。
- 対象終了や通信タイムアウトでも選択を解除する。タイムアウトは「編集されなかった」保証ではないため、再選択後に状態を確認する。`select_instance` 自体が失敗した場合も以前の選択は維持しない。
- アプリが正常終了すると自分の登録だけを削除する。異常終了で残った登録は接続確認で一覧から除外するが、MCP側ではファイルを削除しない。再起動は別IDとなり再選択が必要。
- これはMCPの接続対象を分離する仕組みであり、文書の共同編集・同期やファイルの開閉・保存を提供するものではない。保存はアプリ上で行う。

## ツールと確認手順

- `list_instances`: 起動中のNodiと現在の文書を一覧取得する。
- `select_instance`: アプリIDと文書セッションIDで操作対象を固定する。文書や履歴は変更しない。
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
- `set_visible`: 要素の表示 `visible` を真偽値で切り替える。隠した要素は編集画面・PNG 書き出しに描かず、範囲選択・スナップ・自動レイアウトの計算からも外す。レイヤー一覧と `get_state` の要素一覧には残る。隠したマスクは兄弟を切り抜かない。
- `set_opacity`: 要素全体の不透明度 `opacity` を0〜1で設定する。フレームは子を含むグループに適用する。
- `set_shadow`: 要素全体の外側影を `{ color, offsetX, offsetY, blur }` で設定する。`null` で解除する。色は6桁／8桁HEX、ぼかしは0以上。
- `set_blur`: 要素全体のぼかしの標準偏差 `blur` を0以上のpx値で指定する。0で解除する。画像の色調整フィルターとは別。
- `set_shape_style`・`set_frame_style` の `fill` は単色や `null` のほか、`type: "linear"`、正規化した `start`・`end`、2個以上の `{ position, color }` の `stops` を持つ線形グラデーションを指定できる。
- `add_element` は `type: "path"` と `commands`、省略可能な `fillRule` に対応する。`set_path` でパスの命令列と塗り規則を更新でき、`set_shape_style` でパスの塗りと線も編集できる。パスの点は要素の幅・高さに対するローカル座標で、曲線は `cubic` 命令を使う。
- `fill` に `type: "radial"`、正規化した `center`、短辺に対する0より大きく1以下の `radius`、線形と同じ `stops` を持つ放射状グラデーションも指定できる。
- `set_frame_style`: フレームの `fill`・`stroke`・`cornerRadii` と `clipContent` を変更。スタイルの形式は矩形と共通。
- `set_image_filters`: 画像の `filters` に明るさ・コントラスト・彩度・グレースケール・セピア・色相の変更項目を指定。未指定の項目は維持される。
- `set_text_style`: テキストの `fontSize`・`color`・`textAlign`・`fontFamily`（`default`・`system`・`serif`・`monospace`）・`fontWeight`（100〜900 の 100 刻み）・`lineHeight`（倍率）・`letterSpacing`（px、負値も可）を変更。
- `set_text_marks`: テキスト本文の UTF-16 範囲 `start`・`end` と、その範囲の `color`・`fontWeight`・`underline: true`・`code: true` を配列で指定して置換。範囲は昇順・非重複で文字境界に揃える。
- `delete_element` / `duplicate_element`: ID で削除・複製。フレームの子孫も対象に含み、複製した全要素の ID を再生成。
- `list_palette`: 文書のカラーパレット一覧（`id`・`name`・6/8桁HEX の `color`）を取得。
- `add_palette_color`: `name` と6/8桁HEXの `color` でパレット色を追加。同名の色も許可する。
- `rename_palette_color`: ID と新しい `name` で改名。参照は ID なので、名前を変えても壊れない。
- `set_palette_color`: ID と6/8桁HEXの `color` で色を変更し、参照する要素へ一括反映。
- `remove_palette_color`: ID で削除。参照している要素は解決済みの直接 HEX に変換してから削除する。
- `duplicate_palette_color`: ID で複製し、新しい ID を割り当てる（名前は「◯ のコピー」）。テーマごとの値も写す。
- `list_themes`: テーマ名の一覧 `{ themes }` を取得する。最初のテーマが既定。
- `set_themes`: `themes`（テーマ名の配列）で一覧を置き換える。パレット色の `color` は最初のテーマの値になる。外したテーマと新しい最初のテーマの、パレット色の値は消える。フレームが使っているテーマは外せない。空の配列でテーマをなくす。
- `rename_theme`: `from`・`to` でテーマの名前を変え、パレット色の値とフレームの `theme` も付け替える。
- `set_palette_theme_color`: `id`・`theme`・`color`（6/8桁HEX）で、パレット色の最初以外のテーマの値を設定する。`color: null` で値を外し、`color` を使うようにする。最初のテーマの値は `set_palette_color` で変える。
- `set_frame_theme`: `id`・`theme` でフレームのテーマを指定し、自身と子孫の色参照をそのテーマで解決する。`theme: null` で指定を外し、親のテーマに従う。

色は直接の6/8桁HEXか、`{ "type": "palette", "id": "pc_..." }` のパレット参照で指定できる。参照の ID は `list_palette` で得る。名前を変えても参照は ID で解決されるため壊れない。`get_state` はテーマ名の一覧 `themes` も返す。パレット一覧の各色はテーマごとの値 `themes` を含み、フレームの要素参照はテーマの指定 `theme` を含む。`get_state` / `get_element` は色参照とパレット一覧（解決後の HEX）を返し、編集画面・PNG と同じ色に解決する。参照を直接指定へ戻すには、その色に直接 HEX を指定し直す。存在しない ID への参照は保存・読み込みで拒否する。

### コンポーネントとインスタンス

- `list_components`: 文書のコンポーネント定義（`id`・`name`・子要素ツリー）を一覧取得する。
- `create_component`: `sourceId`（フレームの ID）と `name` でコンポーネント定義を作成する。フレームと子要素から新しい ID の定義ツリーを複製する。
- `rename_component`: 表示名を変更する。参照は ID で行うため、名前変更でインスタンスの参照は壊れない。
- `remove_component`: 未使用の定義を削除する。インスタンスが参照している定義は拒否する（先に `detach_instance` または削除が必要）。
- `duplicate_component`: 定義を複製し、定義と子ツリーに新しい ID を割り当てる。
- `add_instance`: `componentRef`・`x`・`y`（省略可能な `width`・`height`・`parentId`・`name`）でインスタンスを配置する。幅・高さの省略時は定義の寸法を使う。
- `set_instance_override`: `id`（インスタンス）・`childId`（定義の子要素 ID、または入れ子のインスタンスの中を指す `入れ子のインスタンスID/子のID`）と変更属性でオーバーライドする。属性は `content`・`fill`・`stroke`・`color`・`source`・`width`・`height`・`visible`・`opacity`・`cornerRadii`・フレームの `layoutMode`・`padding`・`gap`・`alignItems`・`justifyContent`・テキストの `fontSize`・`fontWeight`・`fontFamily`・`lineHeight`・`letterSpacing`・`textAlign`。要素の種類ごとに指定できる属性は [文書形式](document-format.md) のとおりで、合わない属性はエラーになる。`visible: true` で、定義では隠した子をこのインスタンスでだけ出せる。
- `reset_instance_override`: 指定した子（パスも可）のオーバーライドを解除し、定義側の値へ戻す。存在しないパスはエラーになる。
- `detach_instance`: インスタンスをその時点の解決済み表示のまま通常要素へ切り離す。切り離したツリーには新しい ID を割り当てる。
- `set_component_slot`: `componentId`・`nodeId`（定義の中のフレーム）・`slot`（真偽値）で、定義のフレームに slot の印を付ける・外す。子は既定の中身になる。外すと、そのフレームを指していたインスタンスの差し替えも外れる。
- `fill_slot`: `id`（インスタンス）・`slotId`（slot のフレームの ID、入れ子は `入れ子のインスタンスID/slotのID`）・`nodeIds` で、slot の中身を文書の要素に差し替える。要素は元の場所から移し、ID はそのまま保つ。前の中身のうち `nodeIds` に含めなかったものは消える。空の配列で slot を空にする。インスタンス自身やその親は入れられない。差し替えた中身の要素は要素一覧に並び（`parentId` はインスタンス）、普段のツールで個別に編集できる。インスタンスの要素参照は `slots`（slot ごとの直下の要素 ID）を返す。
- `reset_slot`: `id`・`slotId` で差し替えを外し、定義の既定の中身に戻す。差し替えていた中身は消える。

`get_state` を呼び、続けて `add_element` で名前付き矩形を追加する。返された名前と ID を使って `rename_element`・`move_element` を呼ぶと、画面にも変更が反映される。画面の「元に戻す」で操作を戻せることを確認する。存在しない ID を指定した場合はエラーとなり、ドキュメントは変わらない。

`select_element` の `scrollLeft` / `scrollTop` は、文書原点に対する画面px単位の仮想表示オフセット。負値も返す。DOMのスクロール位置ではなく、画面座標は `文書座標 × zoom − オフセット` で求める。位置は自動レイアウト解決後の文書から計算する。要素・パスの点のドラッグやパン中は、表示位置の変更を拒否する。

### 要素のスタイルと v1 の破壊的変更

要素参照（`ElementReference`）は `id`・`name`・`path`・`parentId`・`type`・座標・寸法・表示（`visible`）と、種別ごとの `style` を返す。文字の `content`・`marks`、フレームの `clipContent`、画像の `source` はノード直下にある。画像の `source` は `get_element` で取得でき、要素一覧では省略する。

応答は既定値補完済み。たとえば線なしは `style.stroke: null`、角丸なしは4隅とも 0、標準の文字は `style.fontFamily: "default"`・`fontWeight: 400`・`lineHeight: 1.4`・`letterSpacing: 0` を返す。保存用 JSON ではこれらを省略するが、MCP の応答では省略しない。

スタイル変更ツールの引数は `id` と変更するスタイル項目を直接指定する。`stroke` と `cornerRadii` は、それぞれオブジェクト全体を置換する。

```text
set_shape_style {"id":"nd_...","fill":null,"stroke":{"color":"#123456","width":2}}
set_mask {"id":"nd_...","isMask":true}
set_visible {"id":"nd_...","visible":false}
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
