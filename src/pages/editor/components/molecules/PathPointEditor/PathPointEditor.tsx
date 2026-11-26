import { deletePathPoint, insertPathPoint, togglePathCurve } from "@/document/pathEdit.ts";
import type { PathFillRule, PathNode, VectorPathCommand } from "@/document/types.ts";

const KIND_LABELS: Record<VectorPathCommand["kind"], string> = { move: "始点", line: "点", cubic: "曲線", close: "閉路" };

// 点の編集の画面に並べる点の一覧。点ごとに中間点の追加、直線と曲線の切り換え、削除を置く。
export function PathPointEditor({ node, onChange }: { node: PathNode; onChange(patch: { commands?: VectorPathCommand[]; fillRule?: PathFillRule }): void }) {
  return <ol className="path-point-list" aria-label="パスの点">
    {node.commands.map((command, index) => {
      const inserted = insertPathPoint(node.commands, index);
      const deleted = deletePathPoint(node.commands, index);
      const toggled = togglePathCurve(node.commands, index);
      return <li className="path-point-row" key={index}>
        <span className="path-point-name">{index + 1}. {KIND_LABELS[command.kind]}</span>
        {inserted && <button type="button" onClick={() => onChange({ commands: inserted })}>中間点</button>}
        {toggled && <button type="button" onClick={() => onChange({ commands: toggled })}>{command.kind === "line" ? "曲線へ" : "直線へ"}</button>}
        {deleted && <button type="button" onClick={() => onChange({ commands: deleted })}>削除</button>}
      </li>;
    })}
  </ol>;
}
