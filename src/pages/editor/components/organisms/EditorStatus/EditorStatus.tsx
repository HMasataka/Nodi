import type { DocumentNode } from "@/document/types";

export function EditorStatus({ selected, isDirty, filePath }: { selected?: DocumentNode; isDirty: boolean; filePath: string | null }) {
  return <footer className="statusbar">
    <span><span className={`status-dot${isDirty ? " is-dirty" : ""}`} /> {isDirty ? "未保存の変更" : filePath ? "保存済み" : "変更なし"}</span>
    <span>{selected ? `${selected.name} · ${selected.id}` : "要素が選択されていません"}</span>
  </footer>;
}
