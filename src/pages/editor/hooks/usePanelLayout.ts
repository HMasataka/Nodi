import { useState } from "react";

import { INITIAL_PANEL_LAYOUT, type PanelLayout, type PanelSide, togglePanel } from "@/pages/editor/panelLayout.ts";

// 左右のパネルとタイムラインの開閉状態。開閉はキャンバスの幅だけを変え、選択やズームには触れない。
export function usePanelLayout(initial: PanelLayout = INITIAL_PANEL_LAYOUT) {
  const [layout, setLayout] = useState(initial);
  return { layout, toggle: (side: PanelSide) => setLayout((current) => togglePanel(current, side)) };
}
