import type { Document, DocumentNode, Geometry } from "@/document/types.ts";

export interface LocatedNode { node: DocumentNode; absolute: Geometry }

export function absoluteGeometry(document: Document, id: string): Geometry | null {
  function visit(nodes: DocumentNode[], originX: number, originY: number): Geometry | null {
    for (const node of nodes) {
      const x = originX + node.x;
      const y = originY + node.y;
      if (node.id === id) return { x, y, width: node.width, height: node.height };
      if (node.type === "frame") {
        const found = visit(node.children, x, y);
        if (found) return found;
      }
    }
    return null;
  }
  return visit(document.children, 0, 0);
}

export function locateSelection(document: Document, ids: Set<string>): LocatedNode[] {
  const located: LocatedNode[] = [];
  function visit(nodes: DocumentNode[], originX: number, originY: number) {
    for (const node of nodes) {
      const x = originX + node.x;
      const y = originY + node.y;
      if (ids.has(node.id)) {
        located.push({ node, absolute: { x, y, width: node.width, height: node.height } });
      } else if (node.type === "frame") visit(node.children, x, y);
    }
  }
  visit(document.children, 0, 0);
  return located;
}
