import { useState } from "react";

import type { FrameLayoutPatch } from "@/document/commands/index.ts";
import type { FrameNode, LayoutAlignment, LayoutJustify, LayoutMode, SpacingToken } from "@/document/types";

export function FrameLayoutEditor({ node, tokens = [], onChange }: { node: FrameNode; tokens?: SpacingToken[]; onChange(patch: FrameLayoutPatch): void }) {
  const paddingToken = tokens.find((token) => token.id === node.paddingRef);
  const gapToken = tokens.find((token) => token.id === node.gapRef);
  const [padding, setPadding] = useState(String(paddingToken?.value ?? node.padding));
  const [gap, setGap] = useState(String(gapToken?.value ?? node.gap));
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
    <div className="frame-spacing-field"><label htmlFor={`padding-mode-${node.id}`}>余白の指定方法</label>
      <select id={`padding-mode-${node.id}`} value={node.paddingRef ?? ""} onChange={(event) => onChange({ paddingRef: event.currentTarget.value || null })}>
        <option value="">直接指定</option>
        {tokens.map((token) => <option key={token.id} value={token.id}>{token.name} · {token.value}px</option>)}
      </select>
      <label>余白（px）<input type="number" min="0" step="any" value={paddingToken?.value ?? padding} disabled={!!node.paddingRef}
        onChange={(event) => setPadding(event.currentTarget.value)}
        onBlur={() => { commitNumber(padding, node.padding, (value) => onChange({ padding: value })); setPadding(String(node.padding)); }} /></label>
      {paddingToken && <span className="spacing-reference-note">↳ {paddingToken.name} · 共通値を編集すると反映</span>}
    </div>
    <div className="frame-spacing-field"><label htmlFor={`gap-mode-${node.id}`}>間隔の指定方法</label>
      <select id={`gap-mode-${node.id}`} value={node.gapRef ?? ""} onChange={(event) => onChange({ gapRef: event.currentTarget.value || null })}>
        <option value="">直接指定</option>
        {tokens.map((token) => <option key={token.id} value={token.id}>{token.name} · {token.value}px</option>)}
      </select>
      <label>間隔（px）<input type="number" min="0" step="any" value={gapToken?.value ?? gap} disabled={!!node.gapRef}
        onChange={(event) => setGap(event.currentTarget.value)}
        onBlur={() => { commitNumber(gap, node.gap, (value) => onChange({ gap: value })); setGap(String(node.gap)); }} /></label>
      {gapToken && <span className="spacing-reference-note">↳ {gapToken.name} · 共通値を編集すると反映</span>}
    </div>
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
