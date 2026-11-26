import type { KeyboardEvent } from "react";

interface ContentEditorProps {
  value: string;
  onChange(value: string, start: number, end: number): void;
  onSelect(start: number, end: number): void;
  onBlur(): void;
  onKeyDown?(event: KeyboardEvent<HTMLTextAreaElement>): void;
}

export function ContentEditor({ value, onChange, onSelect, onBlur, onKeyDown }: ContentEditorProps) {
  return <textarea className="content-editor" value={value}
    onChange={(event) => onChange(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd)}
    onSelect={(event) => onSelect(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)}
    onBlur={onBlur}
    onKeyDown={onKeyDown}
    aria-label="テキスト本文" />;
}
