import { Result } from "@praha/byethrow";

import { importSvgIcon } from "@/document/commands/svgImport.ts";
import { resolvedSpacing } from "@/document/spacing.ts";
import type { SvgIcon } from "@/document/svgPath.ts";
import { addNode, type AddNodeInput, addPaletteColor, addSpacingToken, createComponent, createInstance, type CreateInstanceInput, deleteNode, detachInstance, duplicateComponent, duplicateNode, duplicatePaletteColor, type FrameLayoutPatch, moveNode, removeComponent, removePaletteColor, removeSpacingToken, renameComponent, renameNode, renamePaletteColor, renameSpacingToken, renameTheme, resetInstanceOverride, setBlur, setBorder, setFrameLayout, setFrameStyle, setFrameTheme, setImageFilters, setImageStyle, setInstanceOverride, setMask, setNodeGeometry, setNodeStyle, setOpacity, setPaletteColor, setPaletteThemeColor, setPath, setRotation, setShadow, setSpacingToken, setTextContent, setTextMarks, setTextStyle, setThemes, setVisible } from "@/document/commands/index.ts";
import { type Border, type Document, type DocumentNode, type FrameStyle, type Geometry, type ImageFilters, type ImageStylePatch, type InstanceNode, type InstanceOverride, type PaletteColor, type PathFillRule, type RectangleStyle, type Shadow, type TextMark, type TextStyle, type VectorPathCommand } from "@/document/types.ts";
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
  visible: boolean;
  opacity: number;
  shadow: Shadow | null;
  blur: number;
  isMask?: boolean;
  content?: string;
  style?: Exclude<DocumentNode, InstanceNode>["style"];
  border?: Border;
  marks?: TextMark[];
  commands?: VectorPathCommand[];
  fillRule?: PathFillRule;
  clipContent?: boolean;
  layoutMode?: FrameLayoutPatch["layoutMode"];
  padding?: number;
  gap?: number;
  paddingRef?: string;
  gapRef?: string;
  theme?: string;
  source?: string;
  componentRef?: string;
  overrides?: Record<string, InstanceOverride>;
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

function paletteSnapshot(document: Document): PaletteColor[] {
  return (document.palette ?? []).map((color) => ({ ...color }));
}

export function listElements(document: Document, includeImageSource = false): ElementReference[] {
  const elements: ElementReference[] = [];
  function visit(nodes: DocumentNode[], names: string[], parentId: string | null) {
    for (const node of nodes) {
      const path = [...names, node.name];
      elements.push({
        id: node.id, name: node.name, path: path.join(" › "), parentId, type: node.type,
        x: node.x, y: node.y, width: node.width, height: node.height, rotation: node.rotation, visible: node.visible, opacity: node.opacity,
        shadow: node.shadow ? { ...node.shadow } : null,
        blur: node.blur,
        ...(node.type === "rectangle" || node.type === "ellipse" ? { isMask: node.isMask } : {}),
        ...(node.type === "instance" ? {} : { style: structuredClone(node.style) }),
        ...(node.type === "rectangle" || node.type === "frame" ? { border: structuredClone(node.style.border) } : {}),
        ...(node.type === "text" ? { content: node.content,
          ...(node.marks ? { marks: node.marks.map((mark) => ({ ...mark })) } : {}) } : {}),
        ...(node.type === "path" ? { commands: structuredClone(node.commands), fillRule: node.fillRule } : {}),
        ...(node.type === "frame" ? { clipContent: node.clipContent, layoutMode: node.layoutMode,
          padding: resolvedSpacing(document, node, "padding"), gap: resolvedSpacing(document, node, "gap"),
          ...(node.paddingRef ? { paddingRef: node.paddingRef } : {}), ...(node.gapRef ? { gapRef: node.gapRef } : {}),
          ...(node.theme === undefined ? {} : { theme: node.theme }) } : {}),
        ...(node.type === "image" && includeImageSource ? { source: node.source } : {}),
        ...(node.type === "instance" ? { componentRef: node.componentRef, overrides: structuredClone(node.overrides) } : {}),
      });
      if (node.type === "frame") visit(node.children, path, node.id);
    }
  }
  visit(document.children, [], null);
  return elements;
}

