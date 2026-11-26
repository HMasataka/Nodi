import { useState } from "react";

import type { DocumentNode, InstanceOverride, TextNode } from "@/document/types";

import { blurOnEnter } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";

interface InstanceOverridesProps {
  node: DocumentNode;
  overrides: Record<string, InstanceOverride>;
  onSetOverride(childId: string, patch: InstanceOverride): void;
  onResetOverride(childId: string): void;
}

function collectTexts(node: DocumentNode): TextNode[] {
  if (node.type === "text") return [node];
  if (node.type === "frame") return node.children.flatMap(collectTexts);
  return [];
}

// 上書きの1行。名前・値・戻すを並べ、値は blur か Enter で確定する。上書きしていないときは戻せない。
function OverrideRow({ text, override, onSet, onReset }: { text: TextNode; override?: InstanceOverride; onSet(content: string): void; onReset(): void }) {
  const value = override?.content ?? text.content;
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(value);
  }
  const overridden = override?.content !== undefined;
  return <div className={`override-row${overridden ? " is-overridden" : ""}`}>
    <label className="override-row-name" htmlFor={`override-${text.id}`}>{text.name}</label>
    <input id={`override-${text.id}`} className="override-row-value" type="text" value={draft} spellCheck={false}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => { if (draft !== value) onSet(draft); }} onKeyDown={blurOnEnter} />
    <IconButton icon="reset" label={`${text.name}を元に戻す`} disabled={!overridden} onClick={onReset} />
  </div>;
}

// インスタンスの上書きの行。参照元のテキストごとに1行を並べる。
export function InstanceOverrides({ node, overrides, onSetOverride, onResetOverride }: InstanceOverridesProps) {
  const texts = collectTexts(node);
  if (texts.length === 0) return <p className="property-help">参照元に上書きできるテキストがありません。</p>;
  return <div className="override-rows">
    {texts.map((text) => <OverrideRow key={text.id} text={text} override={overrides[text.id]}
      onSet={(content) => onSetOverride(text.id, { content })} onReset={() => onResetOverride(text.id)} />)}
  </div>;
}
