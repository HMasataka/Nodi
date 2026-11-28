import { Result } from "@praha/byethrow";

import { mapChildGroups } from "@/document/childGroups.ts";
import { validateName } from "@/document/commands/validation.ts";
import type { Document, DocumentNode, SpacingToken } from "@/document/types.ts";

function validValue(value: number) { return typeof value === "number" && Number.isFinite(value) && value >= 0; }

export function addSpacingToken(document: Document, name: string, value: number): Result.Result<{ document: Document; token: SpacingToken }, Error> {
  const validated = validateName(name);
  if (Result.isFailure(validated)) return validated;
  if (!validValue(value)) return Result.fail(new Error("余白値は0以上の有限なpx値で指定してください"));
  const ids = new Set(document.spacing.map((token) => token.id));
  let id = `sp_${crypto.randomUUID()}`;
  while (ids.has(id)) id = `sp_${crypto.randomUUID()}`;
  const token = { id, name, value };
  return Result.succeed({ document: { ...document, spacing: [...document.spacing, token] }, token });
}

export function renameSpacingToken(document: Document, id: string, name: string): Result.Result<Document, Error> {
  const validated = validateName(name);
  if (Result.isFailure(validated)) return validated;
  const token = document.spacing.find((item) => item.id === id);
  if (!token) return Result.fail(new Error(`余白値が見つかりません: ${id}`));
  return Result.succeed(token.name === name ? document : { ...document, spacing: document.spacing.map((item) => item.id === id ? { ...item, name } : item) });
}

export function setSpacingToken(document: Document, id: string, value: number): Result.Result<Document, Error> {
  if (!validValue(value)) return Result.fail(new Error("余白値は0以上の有限なpx値で指定してください"));
  const token = document.spacing.find((item) => item.id === id);
  if (!token) return Result.fail(new Error(`余白値が見つかりません: ${id}`));
  return Result.succeed(token.value === value ? document : { ...document, spacing: document.spacing.map((item) => item.id === id ? { ...item, value } : item) });
}

export function removeSpacingToken(document: Document, id: string): Result.Result<Document, Error> {
  const token = document.spacing.find((item) => item.id === id);
  if (!token) return Result.fail(new Error(`余白値が見つかりません: ${id}`));
  const value = token.value;
  function detach(node: DocumentNode): DocumentNode {
    if (node.type !== "frame") return mapChildGroups(node, (nodes) => nodes.map(detach));
    const { paddingRef, gapRef, ...rest } = node;
    return { ...rest, padding: paddingRef === id ? value : node.padding, gap: gapRef === id ? value : node.gap,
      ...(paddingRef && paddingRef !== id ? { paddingRef } : {}), ...(gapRef && gapRef !== id ? { gapRef } : {}),
      children: node.children.map(detach) };
  }
  return Result.succeed({ ...document, spacing: document.spacing.filter((item) => item.id !== id),
    children: document.children.map(detach), components: document.components.map((component) => ({ ...component, node: detach(component.node) })) });
}
