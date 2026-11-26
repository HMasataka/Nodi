import { type MouseEvent, useEffect, useMemo, useState } from "react";

import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { ContentEditor } from "@/pages/editor/components/atoms/ContentEditor";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { matchTextMarkKey } from "@/pages/editor/shortcuts.ts";
import { TextStyleEditor } from "@/pages/editor/components/molecules/TextStyleEditor";
import { graphemeBoundaries, graphemeSegments } from "@/document/textLayout";
import { rangeHasMark, remapTextMarks } from "@/document/textMarks";
import type { TextMarkPatch, TextMarkRangeEdit, TextNode, TextStyle } from "@/document/types";

interface TextAppearanceProps {
  node: TextNode;
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onTextMarkRange(edit: TextMarkRangeEdit): void;
}

export function TextAppearance({ node, onTextContent, onTextStyle, onTextMarkRange }: TextAppearanceProps) {
  const [draft, setDraft] = useState(node.content);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  useEffect(() => {
    setDraft(node.content);
    setSelection((current) => ({ start: Math.min(current.start, node.content.length), end: Math.min(current.end, node.content.length) }));
  }, [node.content]);

  const marks = useMemo(() => remapTextMarks(node.content, draft, node.marks ?? []), [node.content, node.marks, draft]);
  const boundaries = useMemo(() => graphemeBoundaries(draft), [draft]);
  const canStyle = selection.start < selection.end && selection.end <= draft.length && boundaries.has(selection.start) && boundaries.has(selection.end);
  const baseWeight = node.style.fontWeight;
  const bold = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => (mark?.fontWeight ?? baseWeight) >= 600);
  const underline = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => mark?.underline === true);
  const code = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => mark?.code === true);
  const first = marks.find((mark) => mark.start <= selection.start && mark.end > selection.start);
  const firstColor = first?.color ?? node.style.color;
  const color = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => (mark?.color ?? node.style.color) === firstColor)
    ? firstColor : node.style.color;

  function apply(patch: TextMarkPatch) {
    if (!canStyle) return;
    onTextMarkRange({ content: draft, start: selection.start, end: selection.end, patch });
  }

  // ボタンを押しても本文の選択範囲を失わないよう、押した時点でフォーカスを移さない。
  const keepSelection = { onMouseDown: (event: MouseEvent) => event.preventDefault() };
  return <>
    <ContentEditor value={draft}
      onChange={(value, start, end) => { setDraft(value); setSelection({ start, end }); }}
      onSelect={(start, end) => setSelection({ start, end })}
      onBlur={() => { if (draft !== node.content) onTextContent(draft); }}
      onKeyDown={(event) => {
        // ⌘B・⌘U（Windows・Linux では Ctrl）で選択範囲の太字・下線を切り換える。
        const mark = matchTextMarkKey(event);
        if (!mark || !canStyle) return;
        event.preventDefault();
        if (mark === "bold") apply({ fontWeight: bold ? (baseWeight >= 600 ? 400 : null) : 700 });
        else apply({ underline: !underline });
      }} />
    <TextStyleEditor key={`${node.id}:${JSON.stringify(node.style)}`} node={node} onChange={onTextStyle} />
    <div className="text-mark-controls" role="group" aria-label="選択範囲の装飾">
      <div className="text-mark-row">
        <span className="text-mark-caption">{canStyle ? `選択範囲（${graphemeSegments(draft.slice(selection.start, selection.end)).length} 文字）` : "選択範囲"}</span>
        <IconButton icon="bold" label="太字" pressed={bold} disabled={!canStyle} {...keepSelection}
          onClick={() => apply({ fontWeight: bold ? (baseWeight >= 600 ? 400 : null) : 700 })} />
        <IconButton icon="underline" label="下線" pressed={underline} disabled={!canStyle} {...keepSelection}
          onClick={() => apply({ underline: !underline })} />
        <IconButton icon="code" label="コード" pressed={code} disabled={!canStyle} {...keepSelection}
          onClick={() => apply({ code: !code })} />
      </div>
      <div className="text-mark-color">
        <ColorField key={`${node.id}:${selection.start}:${selection.end}:${color}`} label="文字色" value={color} fallback={node.style.color}
          disabled={!canStyle} onChange={(value) => apply({ color: value })} />
        <IconButton icon="reset" label="選択範囲の文字色を戻す" disabled={!canStyle} {...keepSelection} onClick={() => apply({ color: null })} />
      </div>
      {!canStyle && <p className="property-help">本文から文字を選択してください</p>}
    </div>
  </>;
}