export function createAgentApi(port: EditorPort) {
  function getElement(id: string): Result.Result<ElementReference & { palette: PaletteColor[] }, Error> {
    const element = listElements(port.getDocument(), true).find((item) => item.id === id);
    return element ? Result.succeed({ ...element, palette: paletteSnapshot(port.getDocument()) }) : Result.fail(new Error(`要素が見つかりません: ${id}`));
  }

  function applyToElement(id: string, result: Result.Result<Document, Error>): Result.Result<ElementReference, Error> {
    if (Result.isFailure(result)) return result;
    const editable = port.canEdit?.();
    if (editable && Result.isFailure(editable)) return editable;
    if (result.value !== port.getDocument()) port.apply(result.value);
    return getElement(id);
  }

  function applyThemes(result: Result.Result<Document, Error>): Result.Result<{ themes: string[]; palette: PaletteColor[] }, Error> {
    if (Result.isFailure(result)) return result;
    const editable = port.canEdit?.();
    if (editable && Result.isFailure(editable)) return editable;
    if (result.value !== port.getDocument()) port.apply(result.value);
    return Result.succeed({ themes: [...(result.value.themes ?? [])], palette: paletteSnapshot(result.value) });
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
      return Result.succeed({ document: structuredClone(document), palette: paletteSnapshot(document), themes: [...(document.themes ?? [])], selected, elements });
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
    importSvg(input: { icon: SvgIcon; name: string; x: number; y: number; parentId?: string }) {
      return applyNewNode(importSvgIcon(port.getDocument(), input));
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
    setVisible(id: string, visible: boolean) {
      return applyToElement(id, setVisible(port.getDocument(), id, visible));
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
    setFrameLayout(id: string, patch: FrameLayoutPatch) {
      return applyToElement(id, setFrameLayout(port.getDocument(), id, patch));
    },
    addSpacingToken(name: string, value: number) {
      const result = addSpacingToken(port.getDocument(), name, value);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      port.apply(result.value.document);
      return Result.succeed(result.value.token);
    },
    changeSpacingToken(id: string, patch: { name?: string; value?: number; remove?: boolean }) {
      const original = port.getDocument().spacing.find((token) => token.id === id);
      if (!original) return Result.fail(new Error(`余白値が見つかりません: ${id}`));
      const result = patch.remove ? removeSpacingToken(port.getDocument(), id)
        : patch.name !== undefined ? renameSpacingToken(port.getDocument(), id, patch.name)
          : setSpacingToken(port.getDocument(), id, patch.value!);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      if (result.value !== port.getDocument()) port.apply(result.value);
      return Result.succeed(patch.remove ? { ...original, deleted: true } : result.value.spacing.find((token) => token.id === id)!);
    },
    listThemes() {
      return Result.succeed({ themes: [...(port.getDocument().themes ?? [])] });
    },
    setThemes(themes: string[]) {
      return applyThemes(setThemes(port.getDocument(), themes));
    },
    renameTheme(from: string, to: string) {
      return applyThemes(renameTheme(port.getDocument(), from, to));
    },
    setPaletteThemeColor(id: string, theme: string, color: string | null) {
      const result = setPaletteThemeColor(port.getDocument(), id, theme, color);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      if (result.value !== port.getDocument()) port.apply(result.value);
      return Result.succeed(result.value.palette.find((item) => item.id === id)!);
    },
    setFrameTheme(id: string, theme: string | null) {
      return applyToElement(id, setFrameTheme(port.getDocument(), id, theme));
    },
    listPalette() {
      return Result.succeed(paletteSnapshot(port.getDocument()));
    },
    addPaletteColor(input: { name: string; color: string }) {
      const result = addPaletteColor(port.getDocument(), input);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      port.apply(result.value.document);
      return Result.succeed(result.value.color);
    },
    changePaletteColor(id: string, patch: { name?: string; color?: string; remove?: boolean; duplicate?: boolean }) {
      const original = port.getDocument().palette.find((color) => color.id === id);
      if (!original) return Result.fail(new Error(`パレットの色が見つかりません: ${id}`));
      if (patch.duplicate) {
        const result = duplicatePaletteColor(port.getDocument(), id);
        if (Result.isFailure(result)) return result;
        const editable = port.canEdit?.();
        if (editable && Result.isFailure(editable)) return editable;
        port.apply(result.value.document);
        return Result.succeed(result.value.color);
      }
      const result = patch.remove ? removePaletteColor(port.getDocument(), id)
        : patch.name !== undefined ? renamePaletteColor(port.getDocument(), id, patch.name)
          : setPaletteColor(port.getDocument(), id, patch.color!);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      if (result.value !== port.getDocument()) port.apply(result.value);
      return Result.succeed(patch.remove ? { ...original, deleted: true } : result.value.palette.find((color) => color.id === id)!);
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
    listComponents() {
      return Result.succeed({ components: port.getDocument().components.map((component) => ({ id: component.id, name: component.name, node: structuredClone(component.node) })) });
    },
    createComponent(sourceId: string, name: string) {
      const result = createComponent(port.getDocument(), { sourceId, name });
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      port.apply(result.value.document);
      return Result.succeed({ id: result.value.component.id, name: result.value.component.name });
    },
    renameComponent(id: string, name: string) {
      const result = renameComponent(port.getDocument(), id, name);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      if (result.value !== port.getDocument()) port.apply(result.value);
      return Result.succeed({ id, name });
    },
    removeComponent(id: string) {
      const result = removeComponent(port.getDocument(), id);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      port.apply(result.value);
      return Result.succeed({ id, deleted: true });
    },
    duplicateComponent(id: string) {
      const result = duplicateComponent(port.getDocument(), id);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      port.apply(result.value.document);
      return Result.succeed({ id: result.value.component.id, name: result.value.component.name });
    },
    addInstance(input: CreateInstanceInput) {
      return applyNewNode(createInstance(port.getDocument(), input));
    },
    setInstanceOverride(id: string, childId: string, patch: InstanceOverride) {
      return applyToElement(id, setInstanceOverride(port.getDocument(), id, childId, patch));
    },
    resetInstanceOverride(id: string, childId: string) {
      return applyToElement(id, resetInstanceOverride(port.getDocument(), id, childId));
    },
    detachInstance(id: string) {
      const result = detachInstance(port.getDocument(), id);
      if (Result.isFailure(result)) return result;
      const editable = port.canEdit?.();
      if (editable && Result.isFailure(editable)) return editable;
      port.apply(result.value.document);
      return getElement(result.value.node.id);
    },
  };
}

export type AgentApi = ReturnType<typeof createAgentApi>;
