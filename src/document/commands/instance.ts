import { Result } from "@praha/byethrow";

import { mapChildGroups } from "@/document/childGroups.ts";
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

// 定義のツリーの中の要素を更新する。見つからなければ undefined。
function updateDefinitionNode(node: DocumentNode, id: string, update: (node: DocumentNode) => DocumentNode): DocumentNode | undefined {
  if (node.id === id) return update(node);
  if (node.type !== "frame") return undefined;
  for (const [index, child] of node.children.entries()) {
    const updated = updateDefinitionNode(child, id, update);
    if (updated) return { ...node, children: node.children.map((item, position) => position === index ? updated : item) };
  }
  return undefined;
}

// slot でなくなったフレームを指す差し替えを、文書と定義のすべてのインスタンスから外す（取り残さない）。
function pruneSlots(document: Document): Document {
  const definitionOf = (ref: string) => document.components.find((component) => component.id === ref)?.node;
  const prune = (node: DocumentNode): DocumentNode => {
    const pruned = mapChildGroups(node, (nodes) => nodes.map(prune));
    if (pruned.type !== "instance" || !pruned.slots) return pruned;
    const definition = definitionOf(pruned.componentRef);
    const entries = Object.entries(pruned.slots).filter(([key]) => {
      const target = definition ? overrideTarget(definition, key, definitionOf) : undefined;
      return target?.type === "frame" && target.slot === true;
    });
    if (entries.length === Object.keys(pruned.slots).length) return pruned;
    const { slots: _removed, ...rest } = pruned;
    return entries.length === 0 ? rest : { ...rest, slots: Object.fromEntries(entries) };
  };
  return { ...document, children: document.children.map(prune), components: document.components.map((component) => ({ ...component, node: prune(component.node) })) };
}

/**
 * コンポーネントの定義のフレームに slot の印を付ける・外す。子は既定の中身になる。
 * 外したときは、そのフレームを指していたインスタンスの差し替えも一緒に外す。
 */
export function setComponentSlot(document: Document, componentId: string, nodeId: string, slot: boolean): Result.Result<Document, Error> {
  const definition = document.components.find((component) => component.id === componentId);
  if (!definition) return Result.fail(new Error(`コンポーネント定義が見つかりません: ${componentId}`));
  if (typeof slot !== "boolean") return Result.fail(new Error("slot は true か false で指定してください"));
  const target = collectNodes([definition.node]).find((node) => node.id === nodeId);
  if (!target) return Result.fail(new Error(`定義の中に要素が見つかりません: ${nodeId}`));
  if (target.type !== "frame") return Result.fail(new Error("slot はフレームにだけ付けられます"));
  if ((target.slot === true) === slot) return Result.succeed(document);
  const node = updateDefinitionNode(definition.node, nodeId, (current) => {
    if (current.type !== "frame") return current;
    const { slot: _removed, ...rest } = current;
    return slot ? { ...rest, slot: true } : rest;
  })!;
  const updated = { ...document, components: document.components.map((component) => component.id === componentId ? { ...component, node } : component) };
  return Result.succeed(slot ? updated : pruneSlots(updated));
}

function slotTarget(document: Document, instanceId: string, slotId: string): Result.Result<InstanceNode, Error> {
  const instance = findNode(document, instanceId);
  if (!instance || instance.type !== "instance") return Result.fail(new Error(`インスタンスが見つかりません: ${instanceId}`));
  const definitionOf = (ref: string) => document.components.find((component) => component.id === ref)?.node;
  const definition = definitionOf(instance.componentRef);
  if (!definition) return Result.fail(new Error(`コンポーネント定義が見つかりません: ${instance.componentRef}`));
  const target = overrideTarget(definition, slotId, definitionOf);
  if (target?.type !== "frame" || !target.slot) return Result.fail(new Error(`slot が見つかりません: ${slotId}`));
  return Result.succeed(instance);
}

/**
 * インスタンスの slot の中身を、文書の要素 `nodeIds` に差し替える。要素は元の場所から移し、ID はそのまま保つ。
 * 前の差し替えの中身のうち `nodeIds` に含めなかったものは消える。空の配列で slot を空にする。
 */
export function fillSlot(document: Document, instanceId: string, slotId: string, nodeIds: string[]): Result.Result<Document, Error> {
  const target = slotTarget(document, instanceId, slotId);
  if (Result.isFailure(target)) return target;
  if (!Array.isArray(nodeIds) || new Set(nodeIds).size !== nodeIds.length) return Result.fail(new Error("移す要素の ID を重複なく指定してください"));
  const nodes: DocumentNode[] = [];
  for (const id of nodeIds) {
    const node = findNode(document, id);
    if (!node) return Result.fail(new Error(`要素が見つかりません: ${id}`));
    const descendants = new Set(collectNodes([node]).map((item) => item.id));
    if (descendants.has(instanceId)) return Result.fail(new Error(`インスタンス自身やその親は slot に入れられません: ${id}`));
    if (nodeIds.some((other) => other !== id && descendants.has(other))) return Result.fail(new Error(`親と子を同時に指定できません: ${id}`));
    nodes.push(node);
  }
  // 要素を元の場所から取り除いてから、slot の中身を置き換える。
  const moving = new Set(nodeIds);
  const remove = (items: DocumentNode[]): DocumentNode[] => items.flatMap((node) => moving.has(node.id) ? [] : [mapChildGroups(node, remove)]);
  const removed = { ...document, children: remove(document.children) };
  return updateNode(removed, instanceId, (node) => node.type === "instance" ? { ...node, slots: { ...node.slots, [slotId]: nodes } } : node);
}

/** インスタンスの slot の差し替えを外し、定義の既定の中身に戻す。 */
export function resetSlot(document: Document, instanceId: string, slotId: string): Result.Result<Document, Error> {
  const target = slotTarget(document, instanceId, slotId);
  if (Result.isFailure(target)) return target;
  if (!target.value.slots || !(slotId in target.value.slots)) return Result.fail(new Error(`slot は差し替えられていません: ${slotId}`));
  return updateNode(document, instanceId, (node) => {
    if (node.type !== "instance" || !node.slots) return node;
    const { [slotId]: _removed, ...slots } = node.slots;
    const { slots: _all, ...rest } = node;
    return Object.keys(slots).length === 0 ? rest : { ...rest, slots };
  });
}
