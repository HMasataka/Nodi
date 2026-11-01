import type { Document, DocumentNode, Geometry } from "@/document/types.ts";

export interface LocatedNode { node: DocumentNode; absolute: Geometry }

type VisitDecision = "stop" | "skipChildren" | void;

export function walkLocatedNodes(document: Document, visit: (entry: LocatedNode) => VisitDecision): void {
  function walk(nodes: DocumentNode[], parentX: number, parentY: number): boolean {
    for (const node of nodes) {
      const x = parentX + node.x;
      const y = parentY + node.y;
      const decision = visit({ node, absolute: { x, y, width: node.width, height: node.height } });
      if (decision === "stop") return true;
      if (node.type === "frame" && decision !== "skipChildren" && walk(node.children, x, y)) return true;
    }
    return false;
  }
  walk(document.children, 0, 0);
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
