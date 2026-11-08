import type { CSSProperties } from "react";

import type { CanvasExtent } from "@/pages/editor/viewport.ts";
import type { Point } from "@/pages/editor/geometry.ts";
import { RENDER_COLORS } from "@/rendering/colors.ts";
import { resolvedTextFont } from "@/document/textFonts.ts";
import type { SnapGuide } from "@/pages/editor/snapping.ts";
import { textFragmentStyle } from "@/rendering/textLayout.ts";
import { DEFAULT_TEXT_LETTER_SPACING, DEFAULT_TEXT_LINE_HEIGHT } from "@/document/types.ts";
import type { EllipseNode, FrameNode, Geometry, RectangleNode, TextMark, TextNode } from "@/document/types.ts";

const CANVAS_GRID_SIZE = 24;

export function canvasSurfaceStyle(extent: CanvasExtent, zoom: number): CSSProperties {
  return {
    width: `max(100%, ${extent.width * zoom}px)`,
    height: `max(100%, ${extent.height * zoom}px)`,
    backgroundSize: `${CANVAS_GRID_SIZE * zoom}px ${CANVAS_GRID_SIZE * zoom}px`,
  };
}

export function canvasWorldStyle(extent: CanvasExtent, zoom: number): CSSProperties {
  return { transform: `translate(${extent.originX * zoom}px, ${extent.originY * zoom}px) scale(${zoom})` };
}

export function selectionPreviewStyle(selection: { start: Point; end: Point }): CSSProperties {
  return {
    left: Math.min(selection.start.x, selection.end.x),
    top: Math.min(selection.start.y, selection.end.y),
    width: Math.abs(selection.end.x - selection.start.x),
    height: Math.abs(selection.end.y - selection.start.y),
  };
}

export function drawPreviewStyle(preview: Geometry, parentOrigin: Point): CSSProperties {
  return {
    left: preview.x + parentOrigin.x,
    top: preview.y + parentOrigin.y,
    width: preview.width,
    height: preview.height,
  };
}

export function guideStyle(guide: SnapGuide): CSSProperties {
  return guide.orientation === "vertical"
    ? { left: guide.position, top: guide.from, height: guide.to - guide.from }
    : { top: guide.position, left: guide.from, width: guide.to - guide.from };
}

function nodeBoxStyle(node: Geometry): CSSProperties {
  return { left: node.x, top: node.y, width: node.width, height: node.height };
}

export function frameNodeStyle(node: FrameNode): CSSProperties {
  return { ...nodeBoxStyle(node), background: node.background };
}

export function frameContentsStyle(node: FrameNode): CSSProperties {
  return { overflow: node.clipContent ? "hidden" : "visible" };
}

export function textNodeStyle(node: TextNode): CSSProperties {
  return {
    ...nodeBoxStyle(node),
    fontSize: node.fontSize,
    color: node.color,
    textAlign: node.textAlign,
    lineHeight: node.lineHeight ?? DEFAULT_TEXT_LINE_HEIGHT,
    letterSpacing: `${node.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING}px`,
    ...resolvedTextFont(node),
  };
}

export function textLineStyle(node: TextNode): CSSProperties {
  return { height: node.fontSize * (node.lineHeight ?? DEFAULT_TEXT_LINE_HEIGHT) };
}

export function textMarkStyle(node: TextNode, mark: TextMark): CSSProperties {
  const appearance = textFragmentStyle(node, mark);
  return {
    fontFamily: appearance.fontFamily,
    fontWeight: appearance.fontWeight,
    color: appearance.color,
    textDecorationLine: appearance.underline ? "underline" : undefined,
    backgroundColor: appearance.code ? RENDER_COLORS.codeBackground : undefined,
    borderRadius: appearance.code ? 3 : undefined,
  };
}

export function shapeNodeStyle(node: RectangleNode | EllipseNode): CSSProperties {
  return {
    ...nodeBoxStyle(node),
    background: node.fill,
    borderColor: node.stroke,
    borderWidth: node.strokeWidth,
    borderRadius: node.type === "ellipse" ? "50%" : node.cornerRadius,
  };
}

export function imageNodeStyle(node: Geometry): CSSProperties {
  return nodeBoxStyle(node);
}
