import type { DocumentNode, FrameStyle, Geometry, RectangleStyle, TextStyle } from "@/document/types";
import type { LayerDirection } from "@/document/commands/index.ts";
import { ContentEditor } from "@/pages/editor/components/atoms/ContentEditor";
import { LayerIcon } from "@/pages/editor/components/atoms/LayerIcon";
import { NameEditor } from "@/pages/editor/components/atoms/NameEditor";
import { GeometryEditor } from "@/pages/editor/components/molecules/GeometryEditor";
import { FrameStyleEditor } from "@/pages/editor/components/molecules/FrameStyleEditor";
import { ShapeStyleEditor } from "@/pages/editor/components/molecules/ShapeStyleEditor";
import { TextStyleEditor } from "@/pages/editor/components/molecules/TextStyleEditor";

interface InspectorProps {
  selected?: DocumentNode;
  onRename(name: string): void;
  onGeometry(geometry: Geometry): void;
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onShapeStyle(style: Partial<RectangleStyle>): void;
  onFrameStyle(style: Partial<FrameStyle>): void;
  onDuplicate(): void;
  onDelete(): void;
  onReorder(direction: LayerDirection): void;
  onExportFrame(): void;
  isExporting: boolean;
}

export function Inspector({ selected, onRename, onGeometry, onTextContent, onTextStyle, onShapeStyle, onFrameStyle, onDuplicate, onDelete, onReorder, onExportFrame, isExporting }: InspectorProps) {
  return (
    <aside className="sidebar inspector" aria-label="プロパティ">
      <div className="panel-heading"><h2>プロパティ</h2><span>01</span></div>
      {selected ? (
        <div className="properties">
          <div className="selection-type">
            <LayerIcon type={selected.type} />{" "}
            {selected.type === "rectangle" ? "矩形" : selected.type === "ellipse" ? "楕円" : selected.type === "text" ? "テキスト" : selected.type === "image" ? "画像" : "フレーム"}
          </div>
          <label className="field-label" htmlFor="node-name">名前</label>
          <NameEditor key={`${selected.id}:${selected.name}`} node={selected} onRename={onRename} />
          <div className="property-divider" />
          <div className="field-label">位置・サイズ</div>
          <GeometryEditor key={`${selected.id}:${selected.x}:${selected.y}:${selected.width}:${selected.height}`}
            node={selected} onChange={onGeometry} />
          {selected.type === "image" && <p className="property-help">画像データは `.nodi` ファイル内に埋め込まれています。</p>}
          {selected.type === "text" && (
            <>
              <div className="field-label">本文</div>
              <ContentEditor key={`${selected.id}:${selected.content}`} node={selected} onChange={onTextContent} />
              <div className="field-label">文字の見た目</div>
              <TextStyleEditor key={`${selected.id}:${selected.fontSize}:${selected.color}:${selected.textAlign}`}
                node={selected} onChange={onTextStyle} />
            </>
          )}
          {(selected.type === "rectangle" || selected.type === "ellipse") && (
            <>
              <div className="field-label">スタイル</div>
              <ShapeStyleEditor key={`${selected.id}:${selected.fill}:${selected.stroke}:${selected.strokeWidth}:${selected.type === "rectangle" ? selected.cornerRadius : "ellipse"}`}
                node={selected} onChange={onShapeStyle} />
            </>
          )}
          {selected.type === "frame" && (
            <>
              <div className="field-label">フレームの見た目</div>
              <FrameStyleEditor key={`${selected.id}:${selected.background}:${selected.clipContent}`} node={selected} onChange={onFrameStyle} />
            </>
          )}
          <div className="property-divider" />
          <div className="field-label">要素 ID</div>
          <code className="node-id">{selected.id}</code>
          <p className="property-help">名前は変更できます。ID はこの要素を正確に指すために変わりません。</p>
          <div className="node-actions">
            <button type="button" className="file-button" onClick={onDuplicate}>複製</button>
            <button type="button" className="file-button" onClick={onDelete}>削除</button>
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
