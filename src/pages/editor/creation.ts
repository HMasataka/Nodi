import type { AddNodeInput } from "@/document/commands/index.ts";
import type { Document, DocumentNode } from "@/document/types";

export type CreateKind = "rectangle" | "ellipse" | "frame" | "text";

function placement(document: Document, selected: DocumentNode | undefined) {
  const parentId = selected?.type === "frame" ? selected.id : undefined;
  const offset = (document.children.length % 8) * 28;
  return { parentId, x: parentId ? 24 : 80 + offset, y: parentId ? 50 : 80 + offset };
}

export function creationInput(kind: CreateKind, document: Document, selected?: DocumentNode): AddNodeInput {
  if (kind === "frame") {
    const offset = (document.children.length % 6) * 28;
    return { type: "frame", x: 80 + offset, y: 80 + offset, width: 360, height: 260 };
  }
  const position = placement(document, selected);
  if (kind === "rectangle") return { type: kind, ...position, width: 184, height: 112 };
  if (kind === "ellipse") return { type: kind, ...position, width: 112, height: 112 };
  return { type: "text", ...position, content: "テキスト", width: 220, height: 48 };
}

export function imageCreationInput(document: Document, selected: DocumentNode | undefined, filename: string, source: string): AddNodeInput {
  return {
    type: "image", source, name: filename.replace(/\.[^.]+$/, "") || "画像",
    ...placement(document, selected), width: 240, height: 160,
  };
}
