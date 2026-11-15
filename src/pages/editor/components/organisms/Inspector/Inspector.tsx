import type { Alignment, FrameLayoutPatch, LayerDirection, SizeAxis, SizeConstraintPatch } from "@/document/commands/index.ts";
import type { DocumentNode, FrameStyle, Geometry, ImageStyle, PathFillRule, RectangleStyle, Shadow, TextMarkRangeEdit, TextStyle, VectorPathCommand } from "@/document/types";

import { ElementAppearance } from "@/pages/editor/components/molecules/ElementAppearance";
import { FramePreview } from "@/pages/editor/components/molecules/FramePreview";
import { GeometryEditor } from "@/pages/editor/components/molecules/GeometryEditor";
import { LayerIcon } from "@/pages/editor/components/atoms/LayerIcon";
import { NameEditor } from "@/pages/editor/components/atoms/NameEditor";
import { ShadowEditor } from "@/pages/editor/components/molecules/ShadowEditor";
import { SizeConstraintEditor } from "@/pages/editor/components/molecules/SizeConstraintEditor";

interface InspectorProps {
  selected?: DocumentNode;
  selectedCount?: number;
  onRename(name: string): void;
  onGeometry(geometry: Geometry): void;
  onRotation(rotation: number): void;
  onOpacity(opacity: number): void;
  onShadow(shadow: Shadow | null): void;
  onBlur(blur: number): void;
  onMask(isMask: boolean): void;
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onTextMarkRange(edit: TextMarkRangeEdit): void;
  onShapeStyle(style: Partial<RectangleStyle>): void;
  onFrameStyle(style: Partial<FrameStyle>): void;
  onFrameLayout(patch: FrameLayoutPatch): void;
  onSizeConstraint(axis: SizeAxis, patch: SizeConstraintPatch): void;
  onImageStyle(style: Partial<ImageStyle>): void;
  onPath(patch: { commands?: VectorPathCommand[]; fillRule?: PathFillRule }): void;
  onDuplicate(): void;
  onDelete(): void;
  onReorder(direction: LayerDirection): void;
  onAlign?(alignment: Alignment): void;
  onExportFrame(): void;
  isExporting: boolean;
  onCreateComponent(): void;
  onGoToDefinition(): void;
  componentName?: string;
}

export function Inspector({ selected, selectedCount = 1, onRename, onGeometry, onRotation, onOpacity, onShadow, onBlur, onMask, onTextContent, onTextStyle, onTextMarkRange, onShapeStyle, onFrameStyle, onFrameLayout, onSizeConstraint, onImageStyle, onPath, onDuplicate, onDelete, onReorder, onAlign, onExportFrame, isExporting, onCreateComponent, onGoToDefinition, componentName }: InspectorProps) {
  return (
    <aside className="sidebar inspector" aria-label="プロパティ">
      <div className="panel-heading"><h2>プロパティ</h2><span>01</span></div>
      {selected ? (
        <div className="properties">
          <div className="selection-type">
            <LayerIcon type={selected.type} />{" "}
            {selected.type === "rectangle" ? "矩形" : selected.type === "ellipse" ? "楕円" : selected.type === "path" ? "パス" : selected.type === "text" ? "テキスト" : selected.type === "image" ? "画像" : selected.type === "instance" ? "インスタンス" : "フレーム"}
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
          <SizeConstraintEditor key={`${selected.id}:${JSON.stringify(selected.widthConstraint)}:${JSON.stringify(selected.heightConstraint)}`}
            node={selected} onChange={onSizeConstraint} />
          <label className="geometry-field">
            <span>回転 °</span>
            <input key={`${selected.id}:${selected.rotation}`} type="number" step="any" defaultValue={selected.rotation}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                if (value !== "" && Number(value) !== selected.rotation) onRotation(Number(value));
                else event.currentTarget.value = String(selected.rotation);
              }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </label>
          <label className="geometry-field">
            <span>不透明度 %</span>
            <input key={`${selected.id}:${selected.opacity}`} type="number" min="0" max="100" step="any" defaultValue={selected.opacity * 100}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                const percentage = Number(value);
                if (value !== "" && Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 && percentage / 100 !== selected.opacity) onOpacity(percentage / 100);
                else event.currentTarget.value = String(selected.opacity * 100);
              }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </label>
          <ElementAppearance node={selected} onTextContent={onTextContent} onTextStyle={onTextStyle} onTextMarkRange={onTextMarkRange}
            onShapeStyle={onShapeStyle} onFrameStyle={onFrameStyle} onFrameLayout={onFrameLayout} onImageStyle={onImageStyle} onPath={onPath} />
          {selected.type === "instance" && <>
            <div className="property-divider" />
            <div className="field-label">コンポーネント</div>
            <p className="property-help">定義「{componentName ?? "不明"}」を参照しています。見た目は定義側で変更されます。</p>
            <button type="button" className="file-button" onClick={onGoToDefinition}>定義へ移動</button>
          </>}
          <ShadowEditor key={`${selected.id}:${JSON.stringify(selected.shadow)}`} shadow={selected.shadow} onChange={onShadow} />
          <label className="geometry-field">
            <span>全体ぼかし px</span>
            <input key={`${selected.id}:${selected.blur}`} type="number" min="0" step="any" defaultValue={selected.blur}
              onBlur={(event) => {
                const raw = event.currentTarget.value.trim();
                const value = Number(raw);
                if (raw !== "" && Number.isFinite(value) && value >= 0 && value !== selected.blur) onBlur(value);
                else event.currentTarget.value = String(selected.blur);
              }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </label>
          {(selected.type === "rectangle" || selected.type === "ellipse") && <label className="mask-control">
            <input type="checkbox" checked={selected.isMask} onChange={(event) => onMask(event.currentTarget.checked)} />マスクとして使う
          </label>}
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
          {selected.type === "frame" && <>
            <div className="property-divider" />
            <div className="field-label">コンポーネント</div>
            <button type="button" className="file-button" onClick={onCreateComponent}>コンポーネントを作成</button>
            <div className="property-divider" />
            <div className="field-label">プレビュー</div>
            <FramePreview key={selected.id} frame={selected} />
            <button type="button" className="file-button export-button" onClick={onExportFrame} disabled={isExporting}>
              {isExporting ? "PNG を生成中…" : "PNG に書き出す"}
            </button>
          </>}
        </div>
      ) : <p className="panel-empty">キャンバス上の要素を選択すると、ここに詳細が表示されます。</p>}
    </aside>
  );
}
