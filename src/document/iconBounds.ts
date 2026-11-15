import type { DocumentNode, Geometry, PathNode } from "@/document/types.ts";
import { type Transform, transformPoint } from "@/document/transform.ts";

function cubicValue(a: number, b: number, c: number, d: number, t: number): number {
  const inverse = 1 - t;
  return inverse ** 3 * a + 3 * inverse ** 2 * t * b + 3 * inverse * t ** 2 * c + t ** 3 * d;
}

function extrema(a: number, b: number, c: number, d: number): number[] {
  const q = -a + 3 * b - 3 * c + d;
  const r = 2 * (a - 2 * b + c);
  const s = b - a;
  if (Math.abs(q) < 1e-12) return Math.abs(r) < 1e-12 ? [] : [-s / r].filter((t) => t > 0 && t < 1);
  const discriminant = r * r - 4 * q * s;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-r + root) / (2 * q), (-r - root) / (2 * q)].filter((t) => t > 0 && t < 1);
}

function pathBounds(node: PathNode, world: Transform): Geometry {
  const points: { x: number; y: number }[] = [];
  const point = (x: number, y: number) => transformPoint(world, { x: x * node.width, y: y * node.height });
  let previous = point(0, 0);
  for (const command of node.commands) {
    if (command.kind === "close") continue;
    const end = point(command.x, command.y);
    points.push(end);
    if (command.kind === "cubic") {
      const first = point(command.x1, command.y1);
      const second = point(command.x2, command.y2);
      const times = [...extrema(previous.x, first.x, second.x, end.x), ...extrema(previous.y, first.y, second.y, end.y)];
      points.push(...times.map((t) => ({ x: cubicValue(previous.x, first.x, second.x, end.x, t),
        y: cubicValue(previous.y, first.y, second.y, end.y, t) })));
    }
    previous = end;
  }
  const left = Math.min(...points.map(({ x }) => x));
  const top = Math.min(...points.map(({ y }) => y));
  const right = Math.max(...points.map(({ x }) => x));
  const bottom = Math.max(...points.map(({ y }) => y));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function iconBounds(node: DocumentNode, world: Transform, absolute: Geometry): Geometry {
  if (node.type === "path") return pathBounds(node, world);
  if (node.type === "ellipse") {
    const center = transformPoint(world, { x: node.width / 2, y: node.height / 2 });
    const radiusX = Math.hypot(world.a * node.width / 2, world.c * node.height / 2);
    const radiusY = Math.hypot(world.b * node.width / 2, world.d * node.height / 2);
    return { x: center.x - radiusX, y: center.y - radiusY, width: radiusX * 2, height: radiusY * 2 };
  }
  return absolute;
}
