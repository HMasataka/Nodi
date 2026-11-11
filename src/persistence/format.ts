import { Result } from "@praha/byethrow";
import { z } from "zod";

import { textMarkIssue } from "@/document/textMarks.ts";
import { DEFAULT_TEXT_STYLE, type Document, type DocumentNode, HEX_COLOR_PATTERN, IMAGE_SOURCE_PATTERN, MAX_IMAGE_SOURCE_LENGTH, TEXT_FONT_FAMILIES, ZERO_CORNER_RADII } from "@/document/types.ts";

const id = z.string().refine((value) => value.trim().length > 0, "ID は空にできません");
const name = z.string().refine((value) => value.trim().length > 0, "名前は空にできません");
const coordinate = z.number().finite();
const dimension = z.number().finite().positive();
const geometry = { x: coordinate, y: coordinate, width: dimension, height: dimension };

const color = z.string().regex(HEX_COLOR_PATTERN);
const textMark = z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive(), color: color.optional(),
  fontWeight: z.number().int().min(100).max(900).refine((value) => value % 100 === 0).optional(),
  underline: z.literal(true).optional(), code: z.literal(true).optional() });
const radius = z.number().finite().nonnegative();
const cornerRadii = z.strictObject({ topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius });
const shapeStyle = z.strictObject({ fill: color.nullable(), stroke: z.strictObject({ color, width: radius }).nullable().optional() });
const borderEdge = z.strictObject({ color, width: radius });
const border = z.strictObject({ top: borderEdge.optional(), right: borderEdge.optional(), bottom: borderEdge.optional(), left: borderEdge.optional() });
const boxStyle = z.strictObject({ ...shapeStyle.shape, cornerRadii: cornerRadii.optional(), border: border.optional() }).refine(
  (style) => !style.border || Object.keys(style.border).length === 0 || !style.cornerRadii || Object.values(style.cornerRadii).every((value) => value === 0),
  { message: "辺線と角丸は併用できません", path: ["border"] },
);
const textStyle = z.strictObject({ fontSize: z.number().finite().positive(), color, textAlign: z.enum(["left", "center", "right"]), fontFamily: z.enum(TEXT_FONT_FAMILIES).optional(), fontWeight: z.number().int().min(100).max(900).refine((value) => value % 100 === 0).optional(), lineHeight: z.number().finite().positive().optional(), letterSpacing: z.number().finite().optional() });

export type WireNode =
  | (Omit<Extract<DocumentNode, { type: "rectangle" }>, "style"> & { style: z.infer<typeof boxStyle> })
  | (Omit<Extract<DocumentNode, { type: "ellipse" }>, "style"> & { style: z.infer<typeof shapeStyle> })
  | Extract<DocumentNode, { type: "image" }>
  | (Omit<Extract<DocumentNode, { type: "text" }>, "style"> & { style: z.infer<typeof textStyle> })
  | (Omit<Extract<DocumentNode, { type: "frame" }>, "style" | "children" | "clipContent"> & { style: z.infer<typeof boxStyle>; clipContent?: boolean; children: WireNode[] });
export interface WireDocument { version: 1; children: WireNode[] }

const nodeSchema: z.ZodType<WireNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ id, name, type: z.literal("rectangle"), ...geometry, style: boxStyle }),
    z.strictObject({ id, name, type: z.literal("ellipse"), ...geometry, style: shapeStyle }),
    z.strictObject({ id, name, type: z.literal("image"), ...geometry, style: z.strictObject({}), source: z.string().max(MAX_IMAGE_SOURCE_LENGTH).regex(IMAGE_SOURCE_PATTERN) }),
    z.strictObject({ id, name, type: z.literal("frame"), ...geometry, style: boxStyle, clipContent: z.boolean().optional(), children: z.array(nodeSchema) }),
    z.strictObject({ id, name, type: z.literal("text"), ...geometry, content: z.string(), style: textStyle, marks: z.array(textMark).optional() }),
  ]),
);

