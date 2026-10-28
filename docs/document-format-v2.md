# Nodi ドキュメント形式 v2

`.nodi` は JSON ファイル。v2 では矩形に塗り・線・角丸を追加する。フレームと ID・名前・座標の規則は [v1 の仕様](document-format.md) と同じ。

## 矩形の追加項目

| 項目 | 型 | 規則 |
| --- | --- | --- |
| `fill` | 文字列 | `#RRGGBB` 形式の塗り色 |
| `stroke` | 文字列 | `#RRGGBB` 形式の線色 |
| `strokeWidth` | 数値 | 0 以上の有限値 |
| `cornerRadius` | 数値 | 0 以上の有限値 |

矩形ではこれらの項目がすべて必須。フレームには付けない。ルートの `version` は `2` とする。

```json
{
  "version": 2,
  "children": [
    {
      "id": "nd_example",
      "name": "ボタン",
      "type": "rectangle",
      "x": 24,
      "y": 40,
      "width": 160,
      "height": 48,
      "fill": "#f3d9c8",
      "stroke": "#d9bbaa",
      "strokeWidth": 1,
      "cornerRadius": 2
    }
  ]
}
```

## v1 からの読み込み

読み込み時は v1 を厳密に検証してから、各矩形に上記の既定値を追加する。ID、名前、親子関係、座標は変更しない。保存時は v2 として書き出す。未知のバージョンは拒否する。
