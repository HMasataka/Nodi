import { useState } from "react";
import type { TextNode, TextStyle } from "@/document/types";

export function TextStyleEditor({ node: { style }, onChange }: { node: TextNode; onChange(style: Partial<TextStyle>): void }) {
  const [fontSize, setFontSize] = useState(String(style.fontSize));
  const [lineHeight, setLineHeight] = useState(String(style.lineHeight));
  const [letterSpacing, setLetterSpacing] = useState(String(style.letterSpacing));
  const [color, setColor] = useState(style.color);
  return <div className="text-style-fields">
    <label>フォント
      <select className="font-family-select" value={style.fontFamily}
        onChange={(event) => onChange({ fontFamily: event.currentTarget.value as TextStyle["fontFamily"] })}>
        <option value="default">標準</option><option value="system">システム</option>
        <option value="serif">セリフ</option><option value="monospace">等幅</option>
      </select>
    </label>
    <label>太さ
      <select value={style.fontWeight}
        onChange={(event) => onChange({ fontWeight: Number(event.currentTarget.value) })}>
        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
      </select>
    </label>
    <label>文字サイズ
      <input type="number" min="1" step="any" value={fontSize}
        onChange={(event) => setFontSize(event.currentTarget.value)}
        onBlur={() => { if (fontSize !== String(style.fontSize)) onChange({ fontSize: fontSize.trim() === "" ? NaN : Number(fontSize) }); }} />
    </label>
    <label>行高（倍）
      <input type="number" min="0.1" step="any" value={lineHeight}
        onChange={(event) => setLineHeight(event.currentTarget.value)}
        onBlur={() => { if (lineHeight !== String(style.lineHeight)) onChange({ lineHeight: lineHeight.trim() === "" ? NaN : Number(lineHeight) }); }} />
    </label>
    <label>字間（px）
      <input type="number" step="any" value={letterSpacing}
        onChange={(event) => setLetterSpacing(event.currentTarget.value)}
        onBlur={() => { if (letterSpacing !== String(style.letterSpacing)) onChange({ letterSpacing: letterSpacing.trim() === "" ? NaN : Number(letterSpacing) }); }} />
    </label>
    <label>文字色
      <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)}
        onBlur={() => { if (color !== style.color) onChange({ color }); }} />
    </label>
    <label>揃え
      <select value={style.textAlign} onChange={(event) => onChange({ textAlign: event.currentTarget.value as TextStyle["textAlign"] })}>
        <option value="left">左</option><option value="center">中央</option><option value="right">右</option>
      </select>
    </label>
    <p>標準は Avenir Next を優先し、利用できないフォントは代替フォントで表示します。字間は負値でも指定できます。枠の幅で折り返し、高さを超えた本文は隠れます。枠の高さは「位置・サイズ」で変更できます。</p>
  </div>;
}
