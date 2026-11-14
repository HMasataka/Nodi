import { useRef } from "react";

import type { CreateKind } from "@/pages/editor/creation";
import { DrawingTools, type DrawingToolsProps } from "@/pages/editor/components/molecules/DrawingTools";

export interface CreationToolsProps extends DrawingToolsProps {
  onCreate(kind: CreateKind): void;
  onImportImage(file: File): Promise<void>;
  onImportSvg(file: File): Promise<void>;
}

export function CreationTools({ onCreate, onImportImage, onImportSvg, drawTool, onDrawToolChange }: CreationToolsProps) {
  const imageInput = useRef<HTMLInputElement>(null);
  const svgInput = useRef<HTMLInputElement>(null);
  return <>
    <button className="add-button" type="button" onClick={() => onCreate("rectangle")}><span aria-hidden="true">＋</span> 矩形を追加</button>
    <button className="file-button" type="button" onClick={() => onCreate("ellipse")}>楕円を追加</button>
    <DrawingTools drawTool={drawTool} onDrawToolChange={onDrawToolChange} />
    <button className="file-button" type="button" onClick={() => onCreate("frame")}>フレームを追加</button>
    <button className="file-button" type="button" onClick={() => onCreate("text")}>テキストを追加</button>
    <button className="file-button" type="button" onClick={() => imageInput.current?.click()}>画像を追加</button>
    <button className="file-button" type="button" onClick={() => svgInput.current?.click()}>SVGパスを取り込む</button>
    <input ref={imageInput} className="image-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
      aria-label="画像ファイル" onChange={(event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (file) void onImportImage(file).finally(() => { input.value = ""; });
      }} />
    <input ref={svgInput} className="image-file-input" type="file" accept="image/svg+xml,.svg"
      aria-label="編集可能なSVGパスファイル" onChange={(event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (file) void onImportSvg(file).finally(() => { input.value = ""; });
      }} />
  </>;
}
