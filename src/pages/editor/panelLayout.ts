// 編集画面の3列の幅。デザインどおり左パネル 240px・右パネル 280px で、閉じた列はキャンバスに譲る。
export type PanelSide = "left" | "right";
export type PanelLayout = Record<PanelSide, boolean>;

export const LEFT_PANEL_WIDTH = 240;
export const RIGHT_PANEL_WIDTH = 280;

export function workspaceColumns(layout: PanelLayout): string {
  return [layout.left ? `${LEFT_PANEL_WIDTH}px` : null, "minmax(0, 1fr)", layout.right ? `${RIGHT_PANEL_WIDTH}px` : null]
    .filter(Boolean).join(" ");
}

export function togglePanel(layout: PanelLayout, side: PanelSide): PanelLayout {
  return { ...layout, [side]: !layout[side] };
}
