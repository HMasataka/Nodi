import type { Alignment, LayerDirection } from "@/document/commands/index.ts";
import type { DocumentNode, FrameStyle, Geometry, ImageStyle, RectangleStyle, TextMarkRangeEdit, TextStyle } from "@/document/types";

import { ElementAppearance } from "@/pages/editor/components/molecules/ElementAppearance";
import { GeometryEditor } from "@/pages/editor/components/molecules/GeometryEditor";
import { LayerIcon } from "@/pages/editor/components/atoms/LayerIcon";
import { NameEditor } from "@/pages/editor/components/atoms/NameEditor";

interface InspectorProps {
  selected?: DocumentNode;
  selectedCount?: number;
  onRename(name: string): void;
  onGeometry(geometry: Geometry): void;
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onTextMarkRange(edit: TextMarkRangeEdit): void;
  onShapeStyle(style: Partial<RectangleStyle>): void;
  onFrameStyle(style: Partial<FrameStyle>): void;
  onImageStyle(style: Partial<ImageStyle>): void;
  onDuplicate(): void;
  onDelete(): void;
  onReorder(direction: LayerDirection): void;
  onAlign?(alignment: Alignment): void;
  onExportFrame(): void;
  isExporting: boolean;
}

export function Inspector({ selected, selectedCount = 1, onRename, onGeometry, onTextContent, onTextStyle, onTextMarkRange, onShapeStyle, onFrameStyle, onImageStyle, onDuplicate, onDelete, onReorder, onAlign, onExportFrame, isExporting }: InspectorProps) {
  return (
    <aside className="sidebar inspector" aria-label="プロパティ">
      <div className="panel-heading"><h2>プロパティ</h2><span>01</span></div>
      {selected ? (
        <div className="properties">
          <div className="selection-type">
            <LayerIcon type={selected.type} />{" "}
            {selected.type === "rectangle" ? "矩形" : selected.type === "ellipse" ? "楕円" : selected.type === "text" ? "テキスト" : selected.type === "image" ? "画像" : "フレーム"}
          </div>
          {selectedCount > 1 && <p className="property-help">{selectedCount} 個の要素を選択中。ドラッグで一括移動できます。</p>}
          {selectedCount > 1 && onAlign && <div className="alignment-actions" aria-label="選択要素の整列">
            {([ ["左", "left"], ["横中央", "centerX"], ["右", "right"], ["上", "top"], ["縦中央", "centerY"], ["下", "bottom"] ] as const).map(([label, alignment]) =>
              <button key={alignment} type="button" className="file-button" onClick={() => onAlign(alignment)}>{label}</button>)}
          </div>}
          <label className="field-label" htmlFor="node-name">名前</label>
          <NameEditor key={`${selected.id}:${selected.name}`} node={selected} onRename={onRename} />
          <div className="property-divider" />
          <div className="field-label">位置・サイズ</div>
          <GeometryEditor key={`${selected.id}:${selected.x}:${selected.y}:${selected.width}:${selected.height}`}
            node={selected} onChange={onGeometry} />
          <ElementAppearance node={selected} onTextContent={onTextContent} onTextStyle={onTextStyle} onTextMarkRange={onTextMarkRange}
            onShapeStyle={onShapeStyle} onFrameStyle={onFrameStyle} onImageStyle={onImageStyle} />
          <div className="property-divider" />
          <div className="field-label">要素 ID</div>
          <code className="node-id">{selected.id}</code>
          <p className="property-help">名前は変更できます。ID はこの要素を正確に指すために変わりません。</p>
          <div className="node-actions">
            <button type="button" className="file-button" onClick={onDuplicate}>複製</button>
            <button type="button" className="file-button" onClick={onDelete}>{selectedCount > 1 ? "選択中を削除" : "削除"}</button>
          </div>
          <div className="node-actions layer-depth-actions">
            <button type="button" className="file-button" onClick={() => onReorder("front")}>最前面へ</button>
            <button type="button" className="file-button" onClick={() => onReorder("back")}>最背面へ</button>
          </div>
          {selected.type === "frame" && <button type="button" className="file-button export-button" onClick={onExportFrame} disabled={isExporting}>
            {isExporting ? "PNG を生成中…" : "PNG に書き出す"}
          </button>}
        </div>
      ) : <p className="panel-empty">キャンバス上の要素を選択すると、ここに詳細が表示されます。</p>}
    </aside>
  );
}
