import type { DocumentNode, FrameStyle, ImageStyle, RectangleStyle, TextMarkRangeEdit, TextStyle } from "@/document/types";

import { FrameStyleEditor } from "@/pages/editor/components/molecules/FrameStyleEditor";
import { ImageStyleEditor } from "@/pages/editor/components/molecules/ImageStyleEditor";
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
    <div className="field-label">画像の表示</div>
    <ImageStyleEditor key={`${node.id}:${JSON.stringify(node.style)}`} node={node} onChange={onImageStyle} />
    <p className="property-help">画像データは `.nodi` ファイル内に埋め込まれています。</p>
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
