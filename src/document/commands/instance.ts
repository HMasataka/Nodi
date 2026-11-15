import { Result } from "@praha/byethrow";

import { validateName } from "@/document/commands/validation.ts";
import { collectNodes, findNode, updateNode } from "@/document/commands/tree.ts";
import type { Document, InstanceNode } from "@/document/types.ts";

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
    x: input.x, y: input.y, width, height, rotation: 0, opacity: 1, shadow: null, blur: 0,
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
