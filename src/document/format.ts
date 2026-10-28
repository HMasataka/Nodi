import { Result } from "@praha/byethrow";
import { z } from "zod";
import { DEFAULT_RECTANGLE_STYLE, type Document, type DocumentNode, type RectangleStyle } from "./types.ts";

type LegacyRectangle = Omit<Extract<DocumentNode, { type: "rectangle" }>, keyof RectangleStyle>;
type LegacyNode = LegacyRectangle | (Omit<Extract<DocumentNode, { type: "frame" }>, "children"> & { children: LegacyNode[] });

const id = z.string().refine((value) => value.trim().length > 0, "ID は空にできません");
const name = z.string().refine((value) => value.trim().length > 0, "名前は空にできません");
const coordinate = z.number().finite();
const dimension = z.number().finite().positive();
const geometry = { x: coordinate, y: coordinate, width: dimension, height: dimension };

const legacyNodeSchema: z.ZodType<LegacyNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ id, name, type: z.literal("rectangle"), ...geometry }),
    z.strictObject({
      id,
      name,
      type: z.literal("frame"),
      ...geometry,
      children: z.array(legacyNodeSchema),
    }),
  ]),
);

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const style = { fill: color, stroke: color, strokeWidth: z.number().finite().nonnegative(), cornerRadius: z.number().finite().nonnegative() };
const nodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ id, name, type: z.literal("rectangle"), ...geometry, ...style }),
    z.strictObject({ id, name, type: z.literal("frame"), ...geometry, children: z.array(nodeSchema) }),
  ]),
);

function checkUniqueIds(
  document: { children: DocumentNode[] | LegacyNode[] },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const seen = new Set<string>();
  function visit(nodes: DocumentNode[] | LegacyNode[], path: (string | number)[]) {
    nodes.forEach((node, index) => {
      const nodePath = [...path, index];
      if (seen.has(node.id)) context.addIssue({ code: "custom", path: [...nodePath, "id"], message: `ID が重複しています: ${node.id}` });
      seen.add(node.id);
      if (node.type === "frame") visit(node.children, [...nodePath, "children"]);
    });
  }
  visit(document.children, ["children"]);
}

const legacySchema = z.strictObject({ version: z.literal(1), children: z.array(legacyNodeSchema) }).superRefine(checkUniqueIds);
export const documentSchema = z.strictObject({ version: z.literal(2), children: z.array(nodeSchema) }).superRefine(checkUniqueIds);

function migrateNode(node: LegacyNode): DocumentNode {
  return node.type === "frame"
    ? { ...node, children: node.children.map(migrateNode) }
    : { ...node, ...DEFAULT_RECTANGLE_STYLE };
}

const parseJson = Result.fn({
  try: (json: string): unknown => JSON.parse(json),
  catch: (error) => new Error(`JSON を読み取れません: ${error instanceof Error ? error.message : String(error)}`),
});

export function parseDocument(json: string) {
  const parsed = parseJson(json);
  if (Result.isFailure(parsed)) return parsed;
  if (typeof parsed.value === "object" && parsed.value !== null && "version" in parsed.value && parsed.value.version === 1) {
    const legacy = Result.parse(legacySchema, parsed.value);
    if (Result.isFailure(legacy)) return legacy;
    return Result.succeed({ version: 2 as const, children: legacy.value.children.map(migrateNode) });
  }
  return Result.parse(documentSchema, parsed.value);
}

export function serializeDocument(document: Document) {
  const parsed = Result.parse(documentSchema, document);
  if (Result.isFailure(parsed)) return parsed;
  return Result.succeed(JSON.stringify(parsed.value, null, 2));
}
