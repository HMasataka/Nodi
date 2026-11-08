import { useEffect, useMemo, useState } from "react";

import { ContentEditor } from "@/pages/editor/components/atoms/ContentEditor";
import { TextStyleEditor } from "@/pages/editor/components/molecules/TextStyleEditor";
import { DEFAULT_TEXT_FONT_WEIGHT, type TextMarkPatch, type TextMarkRangeEdit, type TextNode, type TextStyle } from "@/document/types";
import { graphemeBoundaries, graphemeSegments } from "@/document/textLayout";
import { rangeHasMark, remapTextMarks } from "@/document/textMarks";

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
  const baseWeight = node.fontWeight ?? DEFAULT_TEXT_FONT_WEIGHT;
  const bold = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => (mark?.fontWeight ?? baseWeight) >= 600);
  const underline = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => mark?.underline === true);
  const code = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => mark?.code === true);
  const first = marks.find((mark) => mark.start <= selection.start && mark.end > selection.start);
  const firstColor = first?.color ?? node.color;
  const color = canStyle && rangeHasMark(marks, selection.start, selection.end, (mark) => (mark?.color ?? node.color) === firstColor)
    ? firstColor : node.color;

  function apply(patch: TextMarkPatch) {
    if (!canStyle) return;
    onTextMarkRange({ content: draft, start: selection.start, end: selection.end, patch });
  }

  return <>
    <div className="field-label">本文</div>
    <ContentEditor value={draft}
      onChange={(value, start, end) => { setDraft(value); setSelection({ start, end }); }}
      onSelect={(start, end) => setSelection({ start, end })}
      onBlur={() => { if (draft !== node.content) onTextContent(draft); }} />
    <div className="field-label">選択範囲の装飾</div>
    <div className="text-mark-controls" aria-label="選択範囲の装飾">
      <p>{canStyle ? `${graphemeSegments(draft.slice(selection.start, selection.end)).length} 文字を選択中` : "本文から文字を選択してください"}</p>
      <div className="text-mark-actions">
        <button type="button" aria-pressed={bold} disabled={!canStyle}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply({ fontWeight: bold ? (baseWeight >= 600 ? 400 : null) : 700 })}>太字</button>
        <button type="button" aria-pressed={underline} disabled={!canStyle}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply({ underline: !underline })}>下線</button>
        <button type="button" aria-pressed={code} disabled={!canStyle}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply({ code: !code })}>コード</button>
      </div>
      <div className="text-mark-actions">
        <label>文字色 <input type="color" value={color} disabled={!canStyle}
          onChange={(event) => apply({ color: event.currentTarget.value })} /></label>
        <button type="button" disabled={!canStyle} onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply({ color: null })}>色を戻す</button>
      </div>
    </div>
    <div className="field-label">文字の見た目</div>
    <TextStyleEditor key={`${node.id}:${node.fontSize}:${node.color}:${node.textAlign}:${node.fontFamily}:${node.fontWeight}:${node.lineHeight}:${node.letterSpacing}`}
      node={node} onChange={onTextStyle} />
  </>;
}
