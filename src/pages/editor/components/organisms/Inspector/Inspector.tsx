import type { Alignment, FrameLayoutPatch, LayerDirection, SelectionSpacing, SizeAxis, SizeConstraintPatch, SpacingAxis, TextIconAlignment } from "@/document/commands/index.ts";
import type { DocumentNode, EllipseNode, FrameNode, FrameStyle, Geometry, ImageStyle, InstanceOverride, PathFillRule, PathNode, RectangleNode, RectangleStyle, Shadow, SpacingToken, TextMarkRangeEdit, TextStyle, VectorPathCommand } from "@/document/types";

import type { ReactNode } from "react";

import { CornerRadiiEditor } from "@/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor";
import { FillEditor } from "@/pages/editor/components/molecules/FillEditor";
import { FrameLayoutEditor } from "@/pages/editor/components/molecules/FrameLayoutEditor";
import { FramePreview } from "@/pages/editor/components/molecules/FramePreview";
import { GeometryEditor } from "@/pages/editor/components/molecules/GeometryEditor";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { ImageStyleEditor } from "@/pages/editor/components/molecules/ImageStyleEditor";
import { InstanceOverrides } from "@/pages/editor/components/molecules/InstanceOverrides";
import { LayerIcon } from "@/pages/editor/components/atoms/LayerIcon";
import { NameEditor } from "@/pages/editor/components/atoms/NameEditor";
import { PathPointEditor } from "@/pages/editor/components/molecules/PathPointEditor";
import { SizeConstraintEditor } from "@/pages/editor/components/molecules/SizeConstraintEditor";
import { TextAppearance } from "@/pages/editor/components/molecules/TextAppearance";

import { blurOnEnter, Field } from "@/pages/editor/components/atoms/Field";
import { DEFAULT_STROKE, hasStroke, StrokeEditor } from "@/pages/editor/components/molecules/StrokeEditor";
import { EffectsEditor, nextEffect } from "@/pages/editor/components/molecules/EffectsEditor";
import { Menu, type MenuEntry } from "@/pages/editor/components/molecules/Menu";
import { SectionHeader, type SectionHeaderAction } from "@/pages/editor/components/molecules/SectionHeader";

interface InspectorProps {
  selected?: DocumentNode;
  selectedCount?: number;
  spacingTokens?: SpacingToken[];
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
  textIcon?: { measurement?: TextIconAlignment; error?: string };
  onAlignTextIcon?(): void;
  spacing?: { x?: SelectionSpacing; y?: SelectionSpacing; error?: string };
  onDistribute?(axis: SpacingAxis, mode: "equal" | number): void;
  onExportFrame(): void;
  onCopyId(id: string): void;
  isExporting: boolean;
  onCreateComponent(): void;
  onGoToDefinition(): void;
  componentName?: string;
  componentNode?: DocumentNode;
  onSetOverride(childId: string, patch: InstanceOverride): void;
  onResetOverride(childId: string): void;
  onDetach(): void;
}

const KIND_LABELS: Record<DocumentNode["type"], string> = {
  frame: "フレーム", text: "テキスト", image: "画像", rectangle: "矩形", ellipse: "楕円", path: "パス", instance: "インスタンス",
};

// 見出しの「⋯」メニュー。編集のたびには使わない操作をまとめる。フレームだけが持つ操作は、ほかの種類では押せなくする。
export function moreMenuEntries(node: DocumentNode, selectedCount: number, isExporting: boolean, actions: {
  rename(): void; duplicate(): void; remove(): void; reorder(direction: LayerDirection): void; createComponent(): void; exportFrame(): void; copyId(): void;
}): MenuEntry[] {
  const isFrame = node.type === "frame";
  return [
    { type: "item", label: "名前を変更", onSelect: actions.rename },
    { type: "item", label: "複製", onSelect: actions.duplicate },
    { type: "item", label: selectedCount > 1 ? "選択中を削除" : "削除", onSelect: actions.remove },
    { type: "separator" },
    { type: "item", label: "最前面へ", onSelect: () => actions.reorder("front") },
    { type: "item", label: "最背面へ", onSelect: () => actions.reorder("back") },
    { type: "separator" },
    { type: "item", label: "コンポーネントを作成", disabled: !isFrame, onSelect: actions.createComponent },
    { type: "item", label: isExporting ? "PNG を生成中…" : "PNG に書き出す", disabled: !isFrame || isExporting, onSelect: actions.exportFrame },
    { type: "separator" },
    { type: "item", label: "ID をコピー", onSelect: actions.copyId },
    { type: "note", content: <code className="node-id">{node.id}</code> },
  ];
}

