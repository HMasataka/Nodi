import { Result } from "@praha/byethrow";
import { findNode } from "@/document/commands/tree.ts";
import { locateSelection } from "@/document/geometry.ts";
import type { Document, DocumentNode } from "@/document/types.ts";

export type Alignment = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

export function alignNodes(document: Document, ids: string[], alignment: Alignment): Result.Result<Document, Error> {
  if (!["left", "centerX", "right", "top", "centerY", "bottom"].includes(alignment)) return Result.fail(new Error("整列方向が不正です"));
  const selected = new Set(ids);
  for (const id of selected) if (!findNode(document, id)) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  const located = locateSelection(document, selected);
  if (located.length < 2) return Result.fail(new Error("異なる2つ以上の要素を選択してください"));
  const left = Math.min(...located.map(({ absolute }) => absolute.x));
  const top = Math.min(...located.map(({ absolute }) => absolute.y));
  const right = Math.max(...located.map(({ absolute }) => absolute.x + absolute.width));
  const bottom = Math.max(...located.map(({ absolute }) => absolute.y + absolute.height));
  const target = alignment === "left" ? left : alignment === "right" ? right : alignment === "centerX" ? (left + right) / 2
    : alignment === "top" ? top : alignment === "bottom" ? bottom : (top + bottom) / 2;
  const positions = new Map(located.map(({ node, absolute }) => {
    const current = alignment === "left" ? absolute.x : alignment === "right" ? absolute.x + absolute.width
      : alignment === "centerX" ? absolute.x + absolute.width / 2 : alignment === "top" ? absolute.y
        : alignment === "bottom" ? absolute.y + absolute.height : absolute.y + absolute.height / 2;
    return [node.id, alignment === "left" || alignment === "right" || alignment === "centerX"
      ? { x: node.x + target - current, y: node.y }
      : { x: node.x, y: node.y + target - current }] as const;
  }));
  if ([...positions.values()].some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return Result.fail(new Error("整列後の座標が不正です"));
  let changed = false;
  function update(nodes: DocumentNode[]): DocumentNode[] {
    const next = nodes.map((node) => {
      const position = positions.get(node.id);
      if (position && (node.x !== position.x || node.y !== position.y)) {
        changed = true;
        return { ...node, ...position };
      }
      if (node.type === "frame" && !position) {
        const children = update(node.children);
        return children === node.children ? node : { ...node, children };
      }
      return node;
    });
    return next.every((node, index) => node === nodes[index]) ? nodes : next;
  }
  const children = update(document.children);
  return Result.succeed(changed ? { ...document, children } : document);
}
