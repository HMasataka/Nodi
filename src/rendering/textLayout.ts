import { resolvedTextFont } from "@/document/textFonts.ts";
import { graphemeSegments, type TextUnit, wrapTextUnits } from "@/document/textLayout.ts";
import type { TextMark, TextNode } from "@/document/types.ts";

export interface TextFragment { text: string; mark: TextMark | null; width: number }
export interface TextLine { fragments: TextFragment[]; width: number }

export function textFragmentStyle(node: TextNode, mark: TextMark | null) {
  const font = resolvedTextFont({ fontFamily: mark?.code ? "monospace" : node.style.fontFamily,
    fontWeight: mark?.fontWeight ?? node.style.fontWeight });
  return { ...font, color: mark?.color ?? node.style.color, underline: mark?.underline === true, code: mark?.code === true };
}

export function layoutTextLines(ctx: CanvasRenderingContext2D, node: TextNode, wrapWidth = node.width) {
  const baseFont = resolvedTextFont(node.style);
  ctx.font = `${baseFont.fontWeight} ${node.style.fontSize}px ${baseFont.fontFamily}`;
  const letterSpacing = node.style.letterSpacing;
  const nativeSpacing = "letterSpacing" in ctx;
  if (nativeSpacing) ctx.letterSpacing = `${letterSpacing}px`;
  function fragments(units: TextUnit[]): TextFragment[] {
    const groups: Array<{ text: string; mark: TextMark | null }> = [];
    for (const unit of units) {
      const mark = node.marks?.find((item) => item.start <= unit.start && item.end >= unit.end) ?? null;
      const last = groups[groups.length - 1];
      if (last?.mark === mark) last.text += unit.text;
      else groups.push({ text: unit.text, mark });
    }
    return groups.map(({ text, mark }) => {
      const style = textFragmentStyle(node, mark);
      ctx.font = `${style.fontWeight} ${node.style.fontSize}px ${style.fontFamily}`;
      return { text, mark, width: ctx.measureText(text).width + (nativeSpacing ? 0 : graphemeSegments(text).length * letterSpacing) };
    });
  }
  const lines: TextLine[] = wrapTextUnits(node.content, wrapWidth - 4,
    (units) => fragments(units).reduce((width, fragment) => width + fragment.width, 0))
    .map((units) => {
      const parts = fragments(units);
      return { fragments: parts, width: parts.reduce((width, fragment) => width + fragment.width, 0) };
    });
  ctx.font = `${baseFont.fontWeight} ${node.style.fontSize}px ${baseFont.fontFamily}`;
  return { lines, nativeSpacing, letterSpacing };
}

/**
 * テキストの内容とフォントから必要な幅・高さを測る。`wrapWidth` を渡すとその幅で
 * 折り返したときの高さを返す（省略時は折り返さず明示改行だけを数える）。
 */
export function measureTextSize(ctx: CanvasRenderingContext2D, node: TextNode, wrapWidth = Number.POSITIVE_INFINITY): { width: number; height: number } {
  const { lines } = layoutTextLines(ctx, node, wrapWidth);
  const lineHeight = node.style.fontSize * node.style.lineHeight;
  const width = lines.reduce((max, line) => Math.max(max, line.width), 0) + 4;
  const height = lines.length * lineHeight + 4;
  return { width, height };
}
