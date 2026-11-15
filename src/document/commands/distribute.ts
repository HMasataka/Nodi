import { Result } from "@praha/byethrow";

import { findNode } from "@/document/commands/tree.ts";
import type { Document, DocumentNode, Geometry } from "@/document/types.ts";
import { invertTransform, transformVector } from "@/document/transform.ts";
import { type LocatedNode, locateSelection } from "@/document/geometry.ts";

export type SpacingAxis = "x" | "y";
export interface SpacingInterval { from: Geometry; to: Geometry; distance: number }
export interface SelectionSpacing { axis: SpacingAxis; intervals: SpacingInterval[] }

function orderedSelection(document: Document, ids: string[], axis: SpacingAxis): Result.Result<LocatedNode[], Error> {
  if (axis !== "x" && axis !== "y") return Result.fail(new Error("分配方向が不正です"));
  const unique = new Set(ids);
  if (unique.size < 3) return Result.fail(new Error("異なる3つ以上の要素を選択してください"));
  for (const id of unique) if (!findNode(document, id)) return Result.fail(new Error(`要素が見つかりません: ${id}`));

  const parentIds = new Set<string | null>();
  const selected: LocatedNode[] = [];
  function walk(nodes: DocumentNode[], parentId: string | null, managed: boolean): void {
    for (const node of nodes) {
      if (unique.has(node.id)) {
        parentIds.add(parentId);
        if (managed) parentIds.add("auto-layout");
      }
      if (node.type === "frame") walk(node.children, node.id, node.layoutMode !== "none");
    }
  }
  walk(document.children, null, false);
  if (parentIds.has("auto-layout")) return Result.fail(new Error("自動レイアウトの子は分配できません"));
  if (parentIds.size !== 1) return Result.fail(new Error("同じ親の自由配置要素だけを選択してください"));
  selected.push(...locateSelection(document, unique));
  if (selected.length !== unique.size) return Result.fail(new Error("親子の要素を同時に選択できません"));
  const start = (entry: LocatedNode) => entry.absolute[axis];
  selected.sort((a, b) => start(a) - start(b) || a.node.id.localeCompare(b.node.id));
  return Result.succeed(selected);
}

export function measureSelectionSpacing(document: Document, ids: string[], axis: SpacingAxis): Result.Result<SelectionSpacing, Error> {
  const result = orderedSelection(document, ids, axis);
  if (Result.isFailure(result)) return result;
  const intervals = result.value.slice(1).map((entry, index) => {
    const previous = result.value[index];
    return { from: previous.absolute, to: entry.absolute, distance: entry.absolute[axis] - previous.absolute[axis] - previous.absolute[axis === "x" ? "width" : "height"] };
  });
  return Result.succeed({ axis, intervals });
}

// equal keeps both outer bounds fixed; fixed keeps the first bound fixed and moves the rest.
// Equal distribution permits negative gaps (overlapping bounds); an explicitly entered gap must be nonnegative.
export function distributeNodes(document: Document, ids: string[], axis: SpacingAxis, mode: "equal" | number): Result.Result<Document, Error> {
  if (mode !== "equal" && (!Number.isFinite(mode) || mode < 0)) return Result.fail(new Error("間隔は0以上の有限な数値を指定してください"));
  const result = orderedSelection(document, ids, axis);
  if (Result.isFailure(result)) return result;
  const selected = result.value;
  const size = axis === "x" ? "width" : "height";
  const first = selected[0].absolute[axis];
  const last = selected[selected.length - 1];
  const totalSize = selected.reduce((sum, entry) => sum + entry.absolute[size], 0);
  const gap = mode === "equal" ? (last.absolute[axis] + last.absolute[size] - first - totalSize) / (selected.length - 1) : mode;
  const positions = new Map<string, { x: number; y: number }>();
  let cursor = first;
  for (const entry of selected) {
    if (mode === "equal" && entry === last) break;
    const delta = axis === "x" ? { x: cursor - entry.absolute.x, y: 0 } : { x: 0, y: cursor - entry.absolute.y };
    const local = transformVector(invertTransform(entry.parent), delta);
    const position = { x: entry.node.x + local.x, y: entry.node.y + local.y };
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return Result.fail(new Error("分配後の座標が不正です"));
    positions.set(entry.node.id, position);
    cursor += entry.absolute[size] + gap;
  }
  function update(nodes: DocumentNode[]): DocumentNode[] {
    let changed = false;
    const next = nodes.map((node) => {
      const position = positions.get(node.id);
      if (position) {
        if (node.x === position.x && node.y === position.y) return node;
        changed = true;
        return { ...node, ...position };
      }
      if (node.type !== "frame") return node;
      const children = update(node.children);
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    });
    return changed ? next : nodes;
  }
  const children = update(document.children);
  return Result.succeed(children === document.children ? document : { ...document, children });
}
