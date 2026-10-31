import { Result } from "@praha/byethrow";
import { collectNodes, findNode } from "@/document/commands/tree.ts";
import type { Document, DocumentNode } from "@/document/types.ts";

export function deleteNode(document: Document, id: string): Result.Result<Document, Error> {
  let found = false;
  function remove(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.flatMap((node) => {
      if (node.id === id) {
        found = true;
        return [];
      }
      return [node.type === "frame" ? { ...node, children: remove(node.children) } : node];
    });
  }
  const children = remove(document.children);
  return found
    ? Result.succeed({ ...document, children })
    : Result.fail(new Error(`要素が見つかりません: ${id}`));
}

export function duplicateNode(
  document: Document,
  id: string,
): Result.Result<{ document: Document; node: DocumentNode }, Error> {
  const source = findNode(document, id);
  if (!source) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  const existing = collectNodes(document.children);
  const ids = new Set(existing.map((node) => node.id));
  const names = new Set(existing.map((node) => node.name));
  let name = `${source.name} のコピー`;
  let number = 2;
  while (names.has(name)) name = `${source.name} のコピー ${number++}`;

  function copy(node: DocumentNode, root = false): DocumentNode {
    let nextId: string;
    do {
      nextId = `nd_${crypto.randomUUID()}`;
    } while (ids.has(nextId));
    ids.add(nextId);
    const geometry = root ? { x: node.x + 24, y: node.y + 24 } : {};
    const copiedName = root ? name : node.name;
    return node.type === "frame"
      ? { ...node, ...geometry, id: nextId, name: copiedName, children: node.children.map((child) => copy(child)) }
      : { ...node, ...geometry, id: nextId, name: copiedName };
  }

  const duplicated = copy(source, true);
  function insert(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.flatMap((node) => {
      if (node.id === id) return [node, duplicated];
      return [node.type === "frame" ? { ...node, children: insert(node.children) } : node];
    });
  }
  return Result.succeed({ document: { ...document, children: insert(document.children) }, node: duplicated });
}
