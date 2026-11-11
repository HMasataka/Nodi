import { useState } from "react";
import type { EllipseNode, RectangleNode, RectangleStyle } from "@/document/types";

export function ShapeStyleEditor({ node, onChange }: { node: RectangleNode | EllipseNode; onChange(style: Partial<RectangleStyle>): void }) {
  const [fill, setFill] = useState(node.style.fill ?? "#ffffff");
  const [stroke, setStroke] = useState(node.style.stroke?.color ?? "#000000");
  const [strokeWidth, setStrokeWidth] = useState(String(node.style.stroke?.width ?? 0));
  const [cornerRadius, setCornerRadius] = useState(node.type === "rectangle" ? String(node.style.cornerRadii.topLeft) : "");
  return <div className="style-fields">
    <label>塗り <input type="color" value={fill} onChange={(event) => setFill(event.currentTarget.value)} onBlur={() => { if (fill !== (node.style.fill ?? "#ffffff")) onChange({ fill }); }} /></label>
    <label>線 <input type="color" value={stroke} onChange={(event) => setStroke(event.currentTarget.value)} onBlur={() => { if (stroke !== (node.style.stroke?.color ?? "#000000")) onChange({ stroke: { color: stroke, width: node.style.stroke?.width ?? 1 } }); }} /></label>
    <label>線幅 <input type="number" min="0" step="any" value={strokeWidth} onChange={(event) => setStrokeWidth(event.currentTarget.value)} onBlur={() => { if (strokeWidth !== String(node.style.stroke?.width ?? 0)) onChange({ stroke: { color: stroke, width: strokeWidth.trim() === "" ? NaN : Number(strokeWidth) } }); }} /></label>
    {node.type === "rectangle" && <label>角丸 <input type="number" min="0" step="any" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} onBlur={() => { if (cornerRadius !== String(node.style.cornerRadii.topLeft)) { const radius = cornerRadius.trim() === "" ? NaN : Number(cornerRadius); onChange({ cornerRadii: { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius } }); } }} /></label>}
  </div>;
}
