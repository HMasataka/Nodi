import type { Document, DocumentNode, FrameNode, SizeConstraint } from "@/document/types.ts";

/**
 * テキストなど内容から必要なサイズを測る関数。省略時は `hug` を格納済みサイズへ
 * フォールバックする（座標解決は `fixed` / `fill` のみを扱う #158 時点の挙動）。
 */
export interface LayoutMeasure {
  (node: DocumentNode): { width: number; height: number };
}

export interface LayoutResolveOptions {
  measure?: LayoutMeasure;
}

function clampSize(value: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

/**
 * フレームの直接の子を、レイアウト設定とサイズ制約から位置・サイズを解決して返す。
 * 子がフレームの場合は解決後のサイズで再帰的に子を解決する。
 */
function resolveFrameChildren(frame: FrameNode, measure?: LayoutMeasure): DocumentNode[] {
  const horizontal = frame.layoutMode === "horizontal";
  const innerMain = Math.max(0, frame.width - frame.padding * 2);
  const innerCross = Math.max(0, frame.height - frame.padding * 2);
  // 主軸が横なら innerMain が幅・innerCross が高さ。縦なら逆。
  const mainInner = horizontal ? innerMain : innerCross;
  const crossInner = horizontal ? innerCross : innerMain;

  const children = frame.children;
  const count = children.length;
  if (count === 0) return [];

  const mainConstraint = (node: DocumentNode): SizeConstraint => horizontal ? node.widthConstraint : node.heightConstraint;
  const crossConstraint = (node: DocumentNode): SizeConstraint => horizontal ? node.heightConstraint : node.widthConstraint;

  // 交差軸のサイズ（横並びなら高さ、縦並びなら幅）を先に決定する。
  const crossSizes = children.map((child) => {
    const constraint = crossConstraint(child);
    const natural = constraint.mode === "fill" ? crossInner
      : constraint.mode === "hug" ? (horizontal ? (measure?.(child).height ?? child.height) : (measure?.(child).width ?? child.width))
      : horizontal ? child.height : child.width;
    return clampSize(natural, constraint.min, constraint.max);
  });

  // 主軸の自然サイズ。`fill` は残りを分け合うため一旦 0 として集計する。
  const naturalMains = children.map((child) => {
    const constraint = mainConstraint(child);
    if (constraint.mode === "fill") return 0;
    if (constraint.mode === "hug") return horizontal ? (measure?.(child).width ?? child.width) : (measure?.(child).height ?? child.height);
    return horizontal ? child.width : child.height;
  });

  const gapSum = frame.gap * Math.max(0, count - 1);
  const extra = Math.max(0, mainInner - naturalMains.reduce((sum, size) => sum + size, 0) - gapSum);
  const fillCount = children.filter((child) => mainConstraint(child).mode === "fill").length;
  const fillMain = fillCount > 0 ? extra / fillCount : 0;

  const mains = children.map((child, index) => {
    const constraint = mainConstraint(child);
    const natural = constraint.mode === "fill" ? fillMain : naturalMains[index];
    return clampSize(natural, constraint.min, constraint.max);
  });

  // 主軸の分配（justifyContent）。`fill` が余白を吸収するため、残りは固定・内容追従のみに生じる。
  const free = Math.max(0, mainInner - mains.reduce((sum, size) => sum + size, 0) - gapSum);
  let offset = 0;
  if (frame.justifyContent === "center") offset = free / 2;
  else if (frame.justifyContent === "end") offset = free;
  const spacing = frame.justifyContent === "space-between" && count > 1 ? free / (count - 1) : 0;

  let main = frame.padding + offset;
  return children.map((child, index) => {
    const cross = crossSizes[index];
    const crossPosition = frame.alignItems === "center" ? frame.padding + (crossInner - cross) / 2
      : frame.alignItems === "end" ? frame.padding + crossInner - cross
      : frame.padding;
    const positioned: DocumentNode = horizontal
      ? { ...child, x: main, y: crossPosition, width: mains[index], height: cross }
      : { ...child, x: crossPosition, y: main, width: cross, height: mains[index] };
    main += mains[index] + frame.gap + spacing;
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
  return { ...document, children: document.children.map((child) => resolveNode(child, measure)) };
}
