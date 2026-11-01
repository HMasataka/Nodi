import type { AddNodeInput } from "@/document/commands/index.ts";
import type { Document, DocumentNode, Geometry } from "@/document/types";

export type CreateKind = "rectangle" | "ellipse" | "frame" | "text";
type NewElementKind = CreateKind | "image";

const ROOT_START = { x: 80, y: 80 };
const CASCADE_STEP = 28;
const OTHER_ELEMENTS_RESET_AFTER = 8;
// 大きいフレームは通常の要素より早く起点へ戻す。
const FRAMES_RESET_AFTER = 6;
const FRAME_CHILD_START = { x: 24, y: 50 };
const INITIAL_SIZE: Record<NewElementKind, Pick<Geometry, "width" | "height">> = {
  rectangle: { width: 184, height: 112 },
  ellipse: { width: 112, height: 112 },
  frame: { width: 360, height: 260 },
  text: { width: 220, height: 48 },
  image: { width: 240, height: 160 },
};

function rootPlacement(document: Document, resetAfter: number) {
  // 6件なら 0→1→…→5→0 の順に配置し、7件目で起点に戻る。
  const positionInCycle = document.children.length % resetAfter;
  const offset = positionInCycle * CASCADE_STEP;
  return { x: ROOT_START.x + offset, y: ROOT_START.y + offset };
}

function placement(kind: NewElementKind, document: Document, selected: DocumentNode | undefined): { x: number; y: number; parentId?: string } {
  if (kind === "frame") return rootPlacement(document, FRAMES_RESET_AFTER);
  if (selected?.type === "frame") return { parentId: selected.id, ...FRAME_CHILD_START };
  return rootPlacement(document, OTHER_ELEMENTS_RESET_AFTER);
}

export function creationInput(kind: CreateKind, document: Document, selected?: DocumentNode): AddNodeInput {
  const geometry = { ...placement(kind, document, selected), ...INITIAL_SIZE[kind] };
  return kind === "text" ? { type: kind, content: "テキスト", ...geometry } : { type: kind, ...geometry };
}

export function imageCreationInput(document: Document, selected: DocumentNode | undefined, filename: string, source: string): AddNodeInput {
  return {
    type: "image", source, name: filename.replace(/\.[^.]+$/, "") || "画像",
    ...placement("image", document, selected), ...INITIAL_SIZE.image,
  };
}
