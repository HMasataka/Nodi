import { nodeTransform } from "@/document/transform.ts";
import type { DocumentNode, EllipseNode, RectangleNode } from "@/document/types.ts";
import { ellipsePath, roundedRectPath, transformPath } from "@/document/shapePath.ts";

export type MaskNode = RectangleNode | EllipseNode;
export interface MaskGroup { mask: MaskNode | null; children: DocumentNode[] }

// 描画・PNG 書き出し・当たり判定はこの分け方を共有する。隠した要素はどの組にも入れず、隠したマスクは切り抜かない。
export function maskGroups(nodes: DocumentNode[]): MaskGroup[] {
  const groups: MaskGroup[] = [];
  let mask: MaskNode | null = null;
  let children: DocumentNode[] = [];
  for (const node of nodes) {
    if (!node.visible) continue;
    if ((node.type === "rectangle" || node.type === "ellipse") && node.isMask) {
      if (children.length > 0 || mask) groups.push({ mask, children });
      mask = node;
      children = [];
    } else children.push(node);
  }
  if (children.length > 0 || mask) groups.push({ mask, children });
  return groups;
}

export function maskPath(mask: MaskNode) {
  const path = mask.type === "rectangle"
    ? roundedRectPath(0, 0, mask.width, mask.height, mask.style.cornerRadii)
    : ellipsePath(mask.width / 2, mask.height / 2, mask.width / 2, mask.height / 2);
  return transformPath(path, nodeTransform(mask));
}
