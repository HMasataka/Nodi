import { Result } from "@praha/byethrow";
import { updateNode } from "@/document/commands/tree.ts";
import { validateGeometry, validateName } from "@/document/commands/validation.ts";
import type { Document, Geometry } from "@/document/types.ts";

export function renameNode(document: Document, id: string, name: string): Result.Result<Document, Error> {
  const validated = validateName(name);
  if (Result.isFailure(validated)) return validated;
  return updateNode(document, id, (node) => ({ ...node, name }));
}

export function moveNode(document: Document, id: string, x: number, y: number): Result.Result<Document, Error> {
  if (![x, y].every(Number.isFinite)) {
    return Result.fail(new Error("座標は有限の数値で指定してください"));
  }
  return updateNode(document, id, (node) => ({ ...node, x, y }));
}

export function setNodeGeometry(
  document: Document,
  id: string,
  geometry: Geometry,
): Result.Result<Document, Error> {
  const validated = validateGeometry(geometry);
  if (Result.isFailure(validated)) return validated;
  return updateNode(document, id, (node) => ({ ...node, ...geometry }));
}