// 「⋯」メニューは、プロパティの列からはみ出さないよう、ボタンの右端にそろえて下に開く。
export function belowAlignedEnd(opener: HTMLElement): { top: number; left: number } {
  const rect = opener.getBoundingClientRect();
  return { top: rect.bottom + 8, left: Math.max(8, rect.right - 200) };
}

// 見た目の節。塗りと線は未設定なら＋で足し、設定済みなら−で外す。角丸は矩形とフレームだけが持つ。
function AppearanceSections({ node, onStyle }: { node: FrameNode | RectangleNode | EllipseNode | PathNode; onStyle(style: Partial<RectangleStyle>): void }) {
  const style = node.style;
  const stroked = hasStroke(style);
  const defaultFill = node.type === "frame" ? "#ffffff" : "#d9d9d9";
  return <>
    <Section id="fill" title="塗り" action={style.fill === null
      ? { kind: "add", label: "塗りを追加", onClick: () => onStyle({ fill: defaultFill }) }
      : { kind: "remove", label: "塗りを外す", onClick: () => onStyle({ fill: null }) }}>
      {style.fill !== null && <FillEditor fill={style.fill} onChange={(fill) => onStyle({ fill })} />}
    </Section>
    <Section id="stroke" title="線" action={stroked
      ? { kind: "remove", label: "線を外す", onClick: () => onStyle("border" in style ? { stroke: null, border: {} } : { stroke: null }) }
      : { kind: "add", label: "線を追加", onClick: () => onStyle({ stroke: { ...DEFAULT_STROKE } }) }}>
      {stroked && <StrokeEditor key={node.id} style={style} onChange={onStyle} />}
    </Section>
    {"cornerRadii" in style && <Section id="corners" title="角丸">
      <CornerRadiiEditor key={node.id} radii={style.cornerRadii} onChange={(cornerRadii) => onStyle({ cornerRadii })} />
    </Section>}
  </>;
}

// プロパティの節。見出しと中身を一組にし、節の間は CSS で区切り線を引く。
function Section({ id, title, action, children }: { id: string; title: string; action?: SectionHeaderAction; children: ReactNode }) {
  return <section className="inspector-section" aria-labelledby={`inspector-${id}`}>
    <SectionHeader id={`inspector-${id}`} title={title} action={action} />
    {children}
  </section>;
}

