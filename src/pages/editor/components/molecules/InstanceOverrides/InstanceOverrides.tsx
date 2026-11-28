import { useState } from "react";

import type { ComponentDefinition, DocumentNode, InstanceOverride, TextNode } from "@/document/types";
import { OVERRIDE_PATH_SEPARATOR, scopedOverrides } from "@/document/overridePath.ts";

import { blurOnEnter } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";

interface InstanceOverridesProps {
  node: DocumentNode;
  overrides: Record<string, InstanceOverride>;
  components?: readonly ComponentDefinition[];
  onSetOverride(childId: string, patch: InstanceOverride): void;
  onResetOverride(childId: string): void;
}

interface OverrideText { key: string; label: string; text: TextNode; base: string }

// 上書きできるテキストを集める。入れ子のインスタンスの中は `インスタンスID/子のID` のキーで指し、名前を「Legend › ラベル」のように出す。
// 入れ子のインスタンス自身の上書きは、その中のテキストの既定の文言として扱う。
export function overrideTexts(node: DocumentNode, components: readonly ComponentDefinition[], prefix = "", labels: string[] = [],
  inner: Record<string, InstanceOverride> = {}, stack: ReadonlySet<string> = new Set()): OverrideText[] {
  if (node.type === "text") return [{ key: prefix + node.id, label: [...labels, node.name].join(" › "), text: node, base: inner[node.id]?.content ?? node.content }];
  if (node.type === "frame") return node.children.flatMap((child) => overrideTexts(child, components, prefix, labels, inner, stack));
  if (node.type !== "instance" || stack.has(node.componentRef)) return [];
  const definition = components.find((component) => component.id === node.componentRef);
  if (!definition) return [];
  const merged: Record<string, InstanceOverride> = { ...node.overrides };
  for (const [key, value] of Object.entries(scopedOverrides(inner, node.id))) merged[key] = { ...merged[key], ...value };
  return overrideTexts(definition.node, components, prefix + node.id + OVERRIDE_PATH_SEPARATOR, [...labels, node.name], merged, new Set([...stack, node.componentRef]));
}

// 上書きの1行。名前・値・戻すを並べ、値は blur か Enter で確定する。上書きしていないときは戻せない。
function OverrideRow({ item, override, onSet, onReset }: { item: OverrideText; override?: InstanceOverride; onSet(content: string): void; onReset(): void }) {
  const value = override?.content ?? item.base;
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(value);
  }
  const overridden = override?.content !== undefined;
  return <div className={`override-row${overridden ? " is-overridden" : ""}`}>
    <label className="override-row-name" htmlFor={`override-${item.key}`}>{item.label}</label>
    <input id={`override-${item.key}`} className="override-row-value" type="text" value={draft} spellCheck={false}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => { if (draft !== value) onSet(draft); }} onKeyDown={blurOnEnter} />
    <IconButton icon="reset" label={`${item.label}を元に戻す`} disabled={!overridden} onClick={onReset} />
  </div>;
}

// インスタンスの上書きの行。参照元のテキスト（入れ子のインスタンスの中も含む）ごとに1行を並べる。
export function InstanceOverrides({ node, overrides, components = [], onSetOverride, onResetOverride }: InstanceOverridesProps) {
  const texts = overrideTexts(node, components);
  if (texts.length === 0) return <p className="property-help">参照元に上書きできるテキストがありません。</p>;
  return <div className="override-rows">
    {texts.map((item) => <OverrideRow key={item.key} item={item} override={overrides[item.key]}
      onSet={(content) => onSetOverride(item.key, { content })} onReset={() => onResetOverride(item.key)} />)}
  </div>;
}
