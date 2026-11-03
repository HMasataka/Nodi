import type { DocumentNode, FrameStyle, RectangleStyle, TextMarkRangeEdit, TextStyle } from "@/document/types";

import { FrameStyleEditor } from "@/pages/editor/components/molecules/FrameStyleEditor";
import { ShapeStyleEditor } from "@/pages/editor/components/molecules/ShapeStyleEditor";
import { TextAppearance } from "@/pages/editor/components/molecules/ElementAppearance/TextAppearance";

interface ElementAppearanceProps {
  node: DocumentNode;
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onTextMarkRange(edit: TextMarkRangeEdit): void;
  onShapeStyle(style: Partial<RectangleStyle>): void;
  onFrameStyle(style: Partial<FrameStyle>): void;
}

export function ElementAppearance({ node, onTextContent, onTextStyle, onTextMarkRange, onShapeStyle, onFrameStyle }: ElementAppearanceProps) {
  if (node.type === "image") return <p className="property-help">画像データは `.nodi` ファイル内に埋め込まれています。</p>;
  if (node.type === "text") return <TextAppearance key={node.id} node={node} onTextContent={onTextContent}
    onTextStyle={onTextStyle} onTextMarkRange={onTextMarkRange} />;
  if (node.type === "frame") return <>
    <div className="field-label">フレームの見た目</div>
    <FrameStyleEditor key={`${node.id}:${node.background}:${node.clipContent}`} node={node} onChange={onFrameStyle} />
  </>;
  return <>
    <div className="field-label">スタイル</div>
    <ShapeStyleEditor key={`${node.id}:${node.fill}:${node.stroke}:${node.strokeWidth}:${node.type === "rectangle" ? node.cornerRadius : "ellipse"}`} node={node} onChange={onShapeStyle} />
  </>;
}