// 複数を選んでいるときの整列と間隔。見出しのすぐ下に置く。
function SelectionTools({ selectedCount, onAlign, textIcon, onAlignTextIcon, spacing, onDistribute }: Pick<InspectorProps, "onAlign" | "textIcon" | "onAlignTextIcon" | "spacing" | "onDistribute"> & { selectedCount: number }) {
  return <Section id="selection" title={`${selectedCount} 個を選択中`}>
    <p className="property-help">ドラッグで一括移動できます。</p>
    {onAlign && <div className="alignment-actions" aria-label="選択要素の整列">
      {([ ["左", "left"], ["横中央", "centerX"], ["右", "right"], ["上", "top"], ["縦中央", "centerY"], ["下", "bottom"] ] as const).map(([label, alignment]) =>
        <button key={alignment} type="button" className="file-button" onClick={() => onAlign(alignment)}>{label}</button>)}
    </div>}
    {selectedCount === 2 && textIcon && <div className="text-icon-actions" aria-label="文字とアイコンの整列">
      <div className="field-label">文字行とアイコン</div>
      {textIcon.error ? <p className="property-help">{textIcon.error}</p> : <>
        <p className="property-help">行ボックス中心 {Number(textIcon.measurement!.textY.toFixed(2))} px / アイコン中心 {Number(textIcon.measurement!.iconY.toFixed(2))} px</p>
        <p className="property-help">中心差 {Number(textIcon.measurement!.offset.toFixed(2))} px · アイコンを移動します</p>
        <button type="button" className="file-button" onClick={onAlignTextIcon}>行の中心にアイコンを揃える</button>
      </>}
    </div>}
    {selectedCount >= 3 && spacing && <div className="spacing-actions" aria-label="選択要素の間隔">
      <div className="field-label">要素間隔（px）</div>
      {spacing.error ? <p className="property-help">{spacing.error}</p> : (["x", "y"] as const).map((axis) => {
        const intervals = spacing[axis]?.intervals ?? [];
        const uniform = intervals.every(({ distance }) => Math.abs(distance - intervals[0].distance) < 1e-6);
        return <div key={axis} className="spacing-axis">
          <span>{axis === "x" ? "横" : "縦"}</span>
          <span className="spacing-values">{intervals.map(({ distance }) => Number(distance.toFixed(2))).join(" / ")} px</span>
          <button className="file-button" type="button" onClick={() => onDistribute?.(axis, "equal")}>均等</button>
          <label>{axis === "x" ? "横間隔を指定" : "縦間隔を指定"}
            <input key={`${axis}:${intervals.map(({ distance }) => distance).join(":")}`} type="number" min="0" step="any"
              defaultValue={uniform && intervals[0].distance >= 0 ? Number(intervals[0].distance.toFixed(2)) : ""}
              placeholder="px" onKeyDown={blurOnEnter}
              onBlur={(event) => {
                const raw = event.currentTarget.value.trim();
                const value = Number(raw);
                if (raw !== "" && Number.isFinite(value) && value >= 0) onDistribute?.(axis, value);
              }} />
          </label>
        </div>;
      })}
    </div>}
  </Section>;
}

