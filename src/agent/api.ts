import { Result } from "@praha/byethrow";

import { addNode, type AddNodeInput, deleteNode, duplicateNode, moveNode, renameNode, setBlur, setBorder, setFrameStyle, setImageFilters, setImageStyle, setMask, setNodeGeometry, setNodeStyle, setOpacity, setPath, setRotation, setShadow, setTextContent, setTextMarks, setTextStyle } from "@/document/commands/index.ts";
import { type Border, type Document, type DocumentNode, type FrameStyle, type Geometry, type ImageFilters, type ImageStylePatch, type PathFillRule, type RectangleStyle, type Shadow, type TextMark, type TextStyle, type VectorPathCommand } from "@/document/types.ts";
import { compareElementRevisions, measureElementAtRevision, measureRelativeAtRevision } from "@/document/measure.ts";
import { type DocumentHistory, listRevisions } from "@/document/history.ts";

export interface ElementReference {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  type: DocumentNode["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  shadow: Shadow | null;
  blur: number;
  isMask?: boolean;
  content?: string;
  style: DocumentNode["style"];
  border?: Border;
  marks?: TextMark[];
  commands?: VectorPathCommand[];
  fillRule?: PathFillRule;
  clipContent?: boolean;
  source?: string;
}

export interface EditorPort {
  getDocument(): Document;
  getHistory(): DocumentHistory;
  getSelectedId(): string | null;
  apply(document: Document): void;
  canEdit?(): Result.Result<void, Error>;
  focus?(id: string): Result.Result<FocusedViewport, Error>;
}

export interface FocusedViewport {
  absolute: { x: number; y: number; width: number; height: number };
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
  screen: { x: number; y: number; width: number; height: number };
}

const coordinates = { unit: "px", localOrigin: "parent", absoluteOrigin: "document" } as const;

export function listElements(document: Document, includeImageSource = false): ElementReference[] {
  const elements: ElementReference[] = [];
  function visit(nodes: DocumentNode[], names: string[], parentId: string | null) {
    for (const node of nodes) {
      const path = [...names, node.name];
      elements.push({
        id: node.id, name: node.name, path: path.join(" › "), parentId, type: node.type,
        x: node.x, y: node.y, width: node.width, height: node.height, rotation: node.rotation, opacity: node.opacity,
        shadow: node.shadow ? { ...node.shadow } : null,
        blur: node.blur,
        ...(node.type === "rectangle" || node.type === "ellipse" ? { isMask: node.isMask } : {}),
        style: structuredClone(node.style),
        ...(node.type === "rectangle" || node.type === "frame" ? { border: structuredClone(node.style.border) } : {}),
        ...(node.type === "text" ? { content: node.content,
          ...(node.marks ? { marks: node.marks.map((mark) => ({ ...mark })) } : {}) } : {}),
        ...(node.type === "path" ? { commands: structuredClone(node.commands), fillRule: node.fillRule } : {}),
        ...(node.type === "frame" ? { clipContent: node.clipContent } : {}),
        ...(node.type === "image" && includeImageSource ? { source: node.source } : {}),
      });
      if (node.type === "frame") visit(node.children, path, node.id);
    }
  }
  visit(document.children, [], null);
  return elements;
}

export function createAgentApi(port: EditorPort) {
  function getElement(id: string): Result.Result<ElementReference, Error> {
    const element = listElements(port.getDocument(), true).find((item) => item.id === id);
    return element ? Result.succeed(element) : Result.fail(new Error(`要素が見つかりません: ${id}`));
  }

  function applyToElement(id: string, result: Result.Result<Document, Error>): Result.Result<ElementReference, Error> {
    if (Result.isFailure(result)) return result;
    const editable = port.canEdit?.();
    if (editable && Result.isFailure(editable)) return editable;
    if (result.value !== port.getDocument()) port.apply(result.value);
    return getElement(id);
  }

  function applyNewNode(result: Result.Result<{ document: Document; node: DocumentNode }, Error>): Result.Result<ElementReference, Error> {
    if (Result.isFailure(result)) return result;
    const editable = port.canEdit?.();
    if (editable && Result.isFailure(editable)) return editable;
    port.apply(result.value.document);
    return getElement(result.value.node.id);
  }

  return {
    getState() {
      const document = port.getDocument();
      const elements = listElements(document);
      const selected = elements.find((item) => item.id === port.getSelectedId()) ?? null;
      return Result.succeed({ document: structuredClone(document), selected, elements });
    },
    getElement,
    select(id: string) {
      const element = getElement(id);
      if (Result.isFailure(element)) return element;
      if (!port.focus) return Result.fail(new Error("キャンバスを表示できません"));
      const focused = port.focus(id);
      return Result.isFailure(focused) ? focused : Result.succeed({ ...element.value, ...focused.value, unit: "px", absoluteOrigin: "document" as const });
    },
    listRevisions() {
      return Result.succeed({ revisions: listRevisions(port.getHistory()) });
    },
    getRevisionElement(revisionId: string, elementId: string) {
      const result = measureElementAtRevision(port.getHistory(), revisionId, elementId);
      return Result.isFailure(result) ? result : Result.succeed({ ...result.value, ...coordinates });
    },
    compareRevisions(fromRevisionId: string, toRevisionId: string, elementId: string) {
      const result = compareElementRevisions(port.getHistory(), fromRevisionId, toRevisionId, elementId);
      return Result.isFailure(result) ? result : Result.succeed({ ...result.value, ...coordinates });
    },
    measureElements(revisionId: string, firstId: string, secondId: string) {
      const result = measureRelativeAtRevision(port.getHistory(), revisionId, firstId, secondId);
      return Result.isFailure(result) ? result : Result.succeed({ ...result.value, ...coordinates });
    },
    add(input: AddNodeInput): Result.Result<ElementReference, Error> {
      return applyNewNode(addNode(port.getDocument(), input));
    },
    rename(id: string, name: string): Result.Result<ElementReference, Error> {
      return applyToElement(id, renameNode(port.getDocument(), id, name));
    },
    move(id: string, x: number, y: number): Result.Result<ElementReference, Error> {
      return applyToElement(id, moveNode(port.getDocument(), id, x, y));
    },
    setGeometry(id: string, geometry: Geometry) {
      return applyToElement(id, setNodeGeometry(port.getDocument(), id, geometry));
    },
    setRotation(id: string, rotation: number) {
      return applyToElement(id, setRotation(port.getDocument(), id, rotation));
    },
    setOpacity(id: string, opacity: number) {
      return applyToElement(id, setOpacity(port.getDocument(), id, opacity));
    },
    setShadow(id: string, shadow: Shadow | null) {
      return applyToElement(id, setShadow(port.getDocument(), id, shadow));
    },
    setBlur(id: string, blur: number) {
      return applyToElement(id, setBlur(port.getDocument(), id, blur));
    },
    setMask(id: string, isMask: boolean) {
      return applyToElement(id, setMask(port.getDocument(), id, isMask));
    },
    setShapeStyle(id: string, style: Partial<RectangleStyle>) {
      return applyToElement(id, setNodeStyle(port.getDocument(), id, style));
    },
    setPath(id: string, path: { commands?: VectorPathCommand[]; fillRule?: PathFillRule }) {
      return applyToElement(id, setPath(port.getDocument(), id, path));
    },
    setFrameStyle(id: string, style: Partial<FrameStyle>) {
      return applyToElement(id, setFrameStyle(port.getDocument(), id, style));
    },
    setBorder(id: string, border: Border) {
      return applyToElement(id, setBorder(port.getDocument(), id, border));
    },
    setImageStyle(id: string, style: ImageStylePatch) {
      return applyToElement(id, setImageStyle(port.getDocument(), id, style));
    },
    setImageFilters(id: string, filters: Partial<ImageFilters>) {
      return applyToElement(id, setImageFilters(port.getDocument(), id, filters));
    },
    setTextStyle(id: string, style: Partial<TextStyle>) {
      return applyToElement(id, setTextStyle(port.getDocument(), id, style));
    },
    setTextMarks(id: string, marks: TextMark[]) {
      return applyToElement(id, setTextMarks(port.getDocument(), id, marks));
    },
    delete(id: string) {
      const element = getElement(id);
      if (Result.isFailure(element)) return element;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      const removed = deleteNode(port.getDocument(), id);
      if (Result.isFailure(removed)) return removed;
      port.apply(removed.value);
      return Result.succeed({ ...element.value, deleted: true });
    },
    duplicate(id: string) {
      return applyNewNode(duplicateNode(port.getDocument(), id));
    },
    setTextContent(id: string, content: string): Result.Result<ElementReference, Error> {
      return applyToElement(id, setTextContent(port.getDocument(), id, content));
    },
  };
}

export type AgentApi = ReturnType<typeof createAgentApi>;
