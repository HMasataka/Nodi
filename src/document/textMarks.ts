import { graphemeBoundaries, graphemeSegments } from "@/document/textLayout.ts";
import { HEX_COLOR_PATTERN, type TextMark } from "@/document/types.ts";

const MARK_KEYS = new Set(["start", "end", "color", "fontWeight", "underline", "code"]);

export function textMarkIssue(content: string, marks: TextMark[]): string | null {
  if (!Array.isArray(marks)) return "装飾範囲は配列で指定してください";
  const boundaries = graphemeBoundaries(content);
  let previousEnd = 0;
  for (const mark of marks) {
    if (!mark || typeof mark !== "object" || Array.isArray(mark) || Object.keys(mark).some((key) => !MARK_KEYS.has(key))) {
      return "装飾範囲の形式が不正です";
    }
    if (!Number.isInteger(mark.start) || !Number.isInteger(mark.end) || mark.start < previousEnd || mark.start >= mark.end || mark.end > content.length) {
      return "装飾範囲の順序または位置が不正です";
    }
    if (!boundaries.has(mark.start) || !boundaries.has(mark.end)) return "装飾範囲は文字の境界で指定してください";
    if (mark.color !== undefined && (typeof mark.color !== "string" || !HEX_COLOR_PATTERN.test(mark.color))) return "装飾の文字色が不正です";
    if (mark.fontWeight !== undefined && (!Number.isInteger(mark.fontWeight) || mark.fontWeight < 100 || mark.fontWeight > 900 || mark.fontWeight % 100 !== 0)) {
      return "装飾の文字の太さが不正です";
    }
    if (mark.underline !== undefined && mark.underline !== true) return "下線の指定が不正です";
    if (mark.code !== undefined && mark.code !== true) return "コードの指定が不正です";
    if (mark.color === undefined && mark.fontWeight === undefined && mark.underline !== true && mark.code !== true) return "装飾を一つ以上指定してください";
    previousEnd = mark.end;
  }
  return null;
}

export function remapTextMarks(before: string, after: string, marks: TextMark[]): TextMark[] {
  const oldCharacters = graphemeSegments(before);
  const newCharacters = graphemeSegments(after);
  let prefix = 0;
  while (prefix < Math.min(oldCharacters.length, newCharacters.length) && oldCharacters[prefix] === newCharacters[prefix]) prefix++;
  let suffix = 0;
  while (suffix < Math.min(oldCharacters.length, newCharacters.length) - prefix &&
    oldCharacters[oldCharacters.length - 1 - suffix] === newCharacters[newCharacters.length - 1 - suffix]) suffix++;
  const start = oldCharacters.slice(0, prefix).join("").length;
  const oldEnd = before.length - oldCharacters.slice(oldCharacters.length - suffix).join("").length;
  const newEnd = after.length - newCharacters.slice(newCharacters.length - suffix).join("").length;
  const delta = newEnd - oldEnd;
  const updated: TextMark[] = [];
  for (const mark of marks) {
    if (mark.end <= start) updated.push({ ...mark });
    else if (mark.start >= oldEnd) updated.push({ ...mark, start: mark.start + delta, end: mark.end + delta });
    else if (mark.start <= start && mark.end >= oldEnd) {
      if (mark.start < mark.end + delta) updated.push({ ...mark, end: mark.end + delta });
    } else {
      if (mark.start < start) updated.push({ ...mark, end: start });
      if (mark.end > oldEnd) updated.push({ ...mark, start: newEnd, end: mark.end + delta });
    }
  }
  return updated;
}
