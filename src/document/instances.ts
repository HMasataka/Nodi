import type { Document, DocumentNode, InstanceNode, InstanceOverride } from "@/document/types.ts";

/**
 * インスタンスのオーバーライドを定義ツリーのノードへ適用する。サイズは全ノード、
 * 文言・文字色はテキスト、画像は source、塗り・線は図形とフレームにのみ適用する。
 */
export function applyOverride(node: DocumentNode, override: InstanceOverride | undefined): DocumentNode {
  if (!override) return node;
  let result: DocumentNode;
  switch (node.type) {
    case "text": {
      let updated = node;
      if (override.content !== undefined) updated = { ...updated, content: override.content };
      if (override.color !== undefined) updated = { ...updated, style: { ...updated.style, color: override.color } };
      result = updated;
      break;
    }
    case "image": {
      result = override.source !== undefined ? { ...node, source: override.source } : node;
      break;
    }
    case "rectangle":
    case "frame": {
      const style = { ...node.style,
        ...(override.fill !== undefined ? { fill: override.fill } : {}),
        ...(override.stroke !== undefined ? { stroke: override.stroke } : {}) };
      result = { ...node, style };
      break;
    }
    case "ellipse":
    case "path": {
      const style = { ...node.style,
        ...(override.fill !== undefined ? { fill: override.fill } : {}),
        ...(override.stroke !== undefined ? { stroke: override.stroke } : {}) };
      result = { ...node, style };
      break;
    }
    case "instance":
      result = node;
      break;
  }
  if (override.width !== undefined || override.height !== undefined) {
    result = { ...result,
      ...(override.width !== undefined ? { width: override.width } : {}),
      ...(override.height !== undefined ? { height: override.height } : {}) };
  }
  return result;
}

function resolveNode(node: DocumentNode, document: Document, stack: Set<string>, overrides?: Record<string, InstanceOverride>): DocumentNode {
  const base = overrides ? applyOverride(node, overrides[node.id]) : node;
  if (base.type === "instance") return resolveInstance(base, document, stack);
  if (base.type === "frame") return { ...base, children: base.children.map((child) => resolveNode(child, document, stack, overrides)) };
  return base;
}

function resolveInstance(instance: InstanceNode, document: Document, stack: Set<string>): DocumentNode {
  const definition = document.components.find((component) => component.id === instance.componentRef);
  // 不正な参照・循環参照は読み込み時に拒否される。ここでは未解決のまま返して再帰を止める。
  if (!definition || stack.has(instance.componentRef)) return instance;
  const nextStack = new Set(stack);
  nextStack.add(instance.componentRef);
  const resolved = resolveNode(definition.node, document, nextStack, instance.overrides);
  // 解決後もインスタンス自身の ID と名前を保持し、キャンバスでの選択・操作をインスタンスに紐付ける。
  return { ...resolved, id: instance.id, name: instance.name, x: instance.x, y: instance.y, width: instance.width, height: instance.height };
}

/**
 * 単一のインスタンスを定義ツリーへ解決したノードを返す。切り離しなどに使う。
 */
export function resolveInstanceNode(instance: InstanceNode, document: Document): DocumentNode {
  return resolveInstance(instance, document, new Set());
}

/**
 * 文書内のインスタンスを定義ツリーへ解決した文書を返す。入力の文書は変更しない。
 * 解決は編集画面（SVG）と PNG 書き出し（Canvas）が共用する。
 */
export function resolveDocumentInstances(document: Document): Document {
  return { ...document, children: document.children.map((child) => resolveNode(child, document, new Set())) };
}
