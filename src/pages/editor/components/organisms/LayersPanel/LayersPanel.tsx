import type { DocumentNode } from "@/document/types";
import type { LayerDirection } from "@/document/commands/index.ts";
import { LayerIcon } from "@/pages/editor/components/atoms/LayerIcon";

// 行の左端の余白。深さごとに 16px ずつ字下げする。
export function layerIndent(depth: number): number {
  return 8 + depth * 16;
}

interface LayersPanelProps {
  nodes: DocumentNode[];
  selectedId: string | null;
  selectedIds?: string[];
  onSelect(id: string, additive?: boolean): void;
  onReorder(id: string, direction: LayerDirection): void;
}

export function LayersPanel({ nodes, selectedId, selectedIds = selectedId ? [selectedId] : [], onSelect, onReorder }: LayersPanelProps) {
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
    </aside>
  );
}
