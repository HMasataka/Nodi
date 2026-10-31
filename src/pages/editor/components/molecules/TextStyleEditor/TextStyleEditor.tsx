import { useState } from "react";
import type { TextNode, TextStyle } from "@/document/types";

export function TextStyleEditor({ node, onChange }: { node: TextNode; onChange(style: Partial<TextStyle>): void }) {
  const [fontSize, setFontSize] = useState(String(node.fontSize));
  const [color, setColor] = useState(node.color);
  return <div className="text-style-fields">
    <label>文字サイズ
      <input type="number" min="1" step="any" value={fontSize}
        onChange={(event) => setFontSize(event.currentTarget.value)}
        onBlur={() => { if (fontSize !== String(node.fontSize)) onChange({ fontSize: fontSize.trim() === "" ? NaN : Number(fontSize) }); }} />
    </label>
    <label>文字色
      <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)}
        onBlur={() => { if (color !== node.color) onChange({ color }); }} />
    </label>
    <label>揃え
      <select value={node.textAlign} onChange={(event) => onChange({ textAlign: event.currentTarget.value as TextStyle["textAlign"] })}>
        <option value="left">左</option><option value="center">中央</option><option value="right">右</option>
      </select>
    </label>
    <p>枠の幅で折り返し、高さを超えた本文は隠れます。枠の高さは「位置・サイズ」で変更できます。</p>
  </div>;
}
