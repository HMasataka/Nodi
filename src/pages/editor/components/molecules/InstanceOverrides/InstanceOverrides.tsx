import type { DocumentNode, InstanceOverride, TextNode } from "@/document/types";

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

export function InstanceOverrides({ node, overrides, onSetOverride, onResetOverride }: InstanceOverridesProps) {
  const texts = collectTexts(node);
  if (texts.length === 0) {
    return <p className="property-help">定義にオーバーライドできるテキストがありません。</p>;
  }
  return <>
    {texts.map((textNode) => {
      const override = overrides[textNode.id];
      const value = override?.content ?? textNode.content;
      return (
        <div key={textNode.id} className="instance-override">
          <span className="instance-override-label">{textNode.name}</span>
          <input className="instance-override-input" type="text" key={`${textNode.id}:${value}`} defaultValue={value} spellCheck={false}
            onBlur={(event) => { const content = event.currentTarget.value; if (content !== value) onSetOverride(textNode.id, { content }); }}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          {override?.content !== undefined && <button type="button" className="file-button" onClick={() => onResetOverride(textNode.id)}>元に戻す</button>}
        </div>
      );
    })}
  </>;
}
