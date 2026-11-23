import type { Document, DocumentNode } from "@/document/types";

export function toggleSelection(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

// すべて選択の対象。選択中の要素と同じ親の子をすべて選び、何も選んでいないときは最上位の要素を選ぶ。
export function selectAllIds(document: Document, selectedIds: readonly string[]): string[] {
  const first = selectedIds[0];
  function siblings(nodes: DocumentNode[]): DocumentNode[] | null {
    if (nodes.some((node) => node.id === first)) return nodes;
    for (const node of nodes) {
      if (node.type !== "frame") continue;
      const found = siblings(node.children);
      if (found) return found;
    }
    return null;
  }
  const nodes = first ? siblings(document.children) ?? document.children : document.children;
  return nodes.map((node) => node.id);
}
