import { Result } from "@praha/byethrow";
import { collectNodes, findNode } from "@/document/commands/tree.ts";
import type { Document, DocumentNode } from "@/document/types.ts";

export type LayerDirection = "front" | "back" | "forward" | "backward";

export function deleteNodes(document: Document, ids: string[]): Result.Result<Document, Error> {
  const selected = new Set(ids);
  if (selected.size === 0) return Result.fail(new Error("削除する要素を指定してください"));
  for (const id of selected) if (!findNode(document, id)) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  function remove(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.flatMap((node) => {
      if (selected.has(node.id)) return [];
      return [node.type === "frame" ? { ...node, children: remove(node.children) } : node];
    });
  }
  return Result.succeed({ ...document, children: remove(document.children) });
}

export function reorderNode(document: Document, id: string, direction: LayerDirection): Result.Result<Document, Error> {
  if (!["front", "back", "forward", "backward"].includes(direction)) return Result.fail(new Error("重なり順の指定が不正です"));
  let found = false;
  function reorder(nodes: DocumentNode[]): DocumentNode[] {
    const index = nodes.findIndex((node) => node.id === id);
    if (index >= 0) {
      found = true;
      const nextIndex = direction === "front" ? nodes.length - 1 : direction === "back" ? 0
        : direction === "forward" ? Math.min(nodes.length - 1, index + 1) : Math.max(0, index - 1);
      if (index === nextIndex) return nodes;
      const result = [...nodes];
      result.splice(nextIndex, 0, result.splice(index, 1)[0]);
      return result;
    }
    const updated = nodes.map((node) => {
      if (node.type !== "frame") return node;
      const children = reorder(node.children);
      return children === node.children ? node : { ...node, children };
    });
    return updated.every((node, position) => node === nodes[position]) ? nodes : updated;
  }
  const children = reorder(document.children);
  if (!found) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  return Result.succeed(children === document.children ? document : { ...document, children });
}

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
