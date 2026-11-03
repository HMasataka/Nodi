import { resolvedTextFont } from "@/document/textFonts.ts";
import { DEFAULT_TEXT_LETTER_SPACING, type TextNode } from "@/document/types.ts";
import { graphemeSegments, wrapText } from "@/document/textLayout.ts";

export function layoutTextLines(ctx: CanvasRenderingContext2D, node: TextNode) {
  const font = resolvedTextFont(node);
  ctx.font = `${font.fontWeight} ${node.fontSize}px ${font.fontFamily}`;
  const letterSpacing = node.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING;
  const nativeSpacing = "letterSpacing" in ctx;
  if (nativeSpacing) ctx.letterSpacing = `${letterSpacing}px`;
  const measure = (text: string) => ctx.measureText(text).width + (nativeSpacing ? 0 : graphemeSegments(text).length * letterSpacing);
  return { lines: wrapText(node.content, node.width - 4, measure), nativeSpacing, letterSpacing };
}
