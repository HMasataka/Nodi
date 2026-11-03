import type { DocumentNode, FrameStyle, RectangleStyle, TextStyle } from "@/document/types";

import { ContentEditor } from "@/pages/editor/components/atoms/ContentEditor";
import { FrameStyleEditor } from "@/pages/editor/components/molecules/FrameStyleEditor";
import { ShapeStyleEditor } from "@/pages/editor/components/molecules/ShapeStyleEditor";
import { TextStyleEditor } from "@/pages/editor/components/molecules/TextStyleEditor";

interface ElementAppearanceProps {
  node: DocumentNode;
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onShapeStyle(style: Partial<RectangleStyle>): void;
  onFrameStyle(style: Partial<FrameStyle>): void;
}

export function ElementAppearance({ node, onTextContent, onTextStyle, onShapeStyle, onFrameStyle }: ElementAppearanceProps) {
  if (node.type === "image") return <p className="property-help">画像データは `.nodi` ファイル内に埋め込まれています。</p>;
  if (node.type === "text") return <>
    <div className="field-label">本文</div>
    <ContentEditor key={`${node.id}:${node.content}`} node={node} onChange={onTextContent} />
    <div className="field-label">文字の見た目</div>
    <TextStyleEditor key={`${node.id}:${node.fontSize}:${node.color}:${node.textAlign}:${node.fontFamily}:${node.fontWeight}:${node.lineHeight}:${node.letterSpacing}`} node={node} onChange={onTextStyle} />
  </>;
  if (node.type === "frame") return <>
    <div className="field-label">フレームの見た目</div>
    <FrameStyleEditor key={`${node.id}:${node.background}:${node.clipContent}`} node={node} onChange={onFrameStyle} />
  </>;
  return <>
    <div className="field-label">スタイル</div>
    <ShapeStyleEditor key={`${node.id}:${node.fill}:${node.stroke}:${node.strokeWidth}:${node.type === "rectangle" ? node.cornerRadius : "ellipse"}`} node={node} onChange={onShapeStyle} />
  </>;
}
