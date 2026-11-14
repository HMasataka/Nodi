import { Result } from "@praha/byethrow";

import { type Document, type FrameNode, LAYOUT_ALIGNMENTS, LAYOUT_JUSTIFIES, LAYOUT_MODES } from "@/document/types.ts";
import { findNode, updateNode } from "@/document/commands/tree.ts";

export type FrameLayoutPatch = Partial<Pick<FrameNode, "layoutMode" | "padding" | "gap" | "alignItems" | "justifyContent">>;

const LAYOUT_KEYS = ["layoutMode", "padding", "gap", "alignItems", "justifyContent"] as const;

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
  if (patch.alignItems !== undefined && !LAYOUT_ALIGNMENTS.includes(patch.alignItems)) return Result.fail(new Error("交差軸の整列が不正です"));
  if (patch.justifyContent !== undefined && !LAYOUT_JUSTIFIES.includes(patch.justifyContent)) return Result.fail(new Error("主軸の分配が不正です"));
  return updateNode(document, id, (current) => {
    if (current.type !== "frame") return current;
    const changed = keys.some((key) => current[key] !== patch[key]);
    return changed ? { ...current, ...patch } : current;
  });
}
