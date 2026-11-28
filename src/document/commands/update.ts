import { Result } from "@praha/byethrow";

import { locateSelection } from "@/document/geometry.ts";
import { validColor } from "@/document/colorRef.ts";
import { type Document, type DocumentNode, type Geometry, type Shadow } from "@/document/types.ts";
import { findNode, updateNode } from "@/document/commands/tree.ts";
import { invertTransform, normalizeRotation, transformVector } from "@/document/transform.ts";
import { validateGeometry, validateName } from "@/document/commands/validation.ts";

export function moveNodes(document: Document, ids: string[], dx: number, dy: number): Result.Result<Document, Error> {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return Result.fail(new Error("移動量は有限の数値で指定してください"));
  const selected = new Set(ids);
  if (selected.size === 0) return Result.fail(new Error("移動する要素を指定してください"));
  for (const id of selected) {
    const node = findNode(document, id);
    if (!node) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  }
  if (dx === 0 && dy === 0) return Result.succeed(document);
  const positions = new Map(locateSelection(document, selected).map(({ node, parent }) => {
    const delta = transformVector(invertTransform(parent), { x: dx, y: dy });
    return [node.id, { x: node.x + delta.x, y: node.y + delta.y }] as const;
  }));
  if ([...positions.values()].some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return Result.fail(new Error("移動後の座標が不正です"));
  function move(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.map((node) => {
      const position = positions.get(node.id);
      if (position) return { ...node, ...position };
      return node.type === "frame" ? { ...node, children: move(node.children) } : node;
    });
  }
  return Result.succeed({ ...document, children: move(document.children) });
}

export function renameNode(document: Document, id: string, name: string): Result.Result<Document, Error> {
  const validated = validateName(name);
  if (Result.isFailure(validated)) return validated;
  return updateNode(document, id, (node) => node.name === name ? node : { ...node, name });
}

export function moveNode(document: Document, id: string, x: number, y: number): Result.Result<Document, Error> {
  if (![x, y].every(Number.isFinite)) {
    return Result.fail(new Error("座標は有限の数値で指定してください"));
  }
  return updateNode(document, id, (node) => node.x === x && node.y === y ? node : { ...node, x, y });
}

export function setNodeGeometry(
  document: Document,
  id: string,
  geometry: Geometry,
): Result.Result<Document, Error> {
  const validated = validateGeometry(geometry);
  if (Result.isFailure(validated)) return validated;
  return updateNode(document, id, (node) => node.x === geometry.x && node.y === geometry.y && node.width === geometry.width && node.height === geometry.height
    ? node : { ...node, ...geometry });
}

export function setRotation(document: Document, id: string, rotation: number): Result.Result<Document, Error> {
  if (!Number.isFinite(rotation)) return Result.fail(new Error("回転角は有限の数値で指定してください"));
  const normalized = normalizeRotation(rotation);
  return updateNode(document, id, (node) => node.rotation === normalized ? node : { ...node, rotation: normalized });
}

export function setOpacity(document: Document, id: string, opacity: number): Result.Result<Document, Error> {
  if (typeof opacity !== "number" || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    return Result.fail(new Error("不透明度は 0 から 1 の有限値で指定してください"));
  }
  return updateNode(document, id, (node) => node.opacity === opacity ? node : { ...node, opacity });
}

export function setVisible(document: Document, id: string, visible: boolean): Result.Result<Document, Error> {
  if (typeof visible !== "boolean") return Result.fail(new Error("表示は true か false で指定してください"));
  return updateNode(document, id, (node) => node.visible === visible ? node : { ...node, visible });
}

export function setShadow(document: Document, id: string, shadow: Shadow | null): Result.Result<Document, Error> {
  if (shadow !== null && (!shadow || typeof shadow !== "object" || Array.isArray(shadow) ||
    Object.keys(shadow).sort().join() !== "blur,color,offsetX,offsetY" ||
    !validColor(shadow.color) ||
    !Number.isFinite(shadow.offsetX) || !Number.isFinite(shadow.offsetY) || !Number.isFinite(shadow.blur) || shadow.blur < 0)) {
    return Result.fail(new Error("影の色・位置・ぼかし量が不正です"));
  }
  return updateNode(document, id, (node) => node.shadow === shadow || (node.shadow !== null && shadow !== null &&
    node.shadow.color === shadow.color && node.shadow.offsetX === shadow.offsetX && node.shadow.offsetY === shadow.offsetY && node.shadow.blur === shadow.blur)
    ? node : { ...node, shadow: shadow === null ? null : { ...shadow } });
}

export function setBlur(document: Document, id: string, blur: number): Result.Result<Document, Error> {
  if (typeof blur !== "number" || !Number.isFinite(blur) || blur < 0) return Result.fail(new Error("ぼかし量は 0 以上の有限値で指定してください"));
  return updateNode(document, id, (node) => node.blur === blur ? node : { ...node, blur });
}

export function setMask(document: Document, id: string, isMask: boolean): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || (node.type !== "rectangle" && node.type !== "ellipse")) return Result.fail(new Error(`マスクにできる図形が見つかりません: ${id}`));
  if (typeof isMask !== "boolean") return Result.fail(new Error("マスクの指定が不正です"));
  return updateNode(document, id, (current) => (current.type === "rectangle" || current.type === "ellipse") && current.isMask !== isMask
    ? { ...current, isMask } : current);
}
