import { useRef } from "react";

import { Icon } from "@/pages/editor/components/atoms/Icon";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { shortcutLabel } from "@/pages/editor/shortcuts.ts";
import { Menu, type MenuEntry } from "@/pages/editor/components/molecules/Menu";

export type FileChipProps = {
  fileName: string;
  filePath: string | null;
  isDirty: boolean;
  isBusy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  leftPanelOpen: boolean;
  onToggleLeftPanel(): void;
  onOpen(): void;
  onSave(): void;
  onImportSvg(file: File): Promise<void>;
  onUndo(): void;
  onRedo(): void;
  defaultMenuOpen?: boolean;
};

// キャンバスの左上に浮かせるファイルのチップ。先頭で左パネルを開閉し、ファイル名を押すとファイルメニューを開く。
export function FileChip(props: FileChipProps) {
  const { fileName, filePath, isDirty, isBusy, canUndo, canRedo, leftPanelOpen, onToggleLeftPanel } = props;
  const svgInput = useRef<HTMLInputElement>(null);
  const entries: MenuEntry[] = [
    { type: "note", content: <div className="file-menu-document">
      <span className="file-menu-name">{fileName}</span>
      <span className="file-menu-path">{filePath ?? "まだ保存されていません"}</span>
      <span className="file-menu-status">{isDirty ? "未保存の変更があります" : "変更はすべて保存されています"}</span>
    </div> },
    { type: "separator" },
    { type: "item", label: "開く…", shortcut: shortcutLabel("open"), disabled: isBusy, onSelect: props.onOpen },
    { type: "item", label: "保存", shortcut: shortcutLabel("save"), disabled: isBusy, onSelect: props.onSave },
    { type: "separator" },
    { type: "item", label: "SVG パスを取り込む…", onSelect: () => svgInput.current?.click() },
    { type: "separator" },
    { type: "item", label: "元に戻す", shortcut: shortcutLabel("undo"), disabled: !canUndo, onSelect: props.onUndo },
    { type: "item", label: "やり直す", shortcut: shortcutLabel("redo"), disabled: !canRedo, onSelect: props.onRedo },
  ];
  return <div className="canvas-chip file-chip">
    <IconButton icon="panelLeft" label={leftPanelOpen ? "左パネルを閉じる" : "左パネルを開く"} aria-expanded={leftPanelOpen} onClick={onToggleLeftPanel} />
    <Menu label="ファイル" entries={entries} defaultOpen={props.defaultMenuOpen} trigger={(trigger) =>
      <button {...trigger} type="button" className="file-chip-trigger" title={filePath ?? undefined}>
        <span className="file-chip-name">{fileName}</span>
        {isDirty ? <span className="file-chip-unsaved" role="img" aria-label="未保存の変更があります" /> : null}
        <Icon name="chevronDown" className="file-chip-arrow" />
      </button>} />
    <input ref={svgInput} className="image-file-input" type="file" accept="image/svg+xml,.svg" tabIndex={-1}
      aria-label="編集可能なSVGパスファイル" onChange={(event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (file) void props.onImportSvg(file).finally(() => { input.value = ""; });
      }} />
  </div>;
}
