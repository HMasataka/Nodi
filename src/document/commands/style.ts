import { Result } from "@praha/byethrow";

import { type Document, type FrameStyle, HEX_COLOR_PATTERN, type RectangleStyle, TEXT_FONT_FAMILIES, type TextMark, type TextMarkRangeEdit, type TextStyle } from "@/document/types.ts";
import { findNode, updateNode } from "@/document/commands/tree.ts";
import { patchTextMarks, remapTextMarks, textMarkIssue, textMarkPatchIssue } from "@/document/textMarks.ts";

export function setNodeStyle(
  document: Document,
  id: string,
  patch: Partial<RectangleStyle>,
): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || (node.type !== "rectangle" && node.type !== "ellipse")) return Result.fail(new Error(`図形が見つかりません: ${id}`));
  if (node.type === "ellipse" && patch.cornerRadii !== undefined) return Result.fail(new Error("楕円に角丸は設定できません"));
  const issue = boxStyleIssue(patch);
  if (issue) return Result.fail(new Error(issue));
  const style = boxStylePatch(patch);
  return updateNode(document, id, (current) => {
    if (current.type === "rectangle") return { ...current, style: { ...current.style, ...style } };
    if (current.type === "ellipse") return { ...current, style: { ...current.style, ...style } };
    return current;
  });
}

function boxStyleIssue(patch: Partial<RectangleStyle>): string | undefined {
  if (Object.keys(patch).some((key) => !["fill", "stroke", "cornerRadii"].includes(key))) return "未知のスタイル項目です";
  if (patch.fill !== undefined && patch.fill !== null && (typeof patch.fill !== "string" || !HEX_COLOR_PATTERN.test(patch.fill))) return "色は #RRGGBB 形式で指定してください";
  if (patch.stroke !== undefined && patch.stroke !== null &&
    (typeof patch.stroke !== "object" || Object.keys(patch.stroke).some((key) => !["color", "width"].includes(key)) || !HEX_COLOR_PATTERN.test(patch.stroke.color) || !Number.isFinite(patch.stroke.width) || patch.stroke.width < 0)) return "線の色と幅が不正です";
  if (patch.cornerRadii !== undefined && (!patch.cornerRadii || Object.keys(patch.cornerRadii).some((key) => !["topLeft", "topRight", "bottomRight", "bottomLeft"].includes(key)) ||
    ![patch.cornerRadii.topLeft, patch.cornerRadii.topRight, patch.cornerRadii.bottomRight, patch.cornerRadii.bottomLeft].every((value) => Number.isFinite(value) && value >= 0))) return "角丸は 0 以上の有限の数値で指定してください";
}

function boxStylePatch(patch: Partial<RectangleStyle>): Partial<RectangleStyle> {
  return structuredClone({
    ...(patch.fill === undefined ? {} : { fill: patch.fill }),
    ...(patch.stroke === undefined ? {} : { stroke: patch.stroke }),
    ...(patch.cornerRadii === undefined ? {} : { cornerRadii: patch.cornerRadii }),
  });
}

export function setFrameStyle(document: Document, id: string, patch: Partial<FrameStyle>): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "frame") return Result.fail(new Error(`フレームが見つかりません: ${id}`));
  const { clipContent: clipping, ...style } = patch;
  const issue = boxStyleIssue(style);
  if (issue) return Result.fail(new Error(issue));
  if (patch.clipContent !== undefined && typeof patch.clipContent !== "boolean") return Result.fail(new Error("はみ出し表示の設定が不正です"));
  const clipContent = clipping ?? node.clipContent;
  return updateNode(document, id, (current) => current.type === "frame" ? { ...current, style: { ...current.style, ...boxStylePatch(style) }, clipContent } : current);
}

export function setTextContent(document: Document, id: string, content: string): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  if (typeof content !== "string") return Result.fail(new Error("本文は文字列で指定してください"));
  return updateNode(document, id, (current) => current.type === "text"
    ? { ...current, content, ...(current.marks ? { marks: remapTextMarks(current.content, content, current.marks) } : {}) }
    : current);
}

export function setTextMarks(document: Document, id: string, marks: TextMark[]): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  const issue = textMarkIssue(node.content, marks);
  if (issue) return Result.fail(new Error(issue));
  return updateNode(document, id, (current) => ({ ...current, marks: marks.map((mark) => ({ ...mark })) }));
}

export function setTextMarkRange(document: Document, id: string, edit: TextMarkRangeEdit): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  const issue = textMarkPatchIssue(edit.content, edit.start, edit.end, edit.patch);
  if (issue) return Result.fail(new Error(issue));
  const marks = patchTextMarks(remapTextMarks(node.content, edit.content, node.marks ?? []), edit.start, edit.end, edit.patch);
  return updateNode(document, id, (current) => current.type === "text" ? { ...current, content: edit.content, marks } : current);
}

export function setTextStyle(document: Document, id: string, patch: Partial<TextStyle>): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  const style = {
    fontSize: patch.fontSize ?? node.style.fontSize, color: patch.color ?? node.style.color, textAlign: patch.textAlign ?? node.style.textAlign,
    fontFamily: patch.fontFamily ?? node.style.fontFamily,
    fontWeight: patch.fontWeight ?? node.style.fontWeight,
    lineHeight: patch.lineHeight ?? node.style.lineHeight,
    letterSpacing: patch.letterSpacing ?? node.style.letterSpacing,
  };
  if (!Number.isFinite(style.fontSize) || style.fontSize <= 0) return Result.fail(new Error("文字サイズは正の有限値で指定してください"));
  if (!HEX_COLOR_PATTERN.test(style.color)) return Result.fail(new Error("文字色は #RRGGBB 形式で指定してください"));
  if (!["left", "center", "right"].includes(style.textAlign)) return Result.fail(new Error("文字揃えが不正です"));
  if (!TEXT_FONT_FAMILIES.includes(style.fontFamily)) return Result.fail(new Error("フォントが不正です"));
  if (!Number.isInteger(style.fontWeight) || style.fontWeight < 100 || style.fontWeight > 900 || style.fontWeight % 100 !== 0) {
    return Result.fail(new Error("文字の太さは 100 から 900 までの 100 刻みで指定してください"));
  }
  if (!Number.isFinite(style.lineHeight) || style.lineHeight <= 0) return Result.fail(new Error("行高は正の有限値で指定してください"));
  if (!Number.isFinite(style.letterSpacing)) return Result.fail(new Error("字間は有限値で指定してください"));
  return updateNode(document, id, (current) => current.type === "text" ? { ...current, style } : current);
}
