import { validColor } from "@/document/colorRef.ts";
import { graphemeBoundaries, graphemeSegments } from "@/document/textLayout.ts";
import { type TextMark, type TextMarkPatch } from "@/document/types.ts";

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
    if (mark.color !== undefined && !validColor(mark.color)) return "装飾の文字色が不正です";
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

const PATCH_KEYS = new Set(["color", "fontWeight", "underline", "code"]);

export function textMarkPatchIssue(content: string, start: number, end: number, patch: TextMarkPatch): string | null {
  if (typeof content !== "string" || !Number.isInteger(start) || !Number.isInteger(end) ||
    start < 0 || start >= end || end > content.length) return "装飾する文字範囲が不正です";
  const boundaries = graphemeBoundaries(content);
  if (!boundaries.has(start) || !boundaries.has(end)) return "装飾する文字範囲が不正です";
  if (!patch || typeof patch !== "object" || Array.isArray(patch) ||
    Object.keys(patch).length === 0 || Object.keys(patch).some((key) => !PATCH_KEYS.has(key)) ||
    Object.values(patch).every((value) => value === undefined)) return "装飾の変更内容が不正です";
  if (patch.color !== undefined && patch.color !== null && !validColor(patch.color)) return "装飾の文字色が不正です";
  if (patch.fontWeight !== undefined && patch.fontWeight !== null &&
    (!Number.isInteger(patch.fontWeight) || patch.fontWeight < 100 || patch.fontWeight > 900 || patch.fontWeight % 100 !== 0)) return "装飾の文字の太さが不正です";
  if (patch.underline !== undefined && typeof patch.underline !== "boolean") return "下線の指定が不正です";
  if (patch.code !== undefined && typeof patch.code !== "boolean") return "コードの指定が不正です";
  return null;
}

function sameStyle(a: TextMark, b: TextMark): boolean {
  return a.color === b.color && a.fontWeight === b.fontWeight && a.underline === b.underline && a.code === b.code;
}

export function patchTextMarks(marks: TextMark[], start: number, end: number, patch: TextMarkPatch): TextMark[] {
  const boundaries = [...new Set([start, end, ...marks.flatMap((mark) => [mark.start, mark.end])])].sort((a, b) => a - b);
  const updated: TextMark[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const from = boundaries[index];
    const to = boundaries[index + 1];
    const existing = marks.find((mark) => mark.start <= from && mark.end >= to);
    const selected = from >= start && to <= end;
    if (!existing && !selected) continue;
    const style: TextMarkPatch = {};
    if (existing?.color !== undefined) style.color = existing.color;
    if (existing?.fontWeight !== undefined) style.fontWeight = existing.fontWeight;
    if (existing?.underline) style.underline = true;
    if (existing?.code) style.code = true;
    if (selected) {
      if (patch.color !== undefined) style.color = patch.color;
      if (patch.fontWeight !== undefined) style.fontWeight = patch.fontWeight;
      if (patch.underline !== undefined) style.underline = patch.underline;
      if (patch.code !== undefined) style.code = patch.code;
    }
    const next: TextMark = { start: from, end: to };
    if (style.color) next.color = style.color;
    if (style.fontWeight) next.fontWeight = style.fontWeight;
    if (style.underline) next.underline = true;
    if (style.code) next.code = true;
    if (Object.keys(next).length === 2) continue;
    const previous = updated[updated.length - 1];
    if (previous?.end === from && sameStyle(previous, next)) previous.end = to;
    else updated.push(next);
  }
  return updated;
}

export function rangeHasMark(marks: TextMark[], start: number, end: number, matches: (mark: TextMark | undefined) => boolean): boolean {
  if (start >= end) return false;
  const boundaries = [...new Set([start, end, ...marks.flatMap((mark) => [mark.start, mark.end])
    .filter((position) => position > start && position < end)])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).every((from, index) => matches(marks.find((mark) => mark.start <= from && mark.end >= boundaries[index + 1])));
}
