# フレームの PNG 書き出し

1. エディタでフレームを選択する。
2. プロパティの「PNG に書き出す」を押し、保存先を選ぶ。

出力サイズはフレームの幅・高さをピクセル単位に丸めた値。フレームの設定した背景色を描き、子要素を階層順に描く。入れ子フレームも背景色と「はみ出しを表示」設定を反映し、クリップが有効なフレームの外にある子要素は切り取る。書き出し対象フレーム自体の外側は PNG のサイズを超えるため含まれない。矩形・楕円・テキスト・埋め込み画像を対象とし、画像は枠を覆うように中央で切り取る。テキストは枠幅で折り返し、枠高を超える部分は表示しない。

グリッド、選択枠、リサイズハンドル、要素名などの編集 UI は書き出さない。保存をキャンセルした場合や描画・書き込みに失敗した場合も、`.nodi` の編集内容は変わらない。

実装はブラウザの [Canvas 2D API の `roundRect()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect)・[`drawImage()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage) で描き、[`toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) で PNG にする。`toBlob()` は生成できない場合に `null` を返すため失敗として扱う。保存先は [Tauri Dialog](https://v2.tauri.app/plugin/dialog/) で選ぶ。
