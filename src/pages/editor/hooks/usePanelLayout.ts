import { useState } from "react";

import { type PanelLayout, type PanelSide, togglePanel } from "@/pages/editor/panelLayout.ts";

// 左右のパネルの開閉状態。開閉はキャンバスの幅だけを変え、選択やズームには触れない。
export function usePanelLayout(initial: PanelLayout = { left: true, right: true }) {
  const [layout, setLayout] = useState(initial);
  return { layout, toggle: (side: PanelSide) => setLayout((current) => togglePanel(current, side)) };
}
