import { Result } from "@praha/byethrow";
import { z } from "zod";

import { normalizeRotation } from "@/document/transform.ts";
import { textMarkIssue } from "@/document/textMarks.ts";
import { DEFAULT_TEXT_STYLE, type Document, type DocumentNode, HEX_COLOR_PATTERN, IMAGE_SOURCE_PATTERN, MAX_IMAGE_SOURCE_LENGTH, TEXT_FONT_FAMILIES, ZERO_CORNER_RADII } from "@/document/types.ts";

const id = z.string().refine((value) => value.trim().length > 0, "ID は空にできません");
const name = z.string().refine((value) => value.trim().length > 0, "名前は空にできません");
const coordinate = z.number().finite();
const dimension = z.number().finite().positive();
const geometry = { x: coordinate, y: coordinate, width: dimension, height: dimension, rotation: coordinate.optional() };

const color = z.string().regex(HEX_COLOR_PATTERN);
const textMark = z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive(), color: color.optional(),
  fontWeight: z.number().int().min(100).max(900).refine((value) => value % 100 === 0).optional(),
  underline: z.literal(true).optional(), code: z.literal(true).optional() });
const radius = z.number().finite().nonnegative();
const cornerRadii = z.strictObject({ topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius });
const shapeStyle = z.strictObject({ fill: color.nullable(), stroke: z.strictObject({ color, width: radius }).nullable().optional() });
const boxStyle = z.strictObject({ ...shapeStyle.shape, cornerRadii: cornerRadii.optional() });
const textStyle = z.strictObject({ fontSize: z.number().finite().positive(), color, textAlign: z.enum(["left", "center", "right"]), fontFamily: z.enum(TEXT_FONT_FAMILIES).optional(), fontWeight: z.number().int().min(100).max(900).refine((value) => value % 100 === 0).optional(), lineHeight: z.number().finite().positive().optional(), letterSpacing: z.number().finite().optional() });

type OptionalRotation<T> = Omit<T, "rotation"> & { rotation?: number };
export type WireNode =
  | OptionalRotation<Omit<Extract<DocumentNode, { type: "rectangle" }>, "style"> & { style: z.infer<typeof boxStyle> }>
  | OptionalRotation<Omit<Extract<DocumentNode, { type: "ellipse" }>, "style"> & { style: z.infer<typeof shapeStyle> }>
  | OptionalRotation<Extract<DocumentNode, { type: "image" }>>
  | OptionalRotation<Omit<Extract<DocumentNode, { type: "text" }>, "style"> & { style: z.infer<typeof textStyle> }>
  | OptionalRotation<Omit<Extract<DocumentNode, { type: "frame" }>, "style" | "children" | "clipContent"> & { style: z.infer<typeof boxStyle>; clipContent?: boolean; children: WireNode[] }>;
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
  const rotation = normalizeRotation(node.rotation ?? 0);
  switch (node.type) {
    case "image": return { ...node, rotation };
    case "text": return { ...node, rotation, style: { ...node.style,
      fontFamily: node.style.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
      fontWeight: node.style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight,
      lineHeight: node.style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
      letterSpacing: node.style.letterSpacing ?? DEFAULT_TEXT_STYLE.letterSpacing,
    } };
    case "ellipse": return { ...node, rotation, style: { ...node.style, stroke: node.style.stroke ?? null } };
    case "rectangle": return { ...node, rotation, style: { ...node.style, stroke: node.style.stroke ?? null, cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII } } };
    case "frame": return { ...node, rotation, style: { ...node.style, stroke: node.style.stroke ?? null, cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII } }, clipContent: node.clipContent ?? true, children: node.children.map(normalizeNode) };
  }
}

function compactNode(node: DocumentNode): WireNode {
  const rotationField = node.rotation === 0 ? {} : { rotation: node.rotation };
  if (node.type === "image") {
    const { rotation: _, ...rest } = node;
    return { ...rest, ...rotationField };
  }
  if (node.type === "text") {
    const { rotation: _, ...rest } = node;
    const { fontFamily, fontWeight, lineHeight, letterSpacing, ...required } = node.style;
    return { ...rest, ...rotationField, style: { ...required,
      ...(fontFamily === DEFAULT_TEXT_STYLE.fontFamily ? {} : { fontFamily }),
      ...(fontWeight === DEFAULT_TEXT_STYLE.fontWeight ? {} : { fontWeight }),
      ...(lineHeight === DEFAULT_TEXT_STYLE.lineHeight ? {} : { lineHeight }),
      ...(letterSpacing === DEFAULT_TEXT_STYLE.letterSpacing ? {} : { letterSpacing }),
    } };
  }
  const style = { fill: node.style.fill, ...(node.style.stroke === null ? {} : { stroke: node.style.stroke }),
    ...(node.type !== "ellipse" && Object.values(node.style.cornerRadii).some((value) => value !== 0) ? { cornerRadii: node.style.cornerRadii } : {}) };
  if (node.type === "frame") {
    const { rotation: _rotation, clipContent: _clipContent, ...rest } = node;
    return { ...rest, ...rotationField, style, ...(node.clipContent ? {} : { clipContent: false }), children: node.children.map(compactNode) };
  }
  const { rotation: _, ...rest } = node;
  return { ...rest, ...rotationField, style };
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
