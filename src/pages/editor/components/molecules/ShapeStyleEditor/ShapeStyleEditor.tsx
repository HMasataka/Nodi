import { BorderEditor } from "@/pages/editor/components/molecules/BorderEditor/BorderEditor.tsx";
import { CornerRadiiEditor } from "@/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor";
import { useState } from "react";
import type { EllipseNode, RectangleNode, RectangleStyle } from "@/document/types";

export function ShapeStyleEditor({ node, onChange }: { node: RectangleNode | EllipseNode; onChange(style: Partial<RectangleStyle>): void }) {
  const [fill, setFill] = useState(node.style.fill ?? "#ffffff");
  const [stroke, setStroke] = useState(node.style.stroke?.color ?? "#000000");
  const [strokeWidth, setStrokeWidth] = useState(String(node.style.stroke?.width ?? 0));
  return <div className="style-fields">
    <label>塗り <input type="color" value={fill} onChange={(event) => setFill(event.currentTarget.value)} onBlur={() => { if (fill !== (node.style.fill ?? "#ffffff")) onChange({ fill }); }} /></label>
    <label>線 <input type="color" value={stroke} onChange={(event) => setStroke(event.currentTarget.value)} onBlur={() => { if (stroke !== (node.style.stroke?.color ?? "#000000")) onChange({ stroke: { color: stroke, width: node.style.stroke?.width ?? 1 } }); }} /></label>
    <label>線幅 <input type="number" min="0" step="any" value={strokeWidth} onChange={(event) => setStrokeWidth(event.currentTarget.value)} onBlur={() => { if (strokeWidth !== String(node.style.stroke?.width ?? 0)) onChange({ stroke: { color: stroke, width: strokeWidth.trim() === "" ? NaN : Number(strokeWidth) } }); }} /></label>
    {node.type === "rectangle" && <CornerRadiiEditor radii={node.style.cornerRadii} onChange={(cornerRadii) => onChange({ cornerRadii })} />}
    {node.type === "rectangle" && <BorderEditor style={node.style} onChange={(border) => onChange({ border })} />}
  </div>;
}
