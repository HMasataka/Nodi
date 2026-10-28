import { z } from "zod";
import type { Document, DocumentNode } from "./types.ts";

const id = z.string().refine((value) => value.trim().length > 0, "ID は空にできません");
const name = z.string().refine((value) => value.trim().length > 0, "名前は空にできません");
const coordinate = z.number().finite();
const dimension = z.number().finite().positive();
const geometry = { x: coordinate, y: coordinate, width: dimension, height: dimension };

const nodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ id, name, type: z.literal("rectangle"), ...geometry }),
    z.strictObject({
      id,
      name,
      type: z.literal("frame"),
      ...geometry,
      children: z.array(nodeSchema),
    }),
  ]),
);

export const documentSchema = z
  .strictObject({ version: z.literal(1), children: z.array(nodeSchema) })
  .superRefine((document, context) => {
    const seen = new Set<string>();

    function visit(nodes: DocumentNode[], path: (string | number)[]) {
      nodes.forEach((node, index) => {
        const nodePath = [...path, index];
        if (seen.has(node.id)) {
          context.addIssue({
            code: "custom",
            path: [...nodePath, "id"],
            message: `ID が重複しています: ${node.id}`,
          });
        }
        seen.add(node.id);
        if (node.type === "frame") visit(node.children, [...nodePath, "children"]);
      });
    }

    visit(document.children, ["children"]);
  });

export function parseDocument(json: string): Document {
  const value: unknown = JSON.parse(json);
  return documentSchema.parse(value);
}

export function serializeDocument(document: Document): string {
  return JSON.stringify(documentSchema.parse(document), null, 2);
}
