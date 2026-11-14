import { Result } from "@praha/byethrow";

import { vectorPathIssue } from "@/document/vectorPath.ts";
import { collectNodes, findNode, updateNode } from "@/document/commands/tree.ts";
import { DEFAULT_FRAME_STYLE, DEFAULT_IMAGE_STYLE, DEFAULT_RECTANGLE_STYLE, DEFAULT_TEXT_STYLE, type Document, type DocumentNode, type Geometry, IMAGE_SOURCE_PATTERN, MAX_IMAGE_SOURCE_LENGTH, type PathFillRule, type VectorPathCommand } from "@/document/types.ts";
import { validateGeometry, validateName } from "@/document/commands/validation.ts";

export type AddNodeInput = Geometry & { parentId?: string; name?: string } & (
  | { type: "frame" | "rectangle" | "ellipse" }
  | { type: "text"; content?: string }
  | { type: "image"; source: string }
  | { type: "path"; commands: VectorPathCommand[]; fillRule?: PathFillRule }
);

export function createDocument(): Document {
  return { version: 1, children: [] };
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

  const baseName = input.type === "frame" ? "フレーム" : input.type === "text" ? "テキスト" : input.type === "ellipse" ? "楕円" : input.type === "image" ? "画像" : input.type === "path" ? "パス" : "矩形";
  const names = new Set(existing.map((node) => node.name));
  let number = 1;
  while (names.has(`${baseName} ${number}`)) number++;
  const name = input.name ?? `${baseName} ${number}`;
  const nameResult = validateName(name);
  if (Result.isFailure(nameResult)) return nameResult;
  if (input.type === "text" && input.content !== undefined && typeof input.content !== "string") {
    return Result.fail(new Error("本文は文字列で指定してください"));
  }
  if (input.type === "image" && (typeof input.source !== "string" || input.source.length > MAX_IMAGE_SOURCE_LENGTH || !IMAGE_SOURCE_PATTERN.test(input.source))) {
    return Result.fail(new Error("画像データが不正です"));
  }
  if (input.type === "path") {
    const issue = vectorPathIssue(input.commands, input.fillRule ?? "nonzero");
    if (issue) return Result.fail(new Error(issue));
  }

  const ids = new Set(existing.map((node) => node.id));
  let id: string;
  do {
    id = `nd_${crypto.randomUUID()}`;
  } while (ids.has(id));

  const geometry = { x: input.x, y: input.y, width: input.width, height: input.height, rotation: 0, opacity: 1, shadow: null, blur: 0,
    widthConstraint: { mode: "fixed" as const }, heightConstraint: { mode: "fixed" as const } };
  const node: DocumentNode = input.type === "frame"
    ? { id, name, type: "frame", ...geometry, style: structuredClone(DEFAULT_FRAME_STYLE), clipContent: true,
      layoutMode: "none" as const, padding: 0, gap: 0, alignItems: "start" as const, justifyContent: "start" as const, children: [] }
    : input.type === "text"
      ? { id, name, type: "text", ...geometry, content: input.content ?? "テキスト", style: { ...DEFAULT_TEXT_STYLE } }
      : input.type === "image"
        ? { id, name, type: "image", ...geometry, source: input.source, style: structuredClone(DEFAULT_IMAGE_STYLE) }
      : input.type === "path"
        ? { id, name, type: "path", ...geometry, commands: structuredClone(input.commands), fillRule: input.fillRule ?? "nonzero",
          style: { fill: null, stroke: { color: "#24383a", width: 2 } } }
      : input.type === "ellipse"
        ? { id, name, type: "ellipse", ...geometry, isMask: false, style: { fill: DEFAULT_RECTANGLE_STYLE.fill, stroke: structuredClone(DEFAULT_RECTANGLE_STYLE.stroke) } }
        : { id, name, type: "rectangle", ...geometry, isMask: false, style: structuredClone(DEFAULT_RECTANGLE_STYLE) };

  if (parent === undefined) {
    return Result.succeed({ document: { ...document, children: [...document.children, node] }, node });
  }
  const updated = updateNode(document, parent.id, (current) =>
    current.type === "frame" ? { ...current, children: [...current.children, node] } : current,
  );
  if (Result.isFailure(updated)) return updated;
  return Result.succeed({ document: updated.value, node });
}
