import { useState } from "react";
import type { EllipseNode, RectangleNode, RectangleStyle } from "../../../../../document/types";

export function ShapeStyleEditor({ node, onChange }: { node: RectangleNode | EllipseNode; onChange(style: Partial<RectangleStyle>): void }) {
  const [fill, setFill] = useState(node.fill);
  const [stroke, setStroke] = useState(node.stroke);
  const [strokeWidth, setStrokeWidth] = useState(String(node.strokeWidth));
  const [cornerRadius, setCornerRadius] = useState(node.type === "rectangle" ? String(node.cornerRadius) : "");
  return <div className="style-fields">
    <label>塗り <input type="color" value={fill} onChange={(event) => setFill(event.currentTarget.value)} onBlur={() => { if (fill !== node.fill) onChange({ fill }); }} /></label>
    <label>線 <input type="color" value={stroke} onChange={(event) => setStroke(event.currentTarget.value)} onBlur={() => { if (stroke !== node.stroke) onChange({ stroke }); }} /></label>
    <label>線幅 <input type="number" min="0" step="any" value={strokeWidth} onChange={(event) => setStrokeWidth(event.currentTarget.value)} onBlur={() => { if (strokeWidth !== String(node.strokeWidth)) onChange({ strokeWidth: strokeWidth.trim() === "" ? NaN : Number(strokeWidth) }); }} /></label>
    {node.type === "rectangle" && <label>角丸 <input type="number" min="0" step="any" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} onBlur={() => { if (cornerRadius !== String(node.cornerRadius)) onChange({ cornerRadius: cornerRadius.trim() === "" ? NaN : Number(cornerRadius) }); }} /></label>}
  </div>;
}
