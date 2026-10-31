import { Result } from "@praha/byethrow";
import { addNode, moveNode, renameNode, setTextContent, type AddNodeInput } from "@/document/commands/index.ts";
import { listRevisions, type DocumentHistory } from "@/document/history.ts";
import { compareElementRevisions, measureElementAtRevision, measureRelativeAtRevision } from "@/document/measure.ts";
import type { Document, DocumentNode } from "@/document/types.ts";

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
  content?: string;
  fontSize?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  source?: string;
}

export interface EditorPort {
  getDocument(): Document;
  getHistory(): DocumentHistory;
  getSelectedId(): string | null;
  apply(document: Document): void;
}

const coordinates = { unit: "px", localOrigin: "parent", absoluteOrigin: "document" } as const;

export function listElements(document: Document, includeImageSource = false): ElementReference[] {
  const elements: ElementReference[] = [];
  function visit(nodes: DocumentNode[], names: string[], parentId: string | null) {
    for (const node of nodes) {
      const path = [...names, node.name];
      elements.push({
        id: node.id, name: node.name, path: path.join(" › "), parentId, type: node.type,
        x: node.x, y: node.y, width: node.width, height: node.height,
        ...(node.type === "text" ? { content: node.content, fontSize: node.fontSize, color: node.color, textAlign: node.textAlign } : {}),
        ...(node.type === "rectangle" || node.type === "ellipse" ? { fill: node.fill, stroke: node.stroke, strokeWidth: node.strokeWidth } : {}),
        ...(node.type === "rectangle" ? { cornerRadius: node.cornerRadius } : {}),
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

  return {
    getState() {
      const document = port.getDocument();
      const elements = listElements(document);
      const selected = elements.find((item) => item.id === port.getSelectedId()) ?? null;
      return Result.succeed({ document: structuredClone(document), selected, elements });
    },
    getElement,
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
      const result = addNode(port.getDocument(), input);
      if (Result.isFailure(result)) return result;
      port.apply(result.value.document);
      return getElement(result.value.node.id);
    },
    rename(id: string, name: string): Result.Result<ElementReference, Error> {
      const result = renameNode(port.getDocument(), id, name);
      if (Result.isFailure(result)) return result;
      port.apply(result.value);
      return getElement(id);
    },
    move(id: string, x: number, y: number): Result.Result<ElementReference, Error> {
      const result = moveNode(port.getDocument(), id, x, y);
      if (Result.isFailure(result)) return result;
      port.apply(result.value);
      return getElement(id);
    },
    setTextContent(id: string, content: string): Result.Result<ElementReference, Error> {
      const result = setTextContent(port.getDocument(), id, content);
      if (Result.isFailure(result)) return result;
      port.apply(result.value);
      return getElement(id);
    },
  };
}

export type AgentApi = ReturnType<typeof createAgentApi>;
