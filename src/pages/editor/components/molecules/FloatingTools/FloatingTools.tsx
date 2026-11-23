import { useRef } from "react";

import type { DrawTool } from "@/pages/editor/types";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import type { IconName } from "@/pages/editor/components/atoms/Icon";

export type FloatingToolsProps = {
  drawTool: DrawTool;
  onDrawToolChange(tool: DrawTool): void;
  onImportImage(file: File): Promise<void>;
  timelineOpen: boolean;
  onToggleTimeline(): void;
};

const tools: { tool: DrawTool; icon: IconName; label: string }[] = [
  { tool: "select", icon: "select", label: "選択" },
  { tool: "frame", icon: "frame", label: "フレーム" },
  { tool: "rectangle", icon: "rectangle", label: "矩形" },
  { tool: "ellipse", icon: "ellipse", label: "楕円" },
  { tool: "path", icon: "pen", label: "ペン" },
  { tool: "text", icon: "text", label: "テキスト" },
];

// キャンバスの下中央に浮かせる作成ツール。描くツールを切り換え、画像はファイルを選んで取り込み、末尾でタイムラインを開閉する。
export function FloatingTools({ drawTool, onDrawToolChange, onImportImage, timelineOpen, onToggleTimeline }: FloatingToolsProps) {
  const imageInput = useRef<HTMLInputElement>(null);
  return <div className="canvas-chip floating-tools" role="toolbar" aria-label="作成ツール">
    {tools.map(({ tool, icon, label }) => <IconButton key={tool} icon={icon} label={label} pressed={drawTool === tool}
      onClick={() => onDrawToolChange(drawTool === tool && tool !== "select" ? "select" : tool)} />)}
    <IconButton icon="image" label="画像" onClick={() => imageInput.current?.click()} />
    <span className="floating-tools-divider" aria-hidden="true" />
    <IconButton icon="timeline" label={timelineOpen ? "タイムラインを閉じる" : "タイムラインを開く"} pressed={timelineOpen} onClick={onToggleTimeline} />
    <input ref={imageInput} className="image-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" tabIndex={-1}
      aria-label="画像ファイル" onChange={(event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (file) void onImportImage(file).finally(() => { input.value = ""; });
      }} />
  </div>;
}
