import type { AddNodeInput } from "@/document/commands/index.ts";
import { MAX_PATH_COMMANDS } from "@/document/vectorPath.ts";
import type { PenState } from "@/pages/editor/types.ts";
import type { Point } from "@/pages/editor/geometry.ts";
import { invertTransform, type Transform, transformPoint } from "@/document/transform.ts";

export function penLocalPoint(world: Point, parent: Transform): Point {
  return transformPoint(invertTransform(parent), world);
}

export function nearPoint(first: Point, second: Point, distance: number): boolean {
  return Math.hypot(first.x - second.x, first.y - second.y) <= distance;
}

export function extendPen(draft: PenState, point: Point, zoom: number): { kind: "close" | "ignore" | "limit" } | { kind: "append"; draft: PenState } {
  if (nearPoint(draft.points[0], point, 9 / zoom)) return { kind: draft.points.length >= 3 ? "close" : "ignore" };
  if (nearPoint(draft.points[draft.points.length - 1], point, 2 / zoom)) return { kind: "ignore" };
  if (draft.points.length >= MAX_PATH_COMMANDS - 1) return { kind: "limit" };
  return { kind: "append", draft: { ...draft, points: [...draft.points, point], cursor: point } };
}

export function finishPenInput(draft: PenState, closed: boolean): Extract<AddNodeInput, { type: "path" }> | null {
  if (draft.points.length < (closed ? 3 : 2)) return null;
  const xs = draft.points.map((point) => point.x);
  const ys = draft.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - x);
  const height = Math.max(1, Math.max(...ys) - y);
  const commands = draft.points.map((point, index) => ({ kind: index === 0 ? "move" as const : "line" as const,
    x: (point.x - x) / width, y: (point.y - y) / height }));
  return { type: "path", parentId: draft.parentId ?? undefined, x, y, width, height,
    commands: closed ? [...commands, { kind: "close" }] : commands };
}
