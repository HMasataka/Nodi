import { deletePathPoint, insertPathPoint, togglePathCurve } from "@/document/pathEdit.ts";
import type { PathFillRule, PathNode, VectorPathCommand } from "@/document/types.ts";

export function PathPointEditor({ node, onChange }: { node: PathNode; onChange(patch: { commands?: VectorPathCommand[]; fillRule?: PathFillRule }): void }) {
  return <fieldset className="path-point-editor">
    <legend>パスの点</legend>
    <label>塗り規則 <select value={node.fillRule} onChange={(event) => onChange({ fillRule: event.currentTarget.value as PathFillRule })}>
      <option value="nonzero">nonzero</option><option value="evenodd">evenodd</option>
    </select></label>
    {node.commands.map((command, index) => {
      const inserted = insertPathPoint(node.commands, index);
      const deleted = deletePathPoint(node.commands, index);
      const toggled = togglePathCurve(node.commands, index);
      return <div className="path-point-row" key={index}>
        <span>{index + 1}. {command.kind === "move" ? "始点" : command.kind === "cubic" ? "曲線" : command.kind === "close" ? "閉路" : "点"}</span>
        {inserted && <button type="button" onClick={() => onChange({ commands: inserted })}>中間点</button>}
        {toggled && <button type="button" onClick={() => onChange({ commands: toggled })}>{command.kind === "line" ? "曲線へ" : "直線へ"}</button>}
        {deleted && <button type="button" onClick={() => onChange({ commands: deleted })}>削除</button>}
      </div>;
    })}
  </fieldset>;
}
