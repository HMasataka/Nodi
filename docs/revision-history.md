# 編集履歴のリビジョン ID

起動中の各編集状態には不変の `rev_` で始まる ID を付ける。初期状態も1つのリビジョンとして扱い、新しい編集にはその時点のリビジョンを親 ID として記録する。

- `listRevisions(history)` は作成順に ID、親 ID、現在・保存済みかどうかを返す。
- `getRevision(history, id)` は指定時点のドキュメントのコピーを返す。呼び出し側が変更しても履歴は変わらない。
- Undo / Redo は既存の操作感を保つ。Undo 後に別の編集へ分岐した場合、Redo は新しい分岐へ移るが、以前の分岐も ID を指定して照会できる。
- 保存中に編集が進んだ場合も、保存されたスナップショットがコミット時にリビジョンと対応する。保存済み表示は従来どおりドキュメントのスナップショットで判定する。
- 別の `.nodi` ファイルを開くと履歴を新しく作る。前のファイルの ID が新しい履歴の別時点を指すことはない。

リビジョンは `.nodi` ファイルに保存せず、アプリが起動している間のメモリに保持する。

## 数値計測

`src/document/measure.ts` の読み取り専用関数で、リビジョン ID と要素 ID を指定する。値の単位はドキュメント上の px。画面のズーム倍率やスクロール位置は含まない。

- `measureElementAtRevision` はその時点の名前・親階層と、親基準の `local` 座標・寸法、キャンバス基準の `absolute` 境界（四辺・中心）を返す。絶対座標はすべての親フレームの X・Y を加算する。
- `compareElementRevisions` は同じ要素 ID の2時点を比較し、`to - from` の符号付き差分を `local` と `absolute` で返す。親フレームだけが移動した場合はローカル差分が 0、絶対差分が移動量になる。
- `measureRelativeAtRevision` は同じ時点の2要素を絶対境界で比較する。`centerDelta` は `second - first`、`gapX` と `gapY` は離れている軸の非負の距離（重なる軸は 0）、`overlap.area` は重なり面積。`horizontal` と `vertical` は2番目の要素が1番目から見てどちら側にあるかを示す。

存在しないリビジョン、該当時点に存在しない要素、同じ要素 ID を2つ指定した相対計測は失敗を返す。計測で現在の編集内容や履歴は変わらない。MCP からは `list_revisions`・`get_revision_element`・`compare_revisions`・`measure_elements` で照会できる（[接続と利用例](mcp.md)）。
