import { Result } from "@praha/byethrow";

import { validateName } from "@/document/commands/validation.ts";
import { collectNodes, findNode } from "@/document/commands/tree.ts";
import { type ComponentDefinition, type Document, type DocumentNode } from "@/document/types.ts";

function uniqueId(prefix: string, used: Set<string>): string {
  let id: string;
  do {
    id = `${prefix}${crypto.randomUUID()}`;
  } while (used.has(id));
  used.add(id);
  return id;
}

function copyTree(node: DocumentNode, used: Set<string>): DocumentNode {
  const id = uniqueId("nd_", used);
  if (node.type === "frame") {
    return { ...node, id, children: node.children.map((child) => copyTree(child, used)) };
  }
  return { ...node, id };
}

export function createComponent(
  document: Document,
  input: { sourceId: string; name: string },
): Result.Result<{ document: Document; component: ComponentDefinition }, Error> {
  const name = validateName(input.name);
  if (Result.isFailure(name)) return name;
  const source = findNode(document, input.sourceId);
  if (!source) return Result.fail(new Error(`要素が見つかりません: ${input.sourceId}`));
  if (source.type !== "frame") return Result.fail(new Error("コンポーネントはフレームと子要素から作成してください"));
  const used = new Set(collectNodes(document.children).map((node) => node.id));
  for (const component of document.components) used.add(component.id);
  const component: ComponentDefinition = { id: uniqueId("cp_", used), name: input.name, node: copyTree(source, used) };
  return Result.succeed({ document: { ...document, components: [...document.components, component] }, component });
}

export function renameComponent(document: Document, id: string, name: string): Result.Result<Document, Error> {
  const validated = validateName(name);
  if (Result.isFailure(validated)) return validated;
  const target = document.components.find((component) => component.id === id);
  if (!target) return Result.fail(new Error(`コンポーネントが見つかりません: ${id}`));
  if (target.name === name) return Result.succeed(document);
  return Result.succeed({ ...document, components: document.components.map((component) => component.id === id ? { ...component, name } : component) });
}

export function removeComponent(document: Document, id: string): Result.Result<Document, Error> {
  if (!document.components.some((component) => component.id === id)) return Result.fail(new Error(`コンポーネントが見つかりません: ${id}`));
  return Result.succeed({ ...document, components: document.components.filter((component) => component.id !== id) });
}

export function duplicateComponent(document: Document, id: string): Result.Result<{ document: Document; component: ComponentDefinition }, Error> {
  const source = document.components.find((component) => component.id === id);
  if (!source) return Result.fail(new Error(`コンポーネントが見つかりません: ${id}`));
  const names = new Set(document.components.map((component) => component.name));
  let name = `${source.name} のコピー`;
  let number = 2;
  while (names.has(name)) name = `${source.name} のコピー ${number++}`;
  const used = new Set(document.components.map((component) => component.id));
  const component: ComponentDefinition = { id: uniqueId("cp_", used), name, node: copyTree(source.node, used) };
  return Result.succeed({ document: { ...document, components: [...document.components, component] }, component });
}
