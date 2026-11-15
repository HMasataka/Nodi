import { resolveDocumentSpacing } from "@/document/spacing.ts";
import type { Document, DocumentNode, FrameNode } from "@/document/types.ts";

/**
 * テキストなど内容から必要なサイズを測る関数。`wrapWidth` を渡すと、その幅で折り返した
 * ときの高さを返す。省略時は `hug` を格納済みサイズへフォールバックする。
 */
export interface LayoutMeasure {
  (node: DocumentNode, wrapWidth?: number): { width: number; height: number };
}

export interface LayoutResolveOptions {
  measure?: LayoutMeasure;
}

function clampSize(value: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

function naturalWidth(child: DocumentNode, measure?: LayoutMeasure): number {
  const constraint = child.widthConstraint;
  if (constraint.mode === "fill") return 0;
  if (constraint.mode === "hug") return measure ? measure(child).width : child.width;
  return child.width;
}

function naturalHeight(child: DocumentNode, width: number, measure?: LayoutMeasure): number {
  const constraint = child.heightConstraint;
  if (constraint.mode === "fill") return 0;
  if (constraint.mode === "hug") return measure ? measure(child, width).height : child.height;
  return child.height;
}

/**
 * フレームの直接の子を、レイアウト設定とサイズ制約から位置・サイズを解決して返す。
 * テキストの高さは幅に依存するため、まず幅を解決してから高さを決める。
 * 子がフレームの場合は解決後のサイズで再帰的に子を解決する。
 */
function resolveFrameChildren(frame: FrameNode, measure?: LayoutMeasure): DocumentNode[] {
  const horizontal = frame.layoutMode === "horizontal";
  const innerW = Math.max(0, frame.width - frame.padding * 2);
  const innerH = Math.max(0, frame.height - frame.padding * 2);
  const innerMain = horizontal ? innerW : innerH;
  const innerCross = horizontal ? innerH : innerW;
  const children = frame.children;
  const count = children.length;
  if (count === 0) return [];

  // 1. 幅を解決する。主軸（横並び）の fill は残りを分け、交差軸（縦並び）の fill は内寸まで伸ばす。
  const naturalWidths = children.map((child) => naturalWidth(child, measure));
  const gapSum = frame.gap * Math.max(0, count - 1);
  const widths = horizontal
    ? (() => {
      const extra = Math.max(0, innerMain - naturalWidths.reduce((sum, size) => sum + size, 0) - gapSum);
      const fillCount = children.filter((child) => child.widthConstraint.mode === "fill").length;
      const fillWidth = fillCount > 0 ? extra / fillCount : 0;
      return children.map((child, index) => clampSize(child.widthConstraint.mode === "fill" ? fillWidth : naturalWidths[index], child.widthConstraint.min, child.widthConstraint.max));
    })()
    : children.map((child, index) => {
      const constraint = child.widthConstraint;
      return clampSize(constraint.mode === "fill" ? innerCross : naturalWidths[index], constraint.min, constraint.max);
    });

  // 2. 高さを解決する。hug は解決後の幅で折り返した内容の高さを使う。
  const naturalHeights = children.map((child, index) => naturalHeight(child, widths[index], measure));
  const heights = horizontal
    ? children.map((child, index) => {
      const constraint = child.heightConstraint;
      return clampSize(constraint.mode === "fill" ? innerCross : naturalHeights[index], constraint.min, constraint.max);
    })
    : (() => {
      const extra = Math.max(0, innerMain - naturalHeights.reduce((sum, size) => sum + size, 0) - gapSum);
      const fillCount = children.filter((child) => child.heightConstraint.mode === "fill").length;
      const fillHeight = fillCount > 0 ? extra / fillCount : 0;
      return children.map((child, index) => clampSize(child.heightConstraint.mode === "fill" ? fillHeight : naturalHeights[index], child.heightConstraint.min, child.heightConstraint.max));
    })();

  // 3. 主軸の位置を決める（justifyContent）。fill が余白を吸収するため、残りは固定・内容追従のみに生じる。
  const mainSizes = horizontal ? widths : heights;
  const free = Math.max(0, innerMain - mainSizes.reduce((sum, size) => sum + size, 0) - gapSum);
  let offset = 0;
  if (frame.justifyContent === "center") offset = free / 2;
  else if (frame.justifyContent === "end") offset = free;
  const spacing = frame.justifyContent === "space-between" && count > 1 ? free / (count - 1) : 0;

  let main = frame.padding + offset;
  return children.map((child, index) => {
    const cross = horizontal ? heights[index] : widths[index];
    const crossPosition = frame.alignItems === "center" ? frame.padding + (innerCross - cross) / 2
      : frame.alignItems === "end" ? frame.padding + innerCross - cross
      : frame.padding;
    const positioned: DocumentNode = horizontal
      ? { ...child, x: main, y: crossPosition, width: widths[index], height: heights[index] }
      : { ...child, x: crossPosition, y: main, width: widths[index], height: heights[index] };
    main += mainSizes[index] + frame.gap + spacing;
    return resolveNode(positioned, measure);
  });
}

function resolveNode(node: DocumentNode, measure?: LayoutMeasure): DocumentNode {
  if (node.type !== "frame") return node;
  if (node.layoutMode === "none") {
    const children = node.children.map((child) => resolveNode(child, measure));
    return children === node.children ? node : { ...node, children };
  }
  return { ...node, children: resolveFrameChildren(node, measure) };
}

/**
 * 文書全体の自動レイアウトを解決した文書を返す。入力の文書は変更しない。
 * `layoutMode: "none"` のフレームは子の座標を維持しつつ、内部の自動レイアウトは再帰的に解決する。
 */
export function resolveDocumentLayout(document: Document, options: LayoutResolveOptions = {}): Document {
  const measure = options.measure;
  const concrete = resolveDocumentSpacing(document);
  return { ...concrete, children: concrete.children.map((child) => resolveNode(child, measure)) };
}
