import { Result } from "@praha/byethrow";

import { findNode } from "@/document/commands/tree.ts";
import { iconBounds } from "@/document/iconBounds.ts";
import type { Document, DocumentNode, TextNode } from "@/document/types.ts";
import { invertTransform, transformPoint, transformVector } from "@/document/transform.ts";
import { type LocatedNode, locateSelection } from "@/document/geometry.ts";

export interface TextIconAlignment { textY: number; iconY: number; offset: number; fromX: number; toX: number }
export type TextLineCounter = (node: TextNode) => number;

function singleLine(node: TextNode, countLines?: TextLineCounter): boolean {
  if (!node.content.trim() || /[\r\n]/.test(node.content)) return false;
  if (node.height < node.style.fontSize * node.style.lineHeight + 4) return false;
  if (countLines) return countLines(node) === 1;
  // Conservative fallback for non-DOM clients; the editor supplies its renderer's Canvas measurement.
  return Array.from(node.content).length * node.style.fontSize * 0.6 <= node.width - 4;
}

function selection(document: Document, ids: string[], countLines?: TextLineCounter) {
  if (new Set(ids).size !== 2) return Result.fail(new Error("1行のテキストとアイコンを1つずつ選択してください"));
  for (const id of ids) if (!findNode(document, id)) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  let commonParent: string | null | undefined;
  let invalidParent = false;
  function visit(nodes: DocumentNode[], parent: string | null, managed: boolean) {
    for (const node of nodes) {
      if (ids.includes(node.id)) {
        if (commonParent === undefined) commonParent = parent;
        else if (commonParent !== parent) invalidParent = true;
        if (managed) invalidParent = true;
      }
      if (node.type === "frame") visit(node.children, node.id, node.layoutMode !== "none");
    }
  }
  visit(document.children, null, false);
  if (invalidParent) return Result.fail(new Error("同じ親の自由配置要素だけを選択してください"));
  const entries = locateSelection(document, new Set(ids));
  if (entries.length !== 2) return Result.fail(new Error("親子の要素を同時に選択できません"));
  const text = entries.find((entry): entry is LocatedNode & { node: TextNode } => entry.node.type === "text");
  const icon = entries.find(({ node }) => ["rectangle", "ellipse", "path", "image"].includes(node.type));
  if (!text || !icon || ("isMask" in icon.node && icon.node.isMask)) {
    return Result.fail(new Error("テキストと図形・パス・画像を1つずつ選択してください"));
  }
  if (!singleLine(text.node, countLines)) return Result.fail(new Error("折り返しのない1行のテキストを選択してください"));
  return Result.succeed({ text, icon });
}

export function measureTextIconAlignment(document: Document, ids: string[], countLines?: TextLineCounter): Result.Result<TextIconAlignment, Error> {
  const result = selection(document, ids, countLines);
  if (Result.isFailure(result)) return result;
  const { text, icon } = result.value;
  // SVG text has 2px inner padding, matching Canvas PNG's line-box baseline calculation.
  const lineHeight = text.node.style.fontSize * text.node.style.lineHeight;
  const textY = transformPoint(text.world, { x: text.node.width / 2, y: 2 + lineHeight / 2 }).y;
  const bounds = iconBounds(icon.node, icon.world, icon.absolute);
  const iconY = bounds.y + bounds.height / 2;
  return Result.succeed({ textY, iconY, offset: textY - iconY,
    fromX: Math.min(text.absolute.x, bounds.x), toX: Math.max(text.absolute.x + text.absolute.width, bounds.x + bounds.width) });
}

export function alignTextIcon(document: Document, ids: string[], countLines?: TextLineCounter): Result.Result<Document, Error> {
  const result = selection(document, ids, countLines);
  if (Result.isFailure(result)) return result;
  const measurement = measureTextIconAlignment(document, ids, countLines);
  if (Result.isFailure(measurement)) return measurement;
  const { icon } = result.value;
  const delta = transformVector(invertTransform(icon.parent), { x: 0, y: measurement.value.offset });
  const x = icon.node.x + delta.x;
  const y = icon.node.y + delta.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Result.fail(new Error("整列後の座標が不正です"));
  if (x === icon.node.x && y === icon.node.y) return Result.succeed(document);
  function update(nodes: DocumentNode[]): DocumentNode[] {
    let changed = false;
    const next = nodes.map((node) => {
      if (node.id === icon.node.id) { changed = true; return { ...node, x, y }; }
      if (node.type !== "frame") return node;
      const children = update(node.children);
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    });
    return changed ? next : nodes;
  }
  return Result.succeed({ ...document, children: update(document.children) });
}
