import { useState } from "react";

import type { FrameLayoutPatch } from "@/document/commands/index.ts";
import type { FrameNode, LayoutAlignment, LayoutJustify, LayoutMode } from "@/document/types";

export function FrameLayoutEditor({ node, onChange }: { node: FrameNode; onChange(patch: FrameLayoutPatch): void }) {
  const [padding, setPadding] = useState(String(node.padding));
  const [gap, setGap] = useState(String(node.gap));
  function commitNumber(raw: string, current: number, apply: (value: number) => void) {
    const value = raw.trim();
    if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) return;
    if (Number(value) !== current) apply(Number(value));
  }
  return <div className="frame-layout-fields">
    <div className="field-label">レイアウト</div>
    <label>方向
      <select value={node.layoutMode} onChange={(event) => onChange({ layoutMode: event.currentTarget.value as LayoutMode })}>
        <option value="none">なし（絶対配置）</option>
        <option value="horizontal">横</option>
        <option value="vertical">縦</option>
      </select>
    </label>
    <label>余白（px）
      <input type="number" min="0" step="any" value={padding}
        onChange={(event) => setPadding(event.currentTarget.value)}
        onBlur={() => { commitNumber(padding, node.padding, (value) => onChange({ padding: value })); setPadding(String(node.padding)); }} />
    </label>
    <label>間隔（px）
      <input type="number" min="0" step="any" value={gap}
        onChange={(event) => setGap(event.currentTarget.value)}
        onBlur={() => { commitNumber(gap, node.gap, (value) => onChange({ gap: value })); setGap(String(node.gap)); }} />
    </label>
    <label>交差軸の整列
      <select value={node.alignItems} onChange={(event) => onChange({ alignItems: event.currentTarget.value as LayoutAlignment })}>
        <option value="start">先頭</option><option value="center">中央</option><option value="end">末尾</option>
      </select>
    </label>
    <label>主軸の分配
      <select value={node.justifyContent} onChange={(event) => onChange({ justifyContent: event.currentTarget.value as LayoutJustify })}>
        <option value="start">先頭</option><option value="center">中央</option><option value="end">末尾</option><option value="space-between">均等</option>
      </select>
    </label>
    <p className="property-help">横・縦にすると子要素を padding と間隔に従って並べます。既定は「なし」で、既存の絶対配置は変わりません。</p>
  </div>;
}
