import type { DocumentNode, FrameStyle, ImageStyle, RectangleStyle, TextMarkRangeEdit, TextStyle } from "@/document/types";

import { CornerRadiiEditor } from "@/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor";
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
  onImageStyle(style: Partial<ImageStyle>): void;
}

export function ElementAppearance({ node, onTextContent, onTextStyle, onTextMarkRange, onShapeStyle, onFrameStyle, onImageStyle }: ElementAppearanceProps) {
  if (node.type === "image") return <>
    <p className="property-help">画像データは `.nodi` ファイル内に埋め込まれています。</p>
    <CornerRadiiEditor key={`${node.id}:${JSON.stringify(node.style)}`} radii={node.style.cornerRadii} onChange={(cornerRadii) => onImageStyle({ cornerRadii })} />
  </>;
  if (node.type === "text") return <TextAppearance key={node.id} node={node} onTextContent={onTextContent}
    onTextStyle={onTextStyle} onTextMarkRange={onTextMarkRange} />;
  if (node.type === "frame") return <>
    <div className="field-label">フレームの見た目</div>
    <FrameStyleEditor key={`${node.id}:${JSON.stringify(node.style)}:${node.clipContent}`} node={node} onChange={onFrameStyle} />
  </>;
  return <>
    <div className="field-label">スタイル</div>
    <ShapeStyleEditor key={`${node.id}:${JSON.stringify(node.style)}`} node={node} onChange={onShapeStyle} />
  </>;
}
