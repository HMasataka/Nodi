// 編集画面の3列の幅。デザインどおり左パネル 240px・右パネル 280px で、閉じた列はキャンバスに譲る。
export type PanelSide = "left" | "right" | "timeline";
export type PanelLayout = Record<PanelSide, boolean>;

// 左右のパネルは開き、タイムラインは閉じた状態で始める。
export const INITIAL_PANEL_LAYOUT: PanelLayout = { left: true, right: true, timeline: false };

export const LEFT_PANEL_WIDTH = 240;
export const RIGHT_PANEL_WIDTH = 280;

export function workspaceColumns(layout: Pick<PanelLayout, "left" | "right">): string {
  return [layout.left ? `${LEFT_PANEL_WIDTH}px` : null, "minmax(0, 1fr)", layout.right ? `${RIGHT_PANEL_WIDTH}px` : null]
    .filter(Boolean).join(" ");
}

export function togglePanel(layout: PanelLayout, side: PanelSide): PanelLayout {
  return { ...layout, [side]: !layout[side] };
}
