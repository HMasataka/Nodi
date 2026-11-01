import { Result } from "@praha/byethrow";

import type { Document, FrameStyle, RectangleStyle, TextStyle } from "@/document/types.ts";
import { findNode, updateNode } from "@/document/commands/tree.ts";

export function setNodeStyle(
  document: Document,
  id: string,
  patch: Partial<RectangleStyle>,
): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || (node.type !== "rectangle" && node.type !== "ellipse")) return Result.fail(new Error(`図形が見つかりません: ${id}`));
  if (node.type === "ellipse" && patch.cornerRadius !== undefined) return Result.fail(new Error("楕円に角丸は設定できません"));
  const style = { fill: patch.fill ?? node.fill, stroke: patch.stroke ?? node.stroke,
    strokeWidth: patch.strokeWidth ?? node.strokeWidth };
  if (!/^#[0-9a-fA-F]{6}$/.test(style.fill) || !/^#[0-9a-fA-F]{6}$/.test(style.stroke)) {
    return Result.fail(new Error("色は #RRGGBB 形式で指定してください"));
  }
  const cornerRadius = node.type === "rectangle" ? patch.cornerRadius ?? node.cornerRadius : undefined;
  if (![style.strokeWidth, cornerRadius ?? 0].every((value) => Number.isFinite(value) && value >= 0)) {
    return Result.fail(new Error("線幅と角丸は 0 以上の有限の数値で指定してください"));
  }
  return updateNode(document, id, (current) => ({ ...current, ...style, ...(cornerRadius === undefined ? {} : { cornerRadius }) }));
}

export function setFrameStyle(document: Document, id: string, patch: Partial<FrameStyle>): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "frame") return Result.fail(new Error(`フレームが見つかりません: ${id}`));
  if (patch.background !== undefined && (typeof patch.background !== "string" || !/^#[0-9a-fA-F]{6}$/.test(patch.background))) {
    return Result.fail(new Error("背景色は #RRGGBB 形式で指定してください"));
  }
  if (patch.clipContent !== undefined && typeof patch.clipContent !== "boolean") return Result.fail(new Error("はみ出し表示の設定が不正です"));
  const background = patch.background ?? node.background;
  const clipContent = patch.clipContent ?? node.clipContent;
  return updateNode(document, id, (current) => ({ ...current, background, clipContent }));
}

export function setTextContent(document: Document, id: string, content: string): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  if (typeof content !== "string") return Result.fail(new Error("本文は文字列で指定してください"));
  return updateNode(document, id, (current) => ({ ...current, content }));
}

export function setTextStyle(document: Document, id: string, patch: Partial<TextStyle>): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  const style = { fontSize: patch.fontSize ?? node.fontSize, color: patch.color ?? node.color, textAlign: patch.textAlign ?? node.textAlign };
  if (!Number.isFinite(style.fontSize) || style.fontSize <= 0) return Result.fail(new Error("文字サイズは正の有限値で指定してください"));
  if (!/^#[0-9a-fA-F]{6}$/.test(style.color)) return Result.fail(new Error("文字色は #RRGGBB 形式で指定してください"));
  if (!["left", "center", "right"].includes(style.textAlign)) return Result.fail(new Error("文字揃えが不正です"));
  return updateNode(document, id, (current) => ({ ...current, ...style }));
}
