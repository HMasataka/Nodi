import { Result } from "@praha/byethrow";

import { overrideTarget } from "@/document/overridePath.ts";
import { validateName } from "@/document/commands/validation.ts";
import { collectNodes, findNode, updateNode } from "@/document/commands/tree.ts";
import { type Document, type DocumentNode, type InstanceNode, type InstanceOverride, LAYOUT_ALIGNMENTS, LAYOUT_JUSTIFIES, LAYOUT_MODES, TEXT_FONT_FAMILIES } from "@/document/types.ts";
import { resolveInstanceNode, unsupportedOverrideKeys } from "@/document/instances.ts";

export interface CreateInstanceInput {
  componentRef: string;
  name?: string;
  parentId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export function createInstance(document: Document, input: CreateInstanceInput): Result.Result<{ document: Document; node: InstanceNode }, Error> {
  const definition = document.components.find((component) => component.id === input.componentRef);
  if (!definition) return Result.fail(new Error(`コンポーネント定義が見つかりません: ${input.componentRef}`));
  const parent = input.parentId === undefined ? undefined : findNode(document, input.parentId);
  if (input.parentId !== undefined && parent?.type !== "frame") {
    return Result.fail(new Error(`親フレームが見つかりません: ${input.parentId}`));
  }
  const width = input.width ?? definition.node.width;
  const height = input.height ?? definition.node.height;
  if (![input.x, input.y, width, height].every(Number.isFinite)) {
    return Result.fail(new Error("座標とサイズは有限の数値で指定してください"));
  }
  if (width <= 0 || height <= 0) return Result.fail(new Error("幅と高さは正の有限の数値で指定してください"));

  const name = input.name ?? definition.name;
  const nameResult = validateName(name);
  if (Result.isFailure(nameResult)) return nameResult;

  const ids = new Set(collectNodes(document.children).map((node) => node.id));
  let id: string;
  do {
    id = `nd_${crypto.randomUUID()}`;
  } while (ids.has(id));

  const node: InstanceNode = {
    id, name, type: "instance", componentRef: input.componentRef, overrides: {},
    x: input.x, y: input.y, width, height, rotation: 0, visible: true, opacity: 1, shadow: null, blur: 0,
    widthConstraint: { mode: "fixed" }, heightConstraint: { mode: "fixed" }, animations: [],
  };

  if (parent === undefined) {
    return Result.succeed({ document: { ...document, children: [...document.children, node] }, node });
  }
  const updated = updateNode(document, parent.id, (current) =>
    current.type === "frame" ? { ...current, children: [...current.children, node] } : current,
  );
  if (Result.isFailure(updated)) return updated;
  return Result.succeed({ document: updated.value, node });
}

const positive = (value: number | undefined) => value === undefined || (Number.isFinite(value) && value > 0);
const nonNegative = (value: number | undefined) => value === undefined || (Number.isFinite(value) && value >= 0);
const oneOf = <T>(value: T | undefined, values: readonly T[]) => value === undefined || values.includes(value);

// 値の範囲は保存形式と同じにする。範囲外の値は保存できないので、編集の時点で拒否する。
function overrideValueIssue(patch: InstanceOverride): string | null {
  if (!positive(patch.width) || !positive(patch.height)) return "幅と高さは正の数で指定してください";
  if (patch.visible !== undefined && typeof patch.visible !== "boolean") return "表示は true か false で指定してください";
  if (patch.opacity !== undefined && !(Number.isFinite(patch.opacity) && patch.opacity >= 0 && patch.opacity <= 1)) return "不透明度は 0 から 1 で指定してください";
  if (patch.cornerRadii !== undefined && !Object.values(patch.cornerRadii).every((value) => nonNegative(value))) return "角丸は 0 以上で指定してください";
  if (!oneOf(patch.layoutMode, LAYOUT_MODES) || !oneOf(patch.alignItems, LAYOUT_ALIGNMENTS) || !oneOf(patch.justifyContent, LAYOUT_JUSTIFIES)) return "レイアウトの指定が不正です";
  if (!nonNegative(patch.padding) || !nonNegative(patch.gap)) return "余白と間隔は 0 以上で指定してください";
  if (!positive(patch.fontSize) || !positive(patch.lineHeight)) return "文字サイズと行高は正の数で指定してください";
  if (patch.fontWeight !== undefined && !(Number.isInteger(patch.fontWeight) && patch.fontWeight >= 100 && patch.fontWeight <= 900 && patch.fontWeight % 100 === 0)) return "太さは 100〜900 の 100 刻みで指定してください";
  if (!oneOf(patch.fontFamily, TEXT_FONT_FAMILIES) || !oneOf(patch.textAlign, ["left", "center", "right"] as const)) return "書体または揃えの指定が不正です";
  if (patch.letterSpacing !== undefined && !Number.isFinite(patch.letterSpacing)) return "字間は有限の数で指定してください";
  return null;
}

export function setInstanceOverride(document: Document, instanceId: string, childId: string, patch: InstanceOverride): Result.Result<Document, Error> {
  if (Object.keys(patch).length === 0) return Result.fail(new Error("変更する属性を指定してください"));
  const issue = overrideValueIssue(patch);
  if (issue) return Result.fail(new Error(issue));
  const instance = findNode(document, instanceId);
  if (!instance || instance.type !== "instance") return Result.fail(new Error(`インスタンスが見つかりません: ${instanceId}`));
  const definition = document.components.find((component) => component.id === instance.componentRef);
  if (!definition) return Result.fail(new Error(`コンポーネント定義が見つかりません: ${instance.componentRef}`));
  const definitionOf = (ref: string) => document.components.find((component) => component.id === ref)?.node;
  const target = overrideTarget(definition.node, childId, definitionOf);
  if (!target) return Result.fail(new Error(`オーバーライド対象が見つかりません: ${childId}`));
  const unsupported = unsupportedOverrideKeys(target.type, patch);
  if (unsupported.length > 0) return Result.fail(new Error(`${target.type} には上書きできない属性です: ${unsupported.join(", ")}`));
  const overrides = { ...instance.overrides, [childId]: { ...instance.overrides[childId], ...patch } };
  return updateNode(document, instanceId, (node) => node.type === "instance" ? { ...node, overrides } : node);
}

export function resetInstanceOverride(document: Document, instanceId: string, childId: string): Result.Result<Document, Error> {
  const instance = findNode(document, instanceId);
  if (!instance || instance.type !== "instance") return Result.fail(new Error(`インスタンスが見つかりません: ${instanceId}`));
  if (!(childId in instance.overrides)) return Result.fail(new Error(`オーバーライドがありません: ${childId}`));
  const overrides = { ...instance.overrides };
  delete overrides[childId];
  return updateNode(document, instanceId, (node) => node.type === "instance" ? { ...node, overrides } : node);
}

function copyTree(node: DocumentNode, used: Set<string>): DocumentNode {
  let id: string;
  do {
    id = `nd_${crypto.randomUUID()}`;
  } while (used.has(id));
  used.add(id);
  if (node.type === "frame") return { ...node, id, children: node.children.map((child) => copyTree(child, used)) };
  return { ...node, id };
}

export function detachInstance(document: Document, instanceId: string): Result.Result<{ document: Document; node: DocumentNode }, Error> {
  const instance = findNode(document, instanceId);
  if (!instance || instance.type !== "instance") return Result.fail(new Error(`インスタンスが見つかりません: ${instanceId}`));
  const resolved = resolveInstanceNode(instance, document);
  if (resolved.type === "instance") return Result.fail(new Error("インスタンスを解決できません"));
  const used = new Set(collectNodes(document.children).map((node) => node.id));
  const detached = copyTree(resolved, used);
  const updated = updateNode(document, instanceId, () => detached);
  if (Result.isFailure(updated)) return updated;
  return Result.succeed({ document: updated.value, node: detached });
}
