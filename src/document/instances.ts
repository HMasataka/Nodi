import { scopedOverrides } from "@/document/overridePath.ts";
import type { Document, DocumentNode, InstanceNode, InstanceOverride } from "@/document/types.ts";

const COMMON_KEYS = ["width", "height", "visible", "opacity"] as const;
const SHAPE_KEYS = ["fill", "stroke"] as const;
const TEXT_STYLE_KEYS = ["fontSize", "fontWeight", "fontFamily", "lineHeight", "letterSpacing", "textAlign"] as const;
const FRAME_LAYOUT_KEYS = ["layoutMode", "padding", "gap", "alignItems", "justifyContent"] as const;

/** 要素の種類ごとに、オーバーライドできる属性。入れ子のインスタンスそのものはサイズ・表示・不透明度だけ。 */
export const OVERRIDE_KEYS: Record<DocumentNode["type"], readonly (keyof InstanceOverride)[]> = {
  text: [...COMMON_KEYS, "content", "color", ...TEXT_STYLE_KEYS],
  image: [...COMMON_KEYS, "source", "cornerRadii"],
  rectangle: [...COMMON_KEYS, ...SHAPE_KEYS, "cornerRadii"],
  ellipse: [...COMMON_KEYS, ...SHAPE_KEYS],
  path: [...COMMON_KEYS, ...SHAPE_KEYS],
  frame: [...COMMON_KEYS, ...SHAPE_KEYS, "cornerRadii", ...FRAME_LAYOUT_KEYS],
  instance: [...COMMON_KEYS],
};

/** 種類に合わない属性を含むなら、その属性名を返す（黙って無視しない）。 */
export function unsupportedOverrideKeys(type: DocumentNode["type"], override: object): string[] {
  const allowed = new Set<string>(OVERRIDE_KEYS[type]);
  return Object.keys(override).filter((key) => !allowed.has(key));
}

/**
 * インスタンスのオーバーライドを定義ツリーのノードへ適用する。適用できる属性は `OVERRIDE_KEYS` のとおり。
 * フレームの余白・間隔を直接指定すると、共通余白の参照は外す。
 */
export function applyOverride(node: DocumentNode, override: InstanceOverride | undefined): DocumentNode {
  if (!override) return node;
  let result: DocumentNode;
  switch (node.type) {
    case "text": {
      const style = { ...node.style,
        ...(override.color !== undefined ? { color: override.color } : {}),
        ...pick(override, TEXT_STYLE_KEYS) };
      result = { ...node, ...(override.content !== undefined ? { content: override.content } : {}), style };
      break;
    }
    case "image": {
      result = { ...node, ...(override.source !== undefined ? { source: override.source } : {}),
        style: { ...node.style, ...(override.cornerRadii !== undefined ? { cornerRadii: override.cornerRadii } : {}) } };
      break;
    }
    case "rectangle": {
      result = { ...node, style: { ...node.style, ...pick(override, SHAPE_KEYS),
        ...(override.cornerRadii !== undefined ? { cornerRadii: override.cornerRadii } : {}) } };
      break;
    }
    case "frame": {
      const { paddingRef, gapRef, ...rest } = node;
      result = { ...rest,
        ...(override.padding === undefined && paddingRef !== undefined ? { paddingRef } : {}),
        ...(override.gap === undefined && gapRef !== undefined ? { gapRef } : {}),
        ...pick(override, FRAME_LAYOUT_KEYS),
        style: { ...node.style, ...pick(override, SHAPE_KEYS),
          ...(override.cornerRadii !== undefined ? { cornerRadii: override.cornerRadii } : {}) } };
      break;
    }
    case "ellipse":
    case "path": {
      result = { ...node, style: { ...node.style, ...pick(override, SHAPE_KEYS) } };
      break;
    }
    case "instance":
      result = node;
      break;
  }
  return { ...result, ...pick(override, COMMON_KEYS) };
}

function pick<K extends keyof InstanceOverride>(override: InstanceOverride, keys: readonly K[]): Partial<Pick<InstanceOverride, K>> {
  return Object.fromEntries(keys.flatMap((key) => override[key] === undefined ? [] : [[key, override[key]]])) as Partial<Pick<InstanceOverride, K>>;
}

type Slots = Record<string, DocumentNode[]>;

// 外側の上書き・slot のうち `instanceId/…` を内側のインスタンスから見たキーに直し、内側の指定に重ねる（同じ子・slot は外側を優先する）。
function mergeInner(base: InstanceNode, overrides?: Record<string, InstanceOverride>, slots?: Slots): InstanceNode {
  const outerOverrides = overrides ? scopedOverrides(overrides, base.id) : {};
  const outerSlots = slots ? scopedOverrides(slots, base.id) : {};
  if (Object.keys(outerOverrides).length === 0 && Object.keys(outerSlots).length === 0) return base;
  const merged = { ...base.overrides };
  for (const [key, value] of Object.entries(outerOverrides)) merged[key] = { ...merged[key], ...value };
  return { ...base, overrides: merged, slots: { ...base.slots, ...outerSlots } };
}

function resolveNode(node: DocumentNode, document: Document, stack: Set<string>, overrides?: Record<string, InstanceOverride>, slots?: Slots): DocumentNode {
  const base = overrides ? applyOverride(node, overrides[node.id]) : node;
  if (base.type === "instance") return resolveInstance(mergeInner(base, overrides, slots), document, stack);
  if (base.type !== "frame") return base;
  // slot のフレームは、インスタンスが中身を差し替えていればその中身を子にする。中身は定義の外のものなので、定義の上書きは掛けない。
  const replaced = base.slot ? slots?.[base.id] : undefined;
  const children = replaced
    ? replaced.map((child) => resolveNode(child, document, new Set()))
    : base.children.map((child) => resolveNode(child, document, stack, overrides, slots));
  return { ...base, children };
}

function resolveInstance(instance: InstanceNode, document: Document, stack: Set<string>): DocumentNode {
  const definition = document.components.find((component) => component.id === instance.componentRef);
  // 不正な参照・循環参照は読み込み時に拒否される。ここでは未解決のまま返して再帰を止める。
  if (!definition || stack.has(instance.componentRef)) return instance;
  const nextStack = new Set(stack);
  nextStack.add(instance.componentRef);
  const resolved = resolveNode(definition.node, document, nextStack, instance.overrides, instance.slots);
  // 解決後もインスタンス自身の ID と名前を保持し、キャンバスでの選択・操作をインスタンスに紐付ける。表示もインスタンス自身の値に従う。
  return { ...resolved, id: instance.id, name: instance.name, x: instance.x, y: instance.y, width: instance.width, height: instance.height, visible: instance.visible };
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
