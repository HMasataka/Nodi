import { Result } from "@praha/byethrow";
import type { Document, DocumentNode, Geometry } from "./types.ts";

export function createDocument(): Document {
  return { version: 1, children: [] };
}

export function findNode(document: Document, id: string): DocumentNode | undefined {
  function search(nodes: DocumentNode[]): DocumentNode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.type === "frame") {
        const child = search(node.children);
        if (child) return child;
      }
    }
  }
  return search(document.children);
}

function collectNodes(nodes: DocumentNode[]): DocumentNode[] {
  return nodes.flatMap((node) => [node, ...(node.type === "frame" ? collectNodes(node.children) : [])]);
}

function validateName(name: string): Result.Result<string, Error> {
  if (!name.trim()) return Result.fail(new Error("名前は空にできません"));
  return Result.succeed(name);
}

function validateGeometry(geometry: Geometry): Result.Result<void, Error> {
  if (![geometry.x, geometry.y].every(Number.isFinite)) {
    return Result.fail(new Error("座標は有限の数値で指定してください"));
  }
  if (![geometry.width, geometry.height].every((value) => Number.isFinite(value) && value > 0)) {
    return Result.fail(new Error("幅と高さは正の有限の数値で指定してください"));
  }
  return Result.succeed();
}

function updateNode(
  document: Document,
  id: string,
  update: (node: DocumentNode) => DocumentNode,
): Result.Result<Document, Error> {
  let found = false;
  function updateChildren(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.map((node) => {
      if (node.id === id) {
        found = true;
        return update(node);
      }
      return node.type === "frame" ? { ...node, children: updateChildren(node.children) } : node;
    });
  }
  const children = updateChildren(document.children);
  if (!found) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  return Result.succeed({ ...document, children });
}

export interface AddNodeInput extends Geometry {
  type: DocumentNode["type"];
  parentId?: string;
  name?: string;
}

export function addNode(
  document: Document,
  input: AddNodeInput,
): Result.Result<{ document: Document; node: DocumentNode }, Error> {
  const geometryResult = validateGeometry(input);
  if (Result.isFailure(geometryResult)) return geometryResult;
  const existing = collectNodes(document.children);
  const parent = input.parentId === undefined ? undefined : findNode(document, input.parentId);
  if (input.parentId !== undefined && parent?.type !== "frame") {
    return Result.fail(new Error(`親フレームが見つかりません: ${input.parentId}`));
  }

  const baseName = input.type === "frame" ? "フレーム" : "矩形";
  const names = new Set(existing.map((node) => node.name));
  let number = 1;
  while (names.has(`${baseName} ${number}`)) number++;
  const name = input.name ?? `${baseName} ${number}`;
  const nameResult = validateName(name);
  if (Result.isFailure(nameResult)) return nameResult;

  const ids = new Set(existing.map((node) => node.id));
  let id: string;
  do {
    id = `nd_${crypto.randomUUID()}`;
  } while (ids.has(id));

  const geometry = { x: input.x, y: input.y, width: input.width, height: input.height };
  const node: DocumentNode = input.type === "frame"
    ? { id, name, type: "frame", ...geometry, children: [] }
    : { id, name, type: "rectangle", ...geometry };

  if (parent === undefined) {
    return Result.succeed({ document: { ...document, children: [...document.children, node] }, node });
  }
  const updated = updateNode(document, parent.id, (current) =>
    current.type === "frame" ? { ...current, children: [...current.children, node] } : current,
  );
  if (Result.isFailure(updated)) return updated;
  return Result.succeed({ document: updated.value, node });
}

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
