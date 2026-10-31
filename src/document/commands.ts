import { Result } from "@praha/byethrow";
import { DEFAULT_RECTANGLE_STYLE, DEFAULT_TEXT_STYLE, type Document, type DocumentNode, type Geometry, type RectangleStyle, type TextStyle } from "./types.ts";

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
  content?: string;
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

  const baseName = input.type === "frame" ? "フレーム" : input.type === "text" ? "テキスト" : input.type === "ellipse" ? "楕円" : "矩形";
  const names = new Set(existing.map((node) => node.name));
  let number = 1;
  while (names.has(`${baseName} ${number}`)) number++;
  const name = input.name ?? `${baseName} ${number}`;
  const nameResult = validateName(name);
  if (Result.isFailure(nameResult)) return nameResult;
  if (input.type === "text" && input.content !== undefined && typeof input.content !== "string") {
    return Result.fail(new Error("本文は文字列で指定してください"));
  }

  const ids = new Set(existing.map((node) => node.id));
  let id: string;
  do {
    id = `nd_${crypto.randomUUID()}`;
  } while (ids.has(id));

  const geometry = { x: input.x, y: input.y, width: input.width, height: input.height };
  const node: DocumentNode = input.type === "frame"
    ? { id, name, type: "frame", ...geometry, children: [] }
    : input.type === "text"
      ? { id, name, type: "text", ...geometry, content: input.content ?? "テキスト", ...DEFAULT_TEXT_STYLE }
      : input.type === "ellipse"
        ? { id, name, type: "ellipse", ...geometry, fill: DEFAULT_RECTANGLE_STYLE.fill, stroke: DEFAULT_RECTANGLE_STYLE.stroke, strokeWidth: DEFAULT_RECTANGLE_STYLE.strokeWidth }
        : { id, name, type: "rectangle", ...geometry, ...DEFAULT_RECTANGLE_STYLE };

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

export function setNodeGeometry(
  document: Document,
  id: string,
  geometry: Geometry,
): Result.Result<Document, Error> {
  const validated = validateGeometry(geometry);
  if (Result.isFailure(validated)) return validated;
  return updateNode(document, id, (node) => ({ ...node, ...geometry }));
}

export function setNodeStyle(
  document: Document,
  id: string,
  patch: Partial<RectangleStyle>,
): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || (node.type !== "rectangle" && node.type !== "ellipse")) return Result.fail(new Error(`図形が見つかりません: ${id}`));
  if (node.type === "ellipse" && patch.cornerRadius !== undefined) return Result.fail(new Error("楕円に角丸は設定できません"));
  const style = { fill: patch.fill ?? node.fill, stroke: patch.stroke ?? node.stroke,
    strokeWidth: patch.strokeWidth ?? node.strokeWidth };
  if (!/^#[0-9a-fA-F]{6}$/.test(style.fill) || !/^#[0-9a-fA-F]{6}$/.test(style.stroke)) {
    return Result.fail(new Error("色は #RRGGBB 形式で指定してください"));
  }
  const cornerRadius = node.type === "rectangle" ? patch.cornerRadius ?? node.cornerRadius : undefined;
  if (![style.strokeWidth, cornerRadius ?? 0].every((value) => Number.isFinite(value) && value >= 0)) {
    return Result.fail(new Error("線幅と角丸は 0 以上の有限の数値で指定してください"));
  }
  return updateNode(document, id, (current) => ({ ...current, ...style, ...(cornerRadius === undefined ? {} : { cornerRadius }) }));
}

export function setTextContent(document: Document, id: string, content: string): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  if (typeof content !== "string") return Result.fail(new Error("本文は文字列で指定してください"));
  return updateNode(document, id, (current) => ({ ...current, content }));
}

export function setTextStyle(document: Document, id: string, patch: Partial<TextStyle>): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node || node.type !== "text") return Result.fail(new Error(`テキストが見つかりません: ${id}`));
  const style = { fontSize: patch.fontSize ?? node.fontSize, color: patch.color ?? node.color, textAlign: patch.textAlign ?? node.textAlign };
  if (!Number.isFinite(style.fontSize) || style.fontSize <= 0) return Result.fail(new Error("文字サイズは正の有限値で指定してください"));
  if (!/^#[0-9a-fA-F]{6}$/.test(style.color)) return Result.fail(new Error("文字色は #RRGGBB 形式で指定してください"));
  if (!["left", "center", "right"].includes(style.textAlign)) return Result.fail(new Error("文字揃えが不正です"));
  return updateNode(document, id, (current) => ({ ...current, ...style }));
}

export function deleteNode(document: Document, id: string): Result.Result<Document, Error> {
  let found = false;
  function remove(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.flatMap((node) => {
      if (node.id === id) {
        found = true;
        return [];
      }
      return [node.type === "frame" ? { ...node, children: remove(node.children) } : node];
    });
  }
  const children = remove(document.children);
  return found
    ? Result.succeed({ ...document, children })
    : Result.fail(new Error(`要素が見つかりません: ${id}`));
}

export function duplicateNode(
  document: Document,
  id: string,
): Result.Result<{ document: Document; node: DocumentNode }, Error> {
  const source = findNode(document, id);
  if (!source) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  const existing = collectNodes(document.children);
  const ids = new Set(existing.map((node) => node.id));
  const names = new Set(existing.map((node) => node.name));
  let name = `${source.name} のコピー`;
  let number = 2;
  while (names.has(name)) name = `${source.name} のコピー ${number++}`;

  function copy(node: DocumentNode, root = false): DocumentNode {
    let nextId: string;
    do {
      nextId = `nd_${crypto.randomUUID()}`;
    } while (ids.has(nextId));
    ids.add(nextId);
    const geometry = root ? { x: node.x + 24, y: node.y + 24 } : {};
    const copiedName = root ? name : node.name;
    return node.type === "frame"
      ? { ...node, ...geometry, id: nextId, name: copiedName, children: node.children.map((child) => copy(child)) }
      : { ...node, ...geometry, id: nextId, name: copiedName };
  }

  const duplicated = copy(source, true);
  function insert(nodes: DocumentNode[]): DocumentNode[] {
    return nodes.flatMap((node) => {
      if (node.id === id) return [node, duplicated];
      return [node.type === "frame" ? { ...node, children: insert(node.children) } : node];
    });
  }
  return Result.succeed({ document: { ...document, children: insert(document.children) }, node: duplicated });
}
