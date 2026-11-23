import { Icon } from "@/pages/editor/components/atoms/Icon";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";

export type FileChipProps = {
  fileName: string;
  filePath: string | null;
  isDirty: boolean;
  leftPanelOpen: boolean;
  onToggleLeftPanel(): void;
};

// キャンバスの左上に浮かせるファイルのチップ。先頭で左パネルを開閉し、未保存のときはファイル名の直後に点を出す。
export function FileChip({ fileName, filePath, isDirty, leftPanelOpen, onToggleLeftPanel }: FileChipProps) {
  return <div className="canvas-chip file-chip">
    <IconButton icon="panelLeft" label={leftPanelOpen ? "左パネルを閉じる" : "左パネルを開く"} aria-expanded={leftPanelOpen} onClick={onToggleLeftPanel} />
    <div className="file-chip-trigger" title={filePath ?? undefined}>
      <span className="file-chip-name">{fileName}</span>
      {isDirty ? <span className="file-chip-unsaved" role="img" aria-label="未保存の変更があります" /> : null}
      <Icon name="chevronDown" className="file-chip-arrow" />
    </div>
  </div>;
}
