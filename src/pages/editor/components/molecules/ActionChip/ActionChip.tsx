import { IconButton } from "@/pages/editor/components/atoms/IconButton";

export type ActionChipProps = {
  zoom: number;
  rightPanelOpen: boolean;
  onToggleRightPanel(): void;
};

// キャンバスの右上に浮かせる操作のチップ。倍率を出し、末尾のボタンで右パネルを開閉する。
// プレビューのアイコンは、プレビューを作るまで出さない。
export function ActionChip({ zoom, rightPanelOpen, onToggleRightPanel }: ActionChipProps) {
  return <div className="canvas-chip action-chip">
    <output className="action-chip-zoom" aria-label="倍率">{Math.round(zoom * 100)}%</output>
    <IconButton icon="panelRight" label={rightPanelOpen ? "右パネルを閉じる" : "右パネルを開く"} aria-expanded={rightPanelOpen} onClick={onToggleRightPanel} />
  </div>;
}
