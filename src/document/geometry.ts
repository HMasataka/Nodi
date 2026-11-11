import { composeTransform, cornersAabb, IDENTITY_TRANSFORM, nodeTransform, type Transform, transformedCorners } from "@/document/transform.ts";
import type { Document, DocumentNode, Geometry } from "@/document/types.ts";

export interface LocatedNode { node: DocumentNode; absolute: Geometry; parent: Transform; world: Transform }

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
