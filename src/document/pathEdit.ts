import type { VectorPathCommand } from "@/document/types.ts";
import { vectorPathIssue } from "@/document/vectorPath.ts";

export type PathPointPart = "anchor" | "in" | "out";
export interface PathPoint { x: number; y: number }

function endpoint(command: VectorPathCommand): PathPoint | null {
  return command.kind === "close" ? null : { x: command.x, y: command.y };
}

function previousPoint(commands: VectorPathCommand[], index: number): PathPoint | null {
  for (let offset = index - 1; offset >= 0; offset--) {
    const point = endpoint(commands[offset]);
    if (point) return point;
  }
  return null;
}

function subpathStart(commands: VectorPathCommand[], index: number): PathPoint | null {
  for (let offset = index - 1; offset >= 0; offset--) if (commands[offset].kind === "move") return endpoint(commands[offset]);
  return null;
}

export function movePathPoint(commands: VectorPathCommand[], index: number, part: PathPointPart, point: PathPoint): VectorPathCommand[] | null {
  const command = commands[index];
  if (!command || command.kind === "close" || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const updated = commands.map((item) => ({ ...item }));
  if (part === "in" || part === "out") {
    if (command.kind !== "cubic") return null;
    updated[index] = { ...command, ...(part === "in" ? { x1: point.x, y1: point.y } : { x2: point.x, y2: point.y }) };
  } else {
    const dx = point.x - command.x;
    const dy = point.y - command.y;
    updated[index] = command.kind === "cubic"
      ? { ...command, x: point.x, y: point.y, x2: command.x2 + dx, y2: command.y2 + dy }
      : { ...command, x: point.x, y: point.y };
    const next = commands[index + 1];
    if (next?.kind === "cubic") updated[index + 1] = { ...next, x1: next.x1 + dx, y1: next.y1 + dy };
  }
  return vectorPathIssue(updated, "nonzero") ? null : updated;
}

export function insertPathPoint(commands: VectorPathCommand[], index: number): VectorPathCommand[] | null {
  const command = commands[index];
  const previous = previousPoint(commands, index);
  if (!command || !previous || command.kind === "move") return null;
  const updated = [...commands];
  if (command.kind === "cubic") {
    const half = (first: PathPoint, second: PathPoint): PathPoint => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
    const a = half(previous, { x: command.x1, y: command.y1 });
    const b = half({ x: command.x1, y: command.y1 }, { x: command.x2, y: command.y2 });
    const c = half({ x: command.x2, y: command.y2 }, command);
    const d = half(a, b);
    const e = half(b, c);
    const middle = half(d, e);
    updated.splice(index, 1,
      { kind: "cubic", x1: a.x, y1: a.y, x2: d.x, y2: d.y, x: middle.x, y: middle.y },
      { kind: "cubic", x1: e.x, y1: e.y, x2: c.x, y2: c.y, x: command.x, y: command.y });
  } else {
    const end = command.kind === "close" ? subpathStart(commands, index) : endpoint(command);
    if (!end) return null;
    updated.splice(index, 0, { kind: "line", x: (previous.x + end.x) / 2, y: (previous.y + end.y) / 2 });
  }
  return vectorPathIssue(updated, "nonzero") ? null : updated;
}

export function deletePathPoint(commands: VectorPathCommand[], index: number): VectorPathCommand[] | null {
  const command = commands[index];
  if (!command || command.kind === "close") return null;
  const updated = [...commands];
  if (command.kind === "move") {
    const next = commands[index + 1];
    if (!next || next.kind === "move" || next.kind === "close") return null;
    updated.splice(index, 2, { kind: "move", x: next.x, y: next.y });
  } else updated.splice(index, 1);
  return vectorPathIssue(updated, "nonzero") ? null : updated;
}

export function togglePathCurve(commands: VectorPathCommand[], index: number): VectorPathCommand[] | null {
  const command = commands[index];
  const previous = previousPoint(commands, index);
  if (!command || !previous || (command.kind !== "line" && command.kind !== "cubic")) return null;
  const updated = [...commands];
  updated[index] = command.kind === "cubic" ? { kind: "line", x: command.x, y: command.y } : {
    kind: "cubic", x1: previous.x + (command.x - previous.x) / 3, y1: previous.y + (command.y - previous.y) / 3,
    x2: previous.x + (command.x - previous.x) * 2 / 3, y2: previous.y + (command.y - previous.y) * 2 / 3,
    x: command.x, y: command.y,
  };
  return updated;
}
