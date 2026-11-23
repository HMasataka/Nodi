import { useEffect, useRef } from "react";

import type { LayerDirection } from "@/document/commands/index.ts";
import { LayerIcon } from "@/pages/editor/components/atoms/LayerIcon";
import type { ComponentDefinition, DocumentNode } from "@/document/types";

import { blurOnEnter } from "@/pages/editor/components/atoms/Field";

// 行の左端の余白。深さごとに 16px ずつ字下げする。
export function layerIndent(depth: number): number {
  return 8 + depth * 16;
}

interface LayersPanelProps {
  nodes: DocumentNode[];
  components?: ComponentDefinition[];
  selectedId: string | null;
  selectedIds?: string[];
  highlightedComponentId?: string | null;
  onSelect(id: string, additive?: boolean): void;
  onReorder(id: string, direction: LayerDirection): void;
  onPlaceInstance?(componentId: string): void;
  onRenameComponent?(componentId: string, name: string): void;
  onDuplicateComponent?(componentId: string): void;
  onRemoveComponent?(componentId: string): void;
}

export function LayersPanel({ nodes, components = [], selectedId, selectedIds = selectedId ? [selectedId] : [], highlightedComponentId, onSelect, onReorder, onPlaceInstance = () => {}, onRenameComponent = () => {}, onDuplicateComponent = () => {}, onRemoveComponent = () => {} }: LayersPanelProps) {
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightedComponentId) highlightedRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedComponentId]);

  function renderLayer(node: DocumentNode, siblings: DocumentNode[], depth = 0): React.ReactNode {
    const index = siblings.findIndex((item) => item.id === node.id);
    return (
      <div key={node.id}>
        <div className="layer-item">
          <button type="button" className={`layer-row${selectedIds.includes(node.id) ? " is-selected" : ""}`}
            style={{ paddingLeft: layerIndent(depth) }} aria-pressed={selectedIds.includes(node.id)}
            onClick={(event) => onSelect(node.id, event.shiftKey)}>
            <LayerIcon type={node.type} />
            <span className="layer-name">{node.name}</span>
            {node.type === "instance" && <span className="layer-badge">インスタンス</span>}
            {("isMask" in node && node.isMask) && <span className="layer-badge">マスク</span>}
          </button>
          <button type="button" className="layer-order" aria-label={`${node.name}を前へ`} title="前へ" disabled={index === siblings.length - 1} onClick={() => onReorder(node.id, "forward")}>↑</button>
          <button type="button" className="layer-order" aria-label={`${node.name}を後ろへ`} title="後ろへ" disabled={index === 0} onClick={() => onReorder(node.id, "backward")}>↓</button>
        </div>
        {node.type === "frame" && [...node.children].reverse().map((child) => renderLayer(child, node.children, depth + 1))}
      </div>
    );
  }

  return (
    <aside className="sidebar layers" aria-label="レイヤー">
      {nodes.length === 0
        ? <p className="panel-empty">まだ要素がありません。<br />下の作成ツールで描いて始めましょう。</p>
        : <div className="layer-list">{[...nodes].reverse().map((node) => renderLayer(node, nodes))}</div>}
      <div className="components-heading"><h2>コンポーネント</h2><span>{components.length.toString().padStart(2, "0")}</span></div>
      {components.length === 0
        ? <p className="panel-empty">フレームを選んで「コンポーネントを作成」すると、ここに定義が並びます。</p>
        : <div className="component-list">
            {components.map((component) => (
              <div key={component.id} ref={highlightedComponentId === component.id ? highlightedRef : undefined}
                className={`component-item${highlightedComponentId === component.id ? " is-highlighted" : ""}`}>
                <div className="component-row">
                  <LayerIcon type="frame" />
                  <input className="component-name" defaultValue={component.name} spellCheck={false}
                    aria-label="コンポーネント名"
                    onBlur={(event) => { const value = event.currentTarget.value; if (value.trim() && value !== component.name) onRenameComponent(component.id, value); }}
                    onKeyDown={blurOnEnter} />
                </div>
                <div className="component-actions">
                  <button type="button" className="file-button" onClick={() => onPlaceInstance(component.id)}>配置</button>
                  <button type="button" className="file-button" onClick={() => onDuplicateComponent(component.id)}>複製</button>
                  <button type="button" className="file-button" onClick={() => onRemoveComponent(component.id)}>削除</button>
                </div>
              </div>
            ))}
          </div>}
    </aside>
  );
}
