import type { FrameLayoutPatch } from "@/document/commands/index.ts";
import type { DocumentNode, FrameStyle, ImageStyle, PathFillRule, RectangleStyle, SpacingToken, TextMarkRangeEdit, TextStyle, VectorPathCommand } from "@/document/types";

import { CornerRadiiEditor } from "@/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor";
import { FrameLayoutEditor } from "@/pages/editor/components/molecules/FrameLayoutEditor";
import { FrameStyleEditor } from "@/pages/editor/components/molecules/FrameStyleEditor";
import { ImageStyleEditor } from "@/pages/editor/components/molecules/ImageStyleEditor";
import { PathPointEditor } from "@/pages/editor/components/molecules/PathPointEditor";
import { ShapeStyleEditor } from "@/pages/editor/components/molecules/ShapeStyleEditor";
import { TextAppearance } from "@/pages/editor/components/molecules/ElementAppearance/TextAppearance";

interface ElementAppearanceProps {
  node: DocumentNode;
  spacingTokens?: SpacingToken[];
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onTextMarkRange(edit: TextMarkRangeEdit): void;
  onShapeStyle(style: Partial<RectangleStyle>): void;
  onFrameStyle(style: Partial<FrameStyle>): void;
  onFrameLayout(patch: FrameLayoutPatch): void;
  onImageStyle(style: Partial<ImageStyle>): void;
  onPath(patch: { commands?: VectorPathCommand[]; fillRule?: PathFillRule }): void;
}

export function ElementAppearance({ node, spacingTokens = [], onTextContent, onTextStyle, onTextMarkRange, onShapeStyle, onFrameStyle, onFrameLayout, onImageStyle, onPath }: ElementAppearanceProps) {
  if (node.type === "image") return <>
    <div className="field-label">画像の表示</div>
    <ImageStyleEditor key={`${node.id}:${node.style.fit}:${JSON.stringify(node.style.focalPoint)}`} node={node} onChange={onImageStyle} />
    <CornerRadiiEditor key={`${node.id}:${JSON.stringify(node.style.cornerRadii)}`} radii={node.style.cornerRadii} onChange={(cornerRadii) => onImageStyle({ cornerRadii })} />
    <p className="property-help">画像データは `.nodi` ファイル内に埋め込まれています。</p>
  </>;
  if (node.type === "text") return <TextAppearance key={node.id} node={node} onTextContent={onTextContent}
    onTextStyle={onTextStyle} onTextMarkRange={onTextMarkRange} />;
  if (node.type === "frame") return <>
    <FrameLayoutEditor key={`${node.id}:${node.layoutMode}:${node.padding}:${node.gap}:${node.paddingRef}:${node.gapRef}:${spacingTokens.map((token) => `${token.id}:${token.name}:${token.value}`).join(":")}:${node.alignItems}:${node.justifyContent}`}
      node={node} tokens={spacingTokens} onChange={onFrameLayout} />
    <div className="field-label">フレームの見た目</div>
    <FrameStyleEditor key={`${node.id}:${JSON.stringify(node.style)}:${node.clipContent}`} node={node} onChange={onFrameStyle} />
  </>;
  if (node.type === "path") return <>
    <div className="field-label">スタイル</div>
    <ShapeStyleEditor key={`${node.id}:${JSON.stringify(node.style)}`} node={node} onChange={onShapeStyle} />
    <PathPointEditor node={node} onChange={onPath} />
  </>;
  if (node.type === "instance") return null;
  return <>
    <div className="field-label">スタイル</div>
    <ShapeStyleEditor key={`${node.id}:${JSON.stringify(node.style)}`} node={node} onChange={onShapeStyle} />
  </>;
}
