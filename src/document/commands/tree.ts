import { Result } from "@praha/byethrow";
import type { Document, DocumentNode } from "@/document/types.ts";

export function findNode(document: Document, id: string): DocumentNode | undefined {
  function search(nodes: DocumentNode[]): DocumentNode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.type === "frame") {
        const child = search(node.children);
        if (child) return child;
      }
    }
  }
  return search(document.children);
}

export function collectNodes(nodes: DocumentNode[]): DocumentNode[] {
  return nodes.flatMap((node) => [node, ...(node.type === "frame" ? collectNodes(node.children) : [])]);
}

export function updateNode(
  document: Document,
  id: string,
  update: (node: DocumentNode) => DocumentNode,
): Result.Result<Document, Error> {
  let found = false;
  function updateChildren(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.map((node) => {
      if (node.id === id) {
        found = true;
        return update(node);
      }
      return node.type === "frame" ? { ...node, children: updateChildren(node.children) } : node;
    });
  }
  const children = updateChildren(document.children);
  if (!found) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  return Result.succeed({ ...document, children });
}
