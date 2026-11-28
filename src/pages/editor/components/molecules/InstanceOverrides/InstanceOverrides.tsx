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

interface OverrideTarget { key: string; label: string; node: DocumentNode; inner?: InstanceOverride }
interface OverrideText { key: string; label: string; text: TextNode; base: string }

// 上書きできる要素を集める。入れ子のインスタンスの中は `インスタンスID/子のID` のキーで指し、名前を「Legend › ラベル」のように出す。
// 入れ子のインスタンス自身の上書きは、その中の要素の既定値（inner）として扱う。
function overrideTargets(node: DocumentNode, components: readonly ComponentDefinition[], prefix = "", labels: string[] = [],
  inner: Record<string, InstanceOverride> = {}, stack: ReadonlySet<string> = new Set()): OverrideTarget[] {
  const self: OverrideTarget = { key: prefix + node.id, label: [...labels, node.name].join(" › "), node, inner: inner[node.id] };
  if (node.type === "frame") return [self, ...node.children.flatMap((child) => overrideTargets(child, components, prefix, labels, inner, stack))];
  if (node.type !== "instance" || stack.has(node.componentRef)) return [self];
  const definition = components.find((component) => component.id === node.componentRef);
  if (!definition) return [self];
  const merged: Record<string, InstanceOverride> = { ...node.overrides };
  for (const [key, value] of Object.entries(scopedOverrides(inner, node.id))) merged[key] = { ...merged[key], ...value };
  return [self, ...overrideTargets(definition.node, components, prefix + node.id + OVERRIDE_PATH_SEPARATOR, [...labels, node.name], merged, new Set([...stack, node.componentRef]))];
}

/** 文言を上書きできるテキストの一覧。 */
export function overrideTexts(node: DocumentNode, components: readonly ComponentDefinition[]): OverrideText[] {
  return overrideTargets(node, components).flatMap(({ key, label, node: target, inner }) =>
    target.type === "text" ? [{ key, label, text: target, base: inner?.content ?? target.content }] : []);
}

const OVERRIDE_LABELS: Record<Exclude<keyof InstanceOverride, "content">, string> = {
  fill: "塗り", stroke: "線", color: "文字色", source: "画像", width: "幅", height: "高さ", visible: "表示", opacity: "不透明度",
  cornerRadii: "角丸", layoutMode: "並べ方", padding: "余白", gap: "間隔", alignItems: "揃え", justifyContent: "配置",
  fontSize: "文字サイズ", fontWeight: "太さ", fontFamily: "書体", lineHeight: "行高", letterSpacing: "字間", textAlign: "文字揃え",
};

/** 文言以外に上書きしている属性の一覧。キーごとに、名前と属性名を返す。 */
export function overriddenAttributes(node: DocumentNode, components: readonly ComponentDefinition[], overrides: Record<string, InstanceOverride>) {
  const labels = new Map(overrideTargets(node, components).map(({ key, label }) => [key, label]));
  return Object.entries(overrides).flatMap(([key, override]) => {
    const names = (Object.keys(override) as (keyof InstanceOverride)[]).flatMap((attribute) => attribute === "content" ? [] : [OVERRIDE_LABELS[attribute]]);
    return names.length === 0 ? [] : [{ key, label: labels.get(key) ?? key, names }];
  });
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

// インスタンスの上書きの行。参照元のテキスト（入れ子のインスタンスの中も含む）ごとに文言の行を並べ、
// 続けて文言以外を上書きした要素ごとに、上書きした属性の名前と戻すボタンの行を並べる。
export function InstanceOverrides({ node, overrides, components = [], onSetOverride, onResetOverride }: InstanceOverridesProps) {
  const texts = overrideTexts(node, components);
  const attributes = overriddenAttributes(node, components, overrides);
  if (texts.length === 0 && attributes.length === 0) return <p className="property-help">参照元に上書きできるテキストがありません。</p>;
  return <div className="override-rows">
    {texts.map((item) => <OverrideRow key={item.key} item={item} override={overrides[item.key]}
      onSet={(content) => onSetOverride(item.key, { content })} onReset={() => onResetOverride(item.key)} />)}
    {attributes.map(({ key, label, names }) => <div key={`attributes-${key}`} className="override-row is-overridden">
      <span className="override-row-name" title={label}>{label}</span>
      <span className="override-row-value override-row-summary">{names.join("・")}</span>
      <IconButton icon="reset" label={`${label}の上書きを元に戻す`} onClick={() => onResetOverride(key)} />
    </div>)}
  </div>;
}
