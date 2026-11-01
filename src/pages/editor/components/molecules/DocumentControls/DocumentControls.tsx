export interface DocumentControlsProps {
  fileName: string;
  filePath: string | null;
  canUndo: boolean;
  canRedo: boolean;
  isBusy: boolean;
  onUndo(): void;
  onRedo(): void;
  onOpen(): void;
  onSave(): void;
}

export function DocumentControls({ fileName, filePath, canUndo, canRedo, isBusy, onUndo, onRedo, onOpen, onSave }: DocumentControlsProps) {
  return <>
    <div className="brand">
      <span className="brand-mark">N</span>
      <span>Nodi</span>
      <span className="brand-divider" />{" "}
      <span className="document-title" title={filePath ?? undefined}>{fileName}</span>
    </div>
    <span className="topbar-note">DOCUMENT / 001</span>
    <div className="history-controls" aria-label="編集履歴">
      <button className="file-button" type="button" onClick={onUndo} disabled={!canUndo} title="元に戻す (⌘/Ctrl+Z)">元に戻す</button>
      <button className="file-button" type="button" onClick={onRedo} disabled={!canRedo} title="やり直す (⌘/Ctrl+Shift+Z)">やり直す</button>
    </div>
    <button className="file-button" type="button" onClick={onOpen} disabled={isBusy}>開く</button>
    <button className="file-button" type="button" onClick={onSave} disabled={isBusy}>保存</button>
  </>;
}
