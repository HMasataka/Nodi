interface ContentEditorProps {
  value: string;
  onChange(value: string, start: number, end: number): void;
  onSelect(start: number, end: number): void;
  onBlur(): void;
}

export function ContentEditor({ value, onChange, onSelect, onBlur }: ContentEditorProps) {
  return <textarea className="content-editor" value={value}
    onChange={(event) => onChange(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd)}
    onSelect={(event) => onSelect(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)}
    onBlur={onBlur}
    aria-label="テキスト本文" />;
}
