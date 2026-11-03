import { Result } from "@praha/byethrow";
import { z } from "zod";
import { type Document, type DocumentNode, HEX_COLOR_PATTERN, IMAGE_SOURCE_PATTERN, MAX_IMAGE_SOURCE_LENGTH, TEXT_FONT_FAMILIES } from "@/document/types.ts";

const id = z.string().refine((value) => value.trim().length > 0, "ID は空にできません");
const name = z.string().refine((value) => value.trim().length > 0, "名前は空にできません");
const coordinate = z.number().finite();
const dimension = z.number().finite().positive();
const geometry = { x: coordinate, y: coordinate, width: dimension, height: dimension };

const color = z.string().regex(HEX_COLOR_PATTERN);
const style = { fill: color, stroke: color, strokeWidth: z.number().finite().nonnegative(), cornerRadius: z.number().finite().nonnegative() };
const nodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ id, name, type: z.literal("rectangle"), ...geometry, ...style }),
    z.strictObject({ id, name, type: z.literal("ellipse"), ...geometry, fill: color, stroke: color, strokeWidth: style.strokeWidth }),
    z.strictObject({ id, name, type: z.literal("image"), ...geometry, source: z.string().max(MAX_IMAGE_SOURCE_LENGTH).regex(IMAGE_SOURCE_PATTERN) }),
    z.strictObject({ id, name, type: z.literal("frame"), ...geometry, background: color, clipContent: z.boolean(), children: z.array(nodeSchema) }),
    z.strictObject({ id, name, type: z.literal("text"), ...geometry, content: z.string(), fontSize: z.number().finite().positive(), color, textAlign: z.enum(["left", "center", "right"]), fontFamily: z.enum(TEXT_FONT_FAMILIES).optional(), fontWeight: z.number().int().min(100).max(900).refine((value) => value % 100 === 0).optional() }),
  ]),
);

function checkUniqueIds(
  document: { children: DocumentNode[] },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const seen = new Set<string>();
  function visit(nodes: DocumentNode[], path: (string | number)[]) {
    nodes.forEach((node, index) => {
      const nodePath = [...path, index];
      if (seen.has(node.id)) context.addIssue({ code: "custom", path: [...nodePath, "id"], message: `ID が重複しています: ${node.id}` });
      seen.add(node.id);
      if (node.type === "frame") visit(node.children, [...nodePath, "children"]);
    });
  }
  visit(document.children, ["children"]);
}

export const documentSchema = z.strictObject({ version: z.literal(1), children: z.array(nodeSchema) }).superRefine(checkUniqueIds);

const parseJson = Result.fn({
  try: (json: string): unknown => JSON.parse(json),
  catch: (error) => new Error(`JSON を読み取れません: ${error instanceof Error ? error.message : String(error)}`),
});

export function parseDocument(json: string) {
  const parsed = parseJson(json);
  if (Result.isFailure(parsed)) return parsed;
  return Result.parse(documentSchema, parsed.value);
}

export function serializeDocument(document: Document) {
  const parsed = Result.parse(documentSchema, document);
  if (Result.isFailure(parsed)) return parsed;
  return Result.succeed(JSON.stringify(parsed.value, null, 2));
}
