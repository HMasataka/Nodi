import type { CSSProperties } from "react";

import type { CanvasExtent } from "@/pages/editor/viewport.ts";
import { normalizeRadii } from "@/document/shapePath.ts";
import type { Point } from "@/pages/editor/geometry.ts";
import { RENDER_COLORS } from "@/rendering/colors.ts";
import { resolvedTextFont } from "@/document/textFonts.ts";
import type { SnapGuide } from "@/pages/editor/snapping.ts";
import { textFragmentStyle } from "@/rendering/textLayout.ts";
import type { CornerRadii, EllipseNode, FrameNode, Geometry, ImageNode, RectangleNode, TextMark, TextNode } from "@/document/types.ts";

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
  return { ...nodeBoxStyle(node), borderRadius: cornerRadiiCss(normalizeRadii(node.style.cornerRadii, node.width, node.height)) };
}

export function frameContentsStyle(node: FrameNode): CSSProperties {
  return { overflow: node.clipContent ? "hidden" : "visible", borderRadius: "inherit" };
}

export function textNodeStyle(node: TextNode): CSSProperties {
  return {
    ...nodeBoxStyle(node),
    fontSize: node.style.fontSize,
    color: node.style.color,
    textAlign: node.style.textAlign,
    lineHeight: node.style.lineHeight,
    letterSpacing: `${node.style.letterSpacing}px`,
    ...resolvedTextFont(node.style),
  };
}

export function textLineStyle(node: TextNode): CSSProperties {
  return { height: node.style.fontSize * node.style.lineHeight };
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
  return nodeBoxStyle(node);
}

function cornerRadiiCss(radii: CornerRadii): string {
  return `${radii.topLeft}px ${radii.topRight}px ${radii.bottomRight}px ${radii.bottomLeft}px`;
}

export function imageNodeStyle(node: ImageNode): CSSProperties {
  return { ...nodeBoxStyle(node), borderRadius: cornerRadiiCss(normalizeRadii(node.style.cornerRadii, node.width, node.height)) };
}
