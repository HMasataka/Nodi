import { BorderEditor } from "@/pages/editor/components/molecules/BorderEditor/BorderEditor.tsx";
import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { CornerRadiiEditor } from "@/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor";
import { FillEditor } from "@/pages/editor/components/molecules/FillEditor";
import { useState } from "react";
import type { EllipseNode, PathNode, RectangleNode, RectangleStyle } from "@/document/types";

export function ShapeStyleEditor({ node, onChange }: { node: RectangleNode | EllipseNode | PathNode; onChange(style: Partial<RectangleStyle>): void }) {
  const [strokeWidth, setStrokeWidth] = useState(String(node.style.stroke?.width ?? 0));
  return <div className="style-fields">
    <FillEditor label="塗り" fill={node.style.fill} onChange={(fill) => onChange({ fill })} />
    <ColorField label="線" value={node.style.stroke?.color ?? null} fallback="#000000"
      onChange={(color) => onChange({ stroke: { color, width: node.style.stroke?.width ?? 1 } })} />
    <label>線幅 <input type="number" min="0" step="any" value={strokeWidth} onChange={(event) => setStrokeWidth(event.currentTarget.value)} onBlur={() => { if (strokeWidth !== String(node.style.stroke?.width ?? 0)) onChange({ stroke: { color: node.style.stroke?.color ?? "#000000", width: strokeWidth.trim() === "" ? NaN : Number(strokeWidth) } }); }} /></label>
    {node.type === "rectangle" && <CornerRadiiEditor radii={node.style.cornerRadii} onChange={(cornerRadii) => onChange({ cornerRadii })} />}
    {node.type === "rectangle" && <BorderEditor style={node.style} onChange={(border) => onChange({ border })} />}
  </div>;
}
