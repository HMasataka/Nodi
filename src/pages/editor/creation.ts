import type { AddNodeInput } from "@/document/commands/index.ts";
import type { Document, DocumentNode, Geometry } from "@/document/types";

export type CreateKind = "rectangle" | "ellipse" | "frame" | "text";
type NewElementKind = CreateKind | "image";

const ROOT_START = { x: 80, y: 80 };
const CASCADE_STEP = 28;
const DEFAULT_CASCADE_SLOTS = 8;
// 大きいフレームは原点付近に早めに戻し、通常の要素とは異なる既存の配置を維持する。
const FRAME_CASCADE_SLOTS = 6;
const FRAME_CHILD_START = { x: 24, y: 50 };
const INITIAL_SIZE: Record<NewElementKind, Pick<Geometry, "width" | "height">> = {
  rectangle: { width: 184, height: 112 },
  ellipse: { width: 112, height: 112 },
  frame: { width: 360, height: 260 },
  text: { width: 220, height: 48 },
  image: { width: 240, height: 160 },
};

function placement(kind: NewElementKind, document: Document, selected: DocumentNode | undefined) {
  const parentId = kind !== "frame" && selected?.type === "frame" ? selected.id : undefined;
  if (parentId) return { parentId, ...FRAME_CHILD_START };

  // トップレベルの全要素数で配置をずらし、一定数ごとに起点へ戻す。
  const slots = kind === "frame" ? FRAME_CASCADE_SLOTS : DEFAULT_CASCADE_SLOTS;
  const offset = (document.children.length % slots) * CASCADE_STEP;
  const position = { x: ROOT_START.x + offset, y: ROOT_START.y + offset };
  return kind === "frame" ? position : { parentId: undefined, ...position };
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
