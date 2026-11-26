import { IconButton } from "@/pages/editor/components/atoms/IconButton";

export type ActionChipProps = {
  zoom: number;
  rightPanelOpen: boolean;
  onToggleRightPanel(): void;
  previewing: boolean;
  canPreview: boolean;
  onTogglePreview(): void;
};

// キャンバスの右上に浮かせる操作のチップ。倍率、プレビューの切り換え、右パネルの開閉を並べる。プレビューはフレームを選んでいるときだけ入れる。
export function ActionChip({ zoom, rightPanelOpen, onToggleRightPanel, previewing, canPreview, onTogglePreview }: ActionChipProps) {
  return <div className="canvas-chip action-chip">
    <output className="action-chip-zoom" aria-label="倍率">{Math.round(zoom * 100)}%</output>
    <IconButton icon="preview" label={previewing ? "プレビューを終える" : "プレビュー"} pressed={previewing} disabled={!previewing && !canPreview}
      title={!previewing && !canPreview ? "フレームを選ぶとプレビューできます" : undefined} onClick={onTogglePreview} />
    <IconButton icon="panelRight" label={rightPanelOpen ? "右パネルを閉じる" : "右パネルを開く"} aria-expanded={rightPanelOpen} onClick={onToggleRightPanel} />
  </div>;
}
