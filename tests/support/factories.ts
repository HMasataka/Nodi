import assert from "node:assert/strict";

import type { Document, DocumentNode, EllipseNode, FrameNode, ImageNode, RectangleNode, TextNode } from "../src/document/types.ts";

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
  return { version: 1, children };
}

export function frame(overrides: Partial<FrameNode> = {}): FrameNode {
  return {
    id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 300, height: 200,
    background: "#ffffff", clipContent: true, children: [], ...overrides,
  };
}

export function rectangle(overrides: Partial<RectangleNode> = {}): RectangleNode {
  return {
    id: "rectangle", name: "矩形", type: "rectangle", x: 0, y: 0, width: 100, height: 50,
    fill: "#f3d9c8", stroke: "#d9bbaa", strokeWidth: 1, cornerRadius: 2, ...overrides,
  };
}

export function ellipse(overrides: Partial<EllipseNode> = {}): EllipseNode {
  return {
    id: "ellipse", name: "楕円", type: "ellipse", x: 0, y: 0, width: 100, height: 100,
    fill: "#f3d9c8", stroke: "#d9bbaa", strokeWidth: 1, ...overrides,
  };
}

export function text(overrides: Partial<TextNode> = {}): TextNode {
  return {
    id: "text", name: "テキスト", type: "text", x: 0, y: 0, width: 200, height: 40,
    content: "テキスト", fontSize: 16, color: "#272b29", textAlign: "left", ...overrides,
  };
}

export function image(overrides: Partial<ImageNode> = {}): ImageNode {
  return {
    id: "image", name: "画像", type: "image", x: 0, y: 0, width: 100, height: 100,
    source: "data:image/png;base64,aGVsbG8=", ...overrides,
  };
}
