import { maskGroups } from "@/document/masks.ts";
import { composeTransform, cornersAabb, IDENTITY_TRANSFORM, nodeTransform, type Transform, transformedCorners } from "@/document/transform.ts";
import type { Document, DocumentNode, Geometry } from "@/document/types.ts";

export interface LocatedNode { node: DocumentNode; absolute: Geometry; parent: Transform; world: Transform }
export interface VisibleNode extends LocatedNode { visible: Geometry }

type VisitDecision = "stop" | "skipChildren" | void;

export function walkLocatedNodes(document: Document, visit: (entry: LocatedNode) => VisitDecision): void {
  function walk(nodes: DocumentNode[], parent: Transform): boolean {
    for (const node of nodes) {
      const world = composeTransform(parent, nodeTransform(node));
      const { x, y, width, height } = cornersAabb(transformedCorners(world, node.width, node.height));
      const decision = visit({ node, absolute: { x, y, width, height }, parent, world });
      if (decision === "stop") return true;
      if (node.type === "frame" && decision !== "skipChildren" && walk(node.children, world)) return true;
    }
    return false;
  }
  walk(document.children, IDENTITY_TRANSFORM);
}

export function listLocatedNodes(document: Document): LocatedNode[] {
  const located: LocatedNode[] = [];
  walkLocatedNodes(document, (entry) => { located.push(entry); });
  return located;
}

export function absoluteGeometry(document: Document, id: string): Geometry | null {
  let found: Geometry | null = null;
  walkLocatedNodes(document, ({ node, absolute }) => {
    if (node.id === id) { found = absolute; return "stop"; }
  });
  return found;
}

export function locateSelection(document: Document, ids: Set<string>): LocatedNode[] {
  const located: LocatedNode[] = [];
  walkLocatedNodes(document, (entry) => {
    if (ids.has(entry.node.id)) {
      located.push(entry);
      return "skipChildren";
    }
  });
  return located;
}

function intersection(first: Geometry | undefined | null, second: Geometry): Geometry | null {
  if (first === null) return null;
  if (first === undefined) return second;
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const width = Math.min(first.x + first.width, second.x + second.width) - x;
  const height = Math.min(first.y + first.height, second.y + second.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

export function walkVisibleNodes(document: Document, visit: (entry: VisibleNode) => VisitDecision): void {
  let stopped = false;
  function walk(nodes: DocumentNode[], parent: Transform, clip: Geometry | undefined | null): void {
    for (const group of maskGroups(nodes)) {
      if (stopped) return;
      const mask = group.mask;
      const maskWorld = mask ? composeTransform(parent, nodeTransform(mask)) : null;
      const maskBounds = mask && maskWorld ? cornersAabb(transformedCorners(maskWorld, mask.width, mask.height)) : null;
      const groupClip = maskBounds ? intersection(clip, maskBounds) : clip;
      for (const node of group.children) {
        const world = composeTransform(parent, nodeTransform(node));
        const { x, y, width, height } = cornersAabb(transformedCorners(world, node.width, node.height));
        const absolute = { x, y, width, height };
        const visible = intersection(groupClip, absolute);
        const decision = visible ? visit({ node, absolute, visible, parent, world }) : undefined;
        if (decision === "stop") { stopped = true; return; }
        if (node.type === "frame" && decision !== "skipChildren") {
          const childClip = node.clipContent ? intersection(groupClip, absolute) : groupClip;
          if (childClip !== null) walk(node.children, world, childClip);
        }
      }
    }
  }
  walk(document.children, IDENTITY_TRANSFORM, undefined);
}
