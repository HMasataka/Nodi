import type { Geometry } from "@/document/types.ts";

export interface Point { x: number; y: number }
export interface Transform { a: number; b: number; c: number; d: number; e: number; f: number }

export const IDENTITY_TRANSFORM: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function rotationComponents(degrees: number) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return { cosine: Math.abs(cosine) < 1e-15 ? 0 : cosine, sine: Math.abs(sine) < 1e-15 ? 0 : sine };
}

export function rotatePoint(point: Point, degrees: number, center: Point = { x: 0, y: 0 }): Point {
  const { cosine, sine } = rotationComponents(degrees);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine };
}

export function composeTransform(parent: Transform, child: Transform): Transform {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    e: parent.a * child.e + parent.c * child.f + parent.e,
    f: parent.b * child.e + parent.d * child.f + parent.f,
  };
}

export function nodeTransform(node: Geometry & { rotation: number }): Transform {
  const { cosine: a, sine: b } = rotationComponents(node.rotation);
  const c = -b;
  const d = a;
  const centerX = node.width / 2;
  const centerY = node.height / 2;
  return { a, b, c, d, e: node.x + centerX - a * centerX - c * centerY, f: node.y + centerY - b * centerX - d * centerY };
}

export function transformPoint(transform: Transform, point: Point): Point {
  return { x: transform.a * point.x + transform.c * point.y + transform.e, y: transform.b * point.x + transform.d * point.y + transform.f };
}

export function transformVector(transform: Transform, vector: Point): Point {
  return { x: transform.a * vector.x + transform.c * vector.y, y: transform.b * vector.x + transform.d * vector.y };
}

export function invertTransform(transform: Transform): Transform {
  const determinant = transform.a * transform.d - transform.b * transform.c;
  const a = transform.d / determinant;
  const b = -transform.b / determinant;
  const c = -transform.c / determinant;
  const d = transform.a / determinant;
  return { a, b, c, d, e: -a * transform.e - c * transform.f, f: -b * transform.e - d * transform.f };
}

export function transformedCorners(transform: Transform, width: number, height: number): [Point, Point, Point, Point] {
  return [
    transformPoint(transform, { x: 0, y: 0 }),
    transformPoint(transform, { x: width, y: 0 }),
    transformPoint(transform, { x: width, y: height }),
    transformPoint(transform, { x: 0, y: height }),
  ];
}

export function cornersAabb(corners: readonly Point[]) {
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left, height: bottom - top, left, top, right, bottom,
    centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
}
