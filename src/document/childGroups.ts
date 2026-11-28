import type { DocumentNode } from "@/document/types.ts";

/** 子の並びの1つ。フレームの `children`、またはインスタンスの slot に差し替えた中身。`path` は要素から見た場所。 */
export interface ChildGroup<N> { path: (string | number)[]; nodes: N[] }

/**
 * 要素の直下にある子の並び。フレームは `children`、インスタンスは slot ごとの差し替えた中身を返す。
 * 文書の木をたどる処理（検索・更新・検証）はこれを使い、slot の中身も文書の一部として扱う。
 */
export function childGroups<N extends { type: string }>(node: N): ChildGroup<N>[] {
  if (node.type === "frame") return [{ path: ["children"], nodes: (node as unknown as { children: N[] }).children }];
  if (node.type === "instance") {
    const slots = (node as unknown as { slots?: Record<string, N[]> }).slots ?? {};
    return Object.entries(slots).map(([key, nodes]) => ({ path: ["slots", key], nodes }));
  }
  return [];
}

/** 要素の直下の子をすべて並べる（フレームの子と slot の中身）。 */
export function childNodes<N extends { type: string }>(node: N): N[] {
  return childGroups(node).flatMap((group) => group.nodes);
}

/** 子の並びごとに `map` を適用した要素を返す。変更がなければ入力と同じ参照を返す。 */
export function mapChildGroups(node: DocumentNode, map: (nodes: DocumentNode[]) => DocumentNode[]): DocumentNode {
  if (node.type === "frame") {
    const children = map(node.children);
    return children === node.children ? node : { ...node, children };
  }
  if (node.type === "instance" && node.slots && Object.keys(node.slots).length > 0) {
    let changed = false;
    const slots = Object.fromEntries(Object.entries(node.slots).map(([key, nodes]) => {
      const next = map(nodes);
      if (next !== nodes) changed = true;
      return [key, next];
    }));
    return changed ? { ...node, slots } : node;
  }
  return node;
}