function checkUniqueIds(
  document: WireDocument,
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const seen = new Set<string>();
  function visit(nodes: WireNode[], path: (string | number)[]) {
    nodes.forEach((node, index) => {
      const nodePath = [...path, index];
      if (seen.has(node.id)) context.addIssue({ code: "custom", path: [...nodePath, "id"], message: `ID が重複しています: ${node.id}` });
      seen.add(node.id);
      if (node.type === "text" && node.marks) {
        const issue = textMarkIssue(node.content, node.marks);
        if (issue) context.addIssue({ code: "custom", path: [...nodePath, "marks"], message: issue });
      }
      if (node.type === "frame") visit(node.children, [...nodePath, "children"]);
    });
  }
  visit(document.children, ["children"]);
}

export const documentSchema = z.strictObject({ version: z.literal(1), children: z.array(nodeSchema) }).superRefine(checkUniqueIds);

function normalizeNode(node: WireNode): DocumentNode {
  switch (node.type) {
    case "image": return node;
    case "text": return { ...node, style: { ...node.style,
      fontFamily: node.style.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
      fontWeight: node.style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight,
      lineHeight: node.style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
      letterSpacing: node.style.letterSpacing ?? DEFAULT_TEXT_STYLE.letterSpacing,
    } };
    case "ellipse": return { ...node, style: { ...node.style, stroke: node.style.stroke ?? null } };
    case "rectangle": return { ...node, style: { ...node.style, stroke: node.style.stroke ?? null, cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII }, border: node.style.border ?? {} } };
    case "frame": return { ...node, style: { ...node.style, stroke: node.style.stroke ?? null, cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII }, border: node.style.border ?? {} }, clipContent: node.clipContent ?? true, children: node.children.map(normalizeNode) };
  }
}

function compactNode(node: DocumentNode): WireNode {
  if (node.type === "image") return node;
  if (node.type === "text") {
    const { fontFamily, fontWeight, lineHeight, letterSpacing, ...required } = node.style;
    return { ...node, style: { ...required,
      ...(fontFamily === DEFAULT_TEXT_STYLE.fontFamily ? {} : { fontFamily }),
      ...(fontWeight === DEFAULT_TEXT_STYLE.fontWeight ? {} : { fontWeight }),
      ...(lineHeight === DEFAULT_TEXT_STYLE.lineHeight ? {} : { lineHeight }),
      ...(letterSpacing === DEFAULT_TEXT_STYLE.letterSpacing ? {} : { letterSpacing }),
    } };
  }
  const style = { fill: node.style.fill, ...(node.style.stroke === null ? {} : { stroke: node.style.stroke }),
    ...(node.type !== "ellipse" && Object.values(node.style.cornerRadii).some((value) => value !== 0) ? { cornerRadii: node.style.cornerRadii } : {}),
    ...(node.type !== "ellipse" && Object.keys(node.style.border).length ? { border: node.style.border } : {}) };
  if (node.type === "frame") {
    const { clipContent, ...rest } = node;
    return { ...rest, style, ...(clipContent ? {} : { clipContent }), children: node.children.map(compactNode) };
  }
  return { ...node, style };
}

const parseJson = Result.fn({
  try: (json: string): unknown => JSON.parse(json),
  catch: (error) => new Error(`JSON を読み取れません: ${error instanceof Error ? error.message : String(error)}`),
});

export function parseDocument(json: string) {
  const parsed = parseJson(json);
  if (Result.isFailure(parsed)) return parsed;
  const validated = Result.parse(documentSchema, parsed.value);
  return Result.isFailure(validated) ? validated : Result.succeed({ version: 1 as const, children: validated.value.children.map(normalizeNode) });
}

export function serializeDocument(document: Document) {
  const parsed = Result.parse(documentSchema, document);
  if (Result.isFailure(parsed)) return parsed;
  return Result.succeed(JSON.stringify({ version: 1, children: parsed.value.children.map(normalizeNode).map(compactNode) }, null, 2));
}
