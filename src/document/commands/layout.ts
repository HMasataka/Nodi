import { Result } from "@praha/byethrow";

import { resolvedSpacing } from "@/document/spacing.ts";
import { type Document, type FrameNode, LAYOUT_ALIGNMENTS, LAYOUT_JUSTIFIES, LAYOUT_MODES, SIZE_MODES, type SizeConstraint } from "@/document/types.ts";
import { findNode, updateNode } from "@/document/commands/tree.ts";

export type FrameLayoutPatch = Partial<Pick<FrameNode, "layoutMode" | "padding" | "gap" | "alignItems" | "justifyContent">> &
  { paddingRef?: string | null; gapRef?: string | null };
export type SizeConstraintPatch = Partial<SizeConstraint>;
export type SizeAxis = "width" | "height";

const LAYOUT_KEYS = ["layoutMode", "padding", "gap", "paddingRef", "gapRef", "alignItems", "justifyContent"] as const;

export function setFrameLayout(document: Document, id: string, patch: FrameLayoutPatch): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "frame") return Result.fail(new Error(`フレームが見つかりません: ${id}`));
  const keys = Object.keys(patch) as (keyof FrameLayoutPatch)[];
  if (keys.length === 0 || keys.some((key) => !(LAYOUT_KEYS as readonly string[]).includes(key))) {
    return Result.fail(new Error("変更するレイアウトを指定してください"));
  }
  if (patch.layoutMode !== undefined && !LAYOUT_MODES.includes(patch.layoutMode)) return Result.fail(new Error("レイアウト方向が不正です"));
  if (patch.padding !== undefined && (typeof patch.padding !== "number" || !Number.isFinite(patch.padding) || patch.padding < 0)) return Result.fail(new Error("余白は 0 以上の有限値で指定してください"));
  if (patch.gap !== undefined && (typeof patch.gap !== "number" || !Number.isFinite(patch.gap) || patch.gap < 0)) return Result.fail(new Error("間隔は 0 以上の有限値で指定してください"));
  for (const key of ["padding", "gap"] as const) {
    const refKey = key === "padding" ? "paddingRef" : "gapRef";
    const ref = patch[refKey];
    if (patch[key] !== undefined && ref !== undefined && ref !== null) return Result.fail(new Error("直接値と共通値を同時に指定できません"));
    if (ref !== undefined && ref !== null && (typeof ref !== "string" || !document.spacing.some((token) => token.id === ref))) {
      return Result.fail(new Error(`余白値が見つかりません: ${ref}`));
    }
  }
  if (patch.alignItems !== undefined && !LAYOUT_ALIGNMENTS.includes(patch.alignItems)) return Result.fail(new Error("交差軸の整列が不正です"));
  if (patch.justifyContent !== undefined && !LAYOUT_JUSTIFIES.includes(patch.justifyContent)) return Result.fail(new Error("主軸の分配が不正です"));
  return updateNode(document, id, (current) => {
    if (current.type !== "frame") return current;
    const { paddingRef: previousPaddingRef, gapRef: previousGapRef, ...rest } = current;
    const { paddingRef: _paddingRef, gapRef: _gapRef, ...values } = patch;
    const paddingRef = patch.padding !== undefined || patch.paddingRef === null ? undefined : patch.paddingRef ?? previousPaddingRef;
    const gapRef = patch.gap !== undefined || patch.gapRef === null ? undefined : patch.gapRef ?? previousGapRef;
    const next: FrameNode = { ...rest, ...values,
      ...(patch.paddingRef === null && patch.padding === undefined ? { padding: resolvedSpacing(document, current, "padding") } : {}),
      ...(patch.gapRef === null && patch.gap === undefined ? { gap: resolvedSpacing(document, current, "gap") } : {}),
      ...(paddingRef === undefined ? {} : { paddingRef }), ...(gapRef === undefined ? {} : { gapRef }) };
    const changed = keys.some((key) => current[key] !== next[key]);
    return changed ? next : current;
  });
}

export function setNodeSizeConstraint(document: Document, id: string, axis: SizeAxis, patch: SizeConstraintPatch): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  if (axis !== "width" && axis !== "height") return Result.fail(new Error("サイズの軸が不正です"));
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !["mode", "min", "max"].includes(key))) return Result.fail(new Error("変更するサイズ制約を指定してください"));
  if (patch.mode !== undefined && !SIZE_MODES.includes(patch.mode)) return Result.fail(new Error("サイズモードが不正です"));
  if (patch.min !== undefined && (typeof patch.min !== "number" || !Number.isFinite(patch.min) || patch.min <= 0)) return Result.fail(new Error("最小値は正の有限値で指定してください"));
  if (patch.max !== undefined && (typeof patch.max !== "number" || !Number.isFinite(patch.max) || patch.max <= 0)) return Result.fail(new Error("最大値は正の有限値で指定してください"));
  const key = axis === "width" ? "widthConstraint" : "heightConstraint";
  const previous = node[key];
  const next: SizeConstraint = {
    mode: patch.mode ?? previous.mode,
    ...("min" in patch ? (patch.min === undefined ? {} : { min: patch.min }) : (previous.min === undefined ? {} : { min: previous.min })),
    ...("max" in patch ? (patch.max === undefined ? {} : { max: patch.max }) : (previous.max === undefined ? {} : { max: previous.max })),
  };
  if (next.min !== undefined && next.max !== undefined && next.min > next.max) return Result.fail(new Error("最小値は最大値以下にしてください"));
  return updateNode(document, id, (current) => {
    const currentConstraint = current[key];
    const unchanged = currentConstraint.mode === next.mode && currentConstraint.min === next.min && currentConstraint.max === next.max;
    return unchanged ? current : { ...current, [key]: next };
  });
}
