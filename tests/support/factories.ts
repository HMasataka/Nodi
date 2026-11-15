import assert from "node:assert/strict";

import { DEFAULT_FRAME_STYLE, DEFAULT_IMAGE_STYLE, DEFAULT_RECTANGLE_STYLE, DEFAULT_TEXT_STYLE, type Document, type DocumentNode, type EllipseNode, type FrameNode, type ImageNode, type PaletteColor, type PathNode, type RectangleNode, type TextNode } from "../../src/document/types.ts";

type NodeOverrides<T extends DocumentNode> = Omit<Partial<T>, "style"> & { style?: Partial<T["style"]> };
export const corners = (radius: number) => ({ topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius });

type SuccessResult<T> = { readonly type: "Success"; readonly value: T };
type FailureResult<E> = { readonly type: "Failure"; readonly error: E };

export function success<T>(result: SuccessResult<T> | FailureResult<unknown>): T {
  assert.equal(result.type, "Success");
  if (result.type === "Failure") assert.fail("成功を期待しましたが失敗しました");
  return result.value;
}

export function failure<E>(result: SuccessResult<unknown> | FailureResult<E>): E {
  assert.equal(result.type, "Failure");
  if (result.type === "Success") assert.fail("失敗を期待しましたが成功しました");
  return result.error;
}

export function document(...children: DocumentNode[]): Document {
  return { version: 1, children, palette: [] };
}

export function paletteColor(overrides: Partial<PaletteColor> = {}): PaletteColor {
  return { id: "pc1", name: "アクセント", color: "#ff0000", ...overrides };
}

export function frame({ style, ...overrides }: NodeOverrides<FrameNode> = {}): FrameNode {
  return {
    id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 300, height: 200, rotation: 0, opacity: 1, shadow: null, blur: 0,
    widthConstraint: { mode: "fixed" }, heightConstraint: { mode: "fixed" }, animations: [],
    style: { ...structuredClone(DEFAULT_FRAME_STYLE), ...style }, clipContent: true,
    layoutMode: "none", padding: 0, gap: 0, alignItems: "start", justifyContent: "start",
    children: [], ...overrides,
  };
}

export function rectangle({ style, ...overrides }: NodeOverrides<RectangleNode> = {}): RectangleNode {
  return {
    id: "rectangle", name: "矩形", type: "rectangle", x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1, shadow: null, blur: 0, isMask: false,
    widthConstraint: { mode: "fixed" }, heightConstraint: { mode: "fixed" }, animations: [],
    style: { ...structuredClone(DEFAULT_RECTANGLE_STYLE), ...style }, ...overrides,
  };
}

export function ellipse({ style, ...overrides }: NodeOverrides<EllipseNode> = {}): EllipseNode {
  return {
    id: "ellipse", name: "楕円", type: "ellipse", x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, shadow: null, blur: 0, isMask: false,
    widthConstraint: { mode: "fixed" }, heightConstraint: { mode: "fixed" }, animations: [],
    style: { fill: "#f3d9c8", stroke: { color: "#d9bbaa", width: 1 }, ...style }, ...overrides,
  };
}

export function path({ style, ...overrides }: NodeOverrides<PathNode> = {}): PathNode {
  return {
    id: "path", name: "パス", type: "path", x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, shadow: null, blur: 0,
    widthConstraint: { mode: "fixed" }, heightConstraint: { mode: "fixed" }, animations: [],
    commands: [{ kind: "move", x: 0, y: 0 }, { kind: "line", x: 1, y: 0 }, { kind: "line", x: 0.5, y: 1 }, { kind: "close" }],
    fillRule: "nonzero", style: { fill: "#f3d9c8", stroke: { color: "#d9bbaa", width: 1 }, ...style }, ...overrides,
  };
}

export function text({ style, ...overrides }: NodeOverrides<TextNode> = {}): TextNode {
  return {
    id: "text", name: "テキスト", type: "text", x: 0, y: 0, width: 200, height: 40, rotation: 0, opacity: 1, shadow: null, blur: 0,
    widthConstraint: { mode: "fixed" }, heightConstraint: { mode: "fixed" }, animations: [],
    content: "テキスト", style: { ...DEFAULT_TEXT_STYLE, ...style }, ...overrides,
  };
}

export function image({ style, ...overrides }: NodeOverrides<ImageNode> = {}): ImageNode {
  return {
    id: "image", name: "画像", type: "image", x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, shadow: null, blur: 0,
    widthConstraint: { mode: "fixed" }, heightConstraint: { mode: "fixed" }, animations: [],
    source: "data:image/png;base64,aGVsbG8=", style: { ...structuredClone(DEFAULT_IMAGE_STYLE), ...style }, ...overrides,
  };
}
