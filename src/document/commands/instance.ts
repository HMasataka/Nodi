import { Result } from "@praha/byethrow";

import { overrideTarget } from "@/document/overridePath.ts";
import { resolveInstanceNode } from "@/document/instances.ts";
import { validateName } from "@/document/commands/validation.ts";
import { collectNodes, findNode, updateNode } from "@/document/commands/tree.ts";
import type { Document, DocumentNode, InstanceNode, InstanceOverride } from "@/document/types.ts";

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

function validOverride(patch: InstanceOverride): boolean {
  if (Object.keys(patch).length === 0) return false;
  if (patch.width !== undefined && (!Number.isFinite(patch.width) || patch.width <= 0)) return false;
  if (patch.height !== undefined && (!Number.isFinite(patch.height) || patch.height <= 0)) return false;
  if (patch.visible !== undefined && typeof patch.visible !== "boolean") return false;
  return true;
}

export function setInstanceOverride(document: Document, instanceId: string, childId: string, patch: InstanceOverride): Result.Result<Document, Error> {
  if (!validOverride(patch)) return Result.fail(new Error("変更する属性を指定してください"));
  const instance = findNode(document, instanceId);
  if (!instance || instance.type !== "instance") return Result.fail(new Error(`インスタンスが見つかりません: ${instanceId}`));
  const definition = document.components.find((component) => component.id === instance.componentRef);
  if (!definition) return Result.fail(new Error(`コンポーネント定義が見つかりません: ${instance.componentRef}`));
  const definitionOf = (ref: string) => document.components.find((component) => component.id === ref)?.node;
  if (!overrideTarget(definition.node, childId, definitionOf)) return Result.fail(new Error(`オーバーライド対象が見つかりません: ${childId}`));
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
