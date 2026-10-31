import type { DocumentNode } from "../../../../../document/types";
import { LayerIcon } from "../../atoms/LayerIcon";

interface LayersPanelProps {
  nodes: DocumentNode[];
  selectedId: string | null;
  onSelect(id: string): void;
}

export function LayersPanel({ nodes, selectedId, onSelect }: LayersPanelProps) {
  function count(items: DocumentNode[]): number {
    return items.reduce((total, node) => total + 1 + (node.type === "frame" ? count(node.children) : 0), 0);
  }

  function renderLayer(node: DocumentNode, depth = 0): React.ReactNode {
    return (
      <div key={node.id}>
        <button type="button" className={`layer-row${selectedId === node.id ? " is-selected" : ""}`}
          style={{ paddingLeft: 11 + depth * 18 }} aria-pressed={selectedId === node.id}
          onClick={() => onSelect(node.id)}>
          <LayerIcon type={node.type} />
          <span className="layer-name">{node.name}</span>
        </button>
        {node.type === "frame" && node.children.map((child) => renderLayer(child, depth + 1))}
      </div>
    );
  }

  return (
    <aside className="sidebar layers" aria-label="レイヤー">
      <div className="panel-heading"><h2>レイヤー</h2><span>{count(nodes).toString().padStart(2, "0")}</span></div>
      {nodes.length === 0
        ? <p className="panel-empty">まだ要素がありません。<br />矩形を追加して始めましょう。</p>
        : <div className="layer-list">{nodes.map((node) => renderLayer(node))}</div>}
    </aside>
  );
}