// プロパティは種類によらず、見出し、位置とサイズ、種類ごとの節、見た目の節、効果の順に並べる。種類が持たない節は出さない。
export function Inspector(props: InspectorProps) {
  const { selected, selectedCount = 1, spacingTokens = [], onRename, onGeometry, onRotation, onOpacity, onShadow, onBlur, onMask, onTextContent, onTextStyle,
    onTextMarkRange, onShapeStyle, onFrameStyle, onFrameLayout, onSizeConstraint, onImageStyle, onPath, onDuplicate, onDelete, onReorder,
    onExportFrame, onCopyId, isExporting, onCreateComponent, onGoToDefinition, componentName, componentNode, onSetOverride, onResetOverride, onDetach } = props;
  if (!selected) {
    return <aside className="sidebar inspector" aria-label="プロパティ">
      <p className="panel-empty">キャンバス上の要素を選択すると、ここに詳細が表示されます。</p>
    </aside>;
  }
  const node = selected;
  const added = nextEffect({ shadow: node.shadow, blur: node.blur });
  return (
    <aside className="sidebar inspector" aria-label="プロパティ">
      <div className="properties">
        <div className="inspector-heading">
          <div className="inspector-title">
            <span className="inspector-kind"><LayerIcon type={node.type} />{KIND_LABELS[node.type]}</span>
            <label className="visually-hidden" htmlFor="node-name">名前</label>
            <NameEditor key={`${node.id}:${node.name}`} node={node} onRename={onRename} />
          </div>
          <Menu label="要素の操作" align="end" fixedTo={belowAlignedEnd} entries={moreMenuEntries(node, selectedCount, isExporting, {
            rename: () => { const input = window.document.getElementById("node-name") as HTMLInputElement | null; input?.focus(); input?.select(); },
            duplicate: onDuplicate, remove: onDelete, reorder: onReorder, createComponent: onCreateComponent, exportFrame: onExportFrame,
            copyId: () => onCopyId(node.id),
          })} trigger={(trigger) => <IconButton {...trigger} icon="more" label="要素の操作" />} />
        </div>
        {selectedCount > 1 && <SelectionTools selectedCount={selectedCount} onAlign={props.onAlign} textIcon={props.textIcon}
          onAlignTextIcon={props.onAlignTextIcon} spacing={props.spacing} onDistribute={props.onDistribute} />}
        <Section id="geometry" title="位置とサイズ">
          <GeometryEditor key={`${node.id}:${node.x}:${node.y}:${node.width}:${node.height}`} node={node} onChange={onGeometry} />
          <SizeConstraintEditor key={`${node.id}:${JSON.stringify(node.widthConstraint)}:${JSON.stringify(node.heightConstraint)}`}
            node={node} onChange={onSizeConstraint} />
          <div className="field-pair">
            <Field className="is-wide-label" label="回転" type="number" step="any" value={String(node.rotation)}
              onCommit={(raw) => { const value = Number(raw); if (raw.trim() !== "" && Number.isFinite(value) && value !== node.rotation) onRotation(value); }} />
            <Field className="is-wider-label" label="不透明度" type="number" min="0" max="100" step="any" value={String(node.opacity * 100)}
              onCommit={(raw) => { const value = Number(raw); if (raw.trim() !== "" && value >= 0 && value <= 100 && value / 100 !== node.opacity) onOpacity(value / 100); }} />
          </div>
        </Section>
        {node.type === "frame" && <Section id="layout" title="自動レイアウト">
          <FrameLayoutEditor key={`${node.id}:${node.layoutMode}:${node.padding}:${node.gap}:${node.paddingRef}:${node.gapRef}:${spacingTokens.map((token) => `${token.id}:${token.name}:${token.value}`).join(":")}:${node.alignItems}:${node.justifyContent}`}
            node={node} tokens={spacingTokens} onChange={onFrameLayout} onClipContent={(clipContent) => onFrameStyle({ clipContent })} />
        </Section>}
        {node.type === "text" && <Section id="text" title="テキスト">
          <TextAppearance key={node.id} node={node} onTextContent={onTextContent} onTextStyle={onTextStyle} onTextMarkRange={onTextMarkRange} />
        </Section>}
        {node.type === "image" && <Section id="image" title="画像">
          <ImageStyleEditor key={`${node.id}:${node.style.fit}:${JSON.stringify(node.style.focalPoint)}`} node={node} onChange={onImageStyle} />
          <p className="property-help">画像データは `.nodi` ファイル内に埋め込まれています。</p>
        </Section>}
        {(node.type === "rectangle" || node.type === "ellipse") && <Section id="mask" title="マスク">
          <label className="mask-control">
            <input type="checkbox" checked={node.isMask} onChange={(event) => onMask(event.currentTarget.checked)} />マスクとして使う
          </label>
        </Section>}
        {node.type === "path" && <Section id="path" title="パス">
          <PathPointEditor node={node} onChange={onPath} />
        </Section>}
        {node.type === "instance" && <>
          <Section id="component" title="コンポーネント">
            <p className="property-help">定義「{componentName ?? "不明"}」を参照しています。見た目は定義側で変更されます。</p>
            <button type="button" className="file-button" onClick={onGoToDefinition}>定義へ移動</button>
            <button type="button" className="file-button" onClick={onDetach}>切り離す</button>
          </Section>
          {componentNode && <Section id="overrides" title="上書き">
            <InstanceOverrides node={componentNode} overrides={node.overrides} onSetOverride={onSetOverride} onResetOverride={onResetOverride} />
          </Section>}
        </>}
        {(node.type === "frame" || node.type === "rectangle" || node.type === "ellipse" || node.type === "path") && <AppearanceSections node={node}
          onStyle={node.type === "frame" ? onFrameStyle : onShapeStyle} />}
        {node.type === "image" && <Section id="corners" title="角丸">
          <CornerRadiiEditor key={node.id} radii={node.style.cornerRadii} onChange={(cornerRadii) => onImageStyle({ cornerRadii })} />
        </Section>}
        <Section id="effects" title="効果" action={{ kind: "add", label: "効果を追加", disabled: added === null, onClick: () => {
          if (added?.shadow) onShadow(added.shadow);
          else if (added?.blur !== undefined) onBlur(added.blur);
        } }}>
          <EffectsEditor key={node.id} shadow={node.shadow} blur={node.blur} onShadow={onShadow} onBlur={onBlur} />
        </Section>
        {/* プレビューのモード（#331）ができるまで、フレームの縮小表示をここに残す。 */}
        {node.type === "frame" && <Section id="preview" title="プレビュー">
          <FramePreview key={node.id} frame={node} spacing={spacingTokens} />
        </Section>}
      </div>
    </aside>
  );
}
