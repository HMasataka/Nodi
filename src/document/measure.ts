import { Result } from "@praha/byethrow";

import { composeTransform, cornersAabb, IDENTITY_TRANSFORM, nodeTransform, type Point, type Transform, transformedCorners } from "@/document/transform.ts";
import type { Document, DocumentNode, Geometry } from "@/document/types.ts";
import { type DocumentHistory, getRevision } from "@/document/history.ts";

export interface Bounds extends Geometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface ElementMeasurement {
  revisionId: string;
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  type: DocumentNode["type"];
  local: Geometry;
  absolute: Bounds;
  rotation: number;
  corners: [Point, Point, Point, Point];
}

export interface RevisionComparison {
  from: ElementMeasurement;
  to: ElementMeasurement;
  delta: {
    local: Geometry;
    absolute: Pick<Bounds, "x" | "y" | "width" | "height" | "centerX" | "centerY">;
    rotation: number;
  };
}

export interface RelativeMeasurement {
  revisionId: string;
  first: ElementMeasurement;
  second: ElementMeasurement;
  centerDelta: { x: number; y: number };
  horizontal: "left" | "overlap" | "right";
  vertical: "above" | "overlap" | "below";
  gapX: number;
  gapY: number;
  overlap: { width: number; height: number; area: number };
}

function measureInDocument(document: Document, revisionId: string, id: string): Result.Result<ElementMeasurement, Error> {
  function visit(nodes: DocumentNode[], parent: Transform, names: string[], parentId: string | null): ElementMeasurement | undefined {
    for (const node of nodes) {
      const world = composeTransform(parent, nodeTransform(node));
      const path = [...names, node.name];
      if (node.id === id) {
        const corners = transformedCorners(world, node.width, node.height);
        return {
          revisionId, id, name: node.name, path: path.join(" › "), parentId, type: node.type,
          local: { x: node.x, y: node.y, width: node.width, height: node.height },
          absolute: cornersAabb(corners), rotation: node.rotation, corners,
        };
      }
      if (node.type === "frame") {
        const child = visit(node.children, world, path, node.id);
        if (child) return child;
      }
    }
  }
  const element = visit(document.children, IDENTITY_TRANSFORM, [], null);
  return element ? Result.succeed(element) : Result.fail(new Error(`リビジョン ${revisionId} に要素 ${id} が見つかりません`));
}

export function measureElementAtRevision(history: DocumentHistory, revisionId: string, elementId: string): Result.Result<ElementMeasurement, Error> {
  const revision = getRevision(history, revisionId);
  if (!revision) return Result.fail(new Error(`リビジョンが見つかりません: ${revisionId}`));
  return measureInDocument(revision.document, revisionId, elementId);
}

export function compareElementRevisions(
  history: DocumentHistory,
  fromRevisionId: string,
  toRevisionId: string,
  elementId: string,
): Result.Result<RevisionComparison, Error> {
  const from = measureElementAtRevision(history, fromRevisionId, elementId);
  if (Result.isFailure(from)) return from;
  const to = measureElementAtRevision(history, toRevisionId, elementId);
  if (Result.isFailure(to)) return to;
  const a = from.value;
  const b = to.value;
  return Result.succeed({
    from: a, to: b,
    delta: {
      local: {
        x: b.local.x - a.local.x, y: b.local.y - a.local.y,
        width: b.local.width - a.local.width, height: b.local.height - a.local.height,
      },
      absolute: {
        x: b.absolute.x - a.absolute.x, y: b.absolute.y - a.absolute.y,
        width: b.absolute.width - a.absolute.width, height: b.absolute.height - a.absolute.height,
        centerX: b.absolute.centerX - a.absolute.centerX,
        centerY: b.absolute.centerY - a.absolute.centerY,
      },
      rotation: b.rotation - a.rotation,
    },
  });
}

export function measureRelativeAtRevision(
  history: DocumentHistory,
  revisionId: string,
  firstId: string,
  secondId: string,
): Result.Result<RelativeMeasurement, Error> {
  const revision = getRevision(history, revisionId);
  if (!revision) return Result.fail(new Error(`リビジョンが見つかりません: ${revisionId}`));
  if (firstId === secondId) return Result.fail(new Error("異なる2つの要素 ID を指定してください"));
  const first = measureInDocument(revision.document, revisionId, firstId);
  if (Result.isFailure(first)) return first;
  const second = measureInDocument(revision.document, revisionId, secondId);
  if (Result.isFailure(second)) return second;
  const a = first.value.absolute;
  const b = second.value.absolute;
  const horizontal = b.left >= a.right ? "right" : b.right <= a.left ? "left" : "overlap";
  const vertical = b.top >= a.bottom ? "below" : b.bottom <= a.top ? "above" : "overlap";
  const gapX = horizontal === "right" ? b.left - a.right : horizontal === "left" ? a.left - b.right : 0;
  const gapY = vertical === "below" ? b.top - a.bottom : vertical === "above" ? a.top - b.bottom : 0;
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return Result.succeed({
    revisionId, first: first.value, second: second.value,
    centerDelta: { x: b.centerX - a.centerX, y: b.centerY - a.centerY },
    horizontal, vertical, gapX, gapY,
    overlap: { width, height, area: width * height },
  });
}
