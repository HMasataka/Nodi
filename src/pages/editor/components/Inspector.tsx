import { useState } from "react";
import type { DocumentNode, EllipseNode, Geometry, RectangleNode, RectangleStyle, TextNode, TextStyle } from "../../../document/types";

function GeometryEditor({ node, onChange }: { node: DocumentNode; onChange: (geometry: Geometry) => void }) {
  const [draft, setDraft] = useState<Record<keyof Geometry, string>>({
    x: String(node.x), y: String(node.y), width: String(node.width), height: String(node.height),
  });
  const fields: { key: keyof Geometry; label: string }[] = [
    { key: "x", label: "X" }, { key: "y", label: "Y" },
    { key: "width", label: "W" }, { key: "height", label: "H" },
  ];
  return (
    <div className="geometry-fields">
      {fields.map(({ key, label }) => (
        <label key={key} className="geometry-field">
          <span>{label}</span>
          <input type="number" step="any" value={draft[key]}
            onChange={(event) => setDraft({ ...draft, [key]: event.currentTarget.value })}
            onBlur={() => {
              if (draft[key] !== String(node[key])) onChange({ ...node, [key]: draft[key].trim() === "" ? NaN : Number(draft[key]) });
            }}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
        </label>
      ))}
    </div>
  );
}

function StyleEditor({ node, onChange }: { node: RectangleNode | EllipseNode; onChange: (style: Partial<RectangleStyle>) => void }) {
  const [fill, setFill] = useState(node.fill);
  const [stroke, setStroke] = useState(node.stroke);
  const [strokeWidth, setStrokeWidth] = useState(String(node.strokeWidth));
  const [cornerRadius, setCornerRadius] = useState(node.type === "rectangle" ? String(node.cornerRadius) : "");
  return (
    <div className="style-fields">
      <label>塗り <input type="color" value={fill} onChange={(event) => setFill(event.currentTarget.value)} onBlur={() => { if (fill !== node.fill) onChange({ fill }); }} /></label>
      <label>線 <input type="color" value={stroke} onChange={(event) => setStroke(event.currentTarget.value)} onBlur={() => { if (stroke !== node.stroke) onChange({ stroke }); }} /></label>
      <label>線幅 <input type="number" min="0" step="any" value={strokeWidth} onChange={(event) => setStrokeWidth(event.currentTarget.value)} onBlur={() => { if (strokeWidth !== String(node.strokeWidth)) onChange({ strokeWidth: strokeWidth.trim() === "" ? NaN : Number(strokeWidth) }); }} /></label>
      {node.type === "rectangle" && <label>角丸 <input type="number" min="0" step="any" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} onBlur={() => { if (cornerRadius !== String(node.cornerRadius)) onChange({ cornerRadius: cornerRadius.trim() === "" ? NaN : Number(cornerRadius) }); }} /></label>}
    </div>
  );
}

function ContentEditor({ node, onChange }: { node: TextNode; onChange: (content: string) => void }) {
  const [draft, setDraft] = useState(node.content);
  return (
    <textarea className="content-editor" value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => { if (draft !== node.content) onChange(draft); }}
      aria-label="テキスト本文" />
  );
}

function TextStyleEditor({ node, onChange }: { node: TextNode; onChange: (style: Partial<TextStyle>) => void }) {
  const [fontSize, setFontSize] = useState(String(node.fontSize));
  const [color, setColor] = useState(node.color);
  return (
    <div className="text-style-fields">
      <label>文字サイズ
        <input type="number" min="1" step="any" value={fontSize}
          onChange={(event) => setFontSize(event.currentTarget.value)}
          onBlur={() => { if (fontSize !== String(node.fontSize)) onChange({ fontSize: fontSize.trim() === "" ? NaN : Number(fontSize) }); }} />
      </label>
      <label>文字色
        <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)}
          onBlur={() => { if (color !== node.color) onChange({ color }); }} />
      </label>
      <label>揃え
        <select value={node.textAlign} onChange={(event) => onChange({ textAlign: event.currentTarget.value as TextStyle["textAlign"] })}>
          <option value="left">左</option><option value="center">中央</option><option value="right">右</option>
        </select>
      </label>
      <p>枠の幅で折り返し、高さを超えた本文は隠れます。枠の高さは「位置・サイズ」で変更できます。</p>
    </div>
  );
}

function NameEditor({ node, onRename }: { node: DocumentNode; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(node.name);
  return (
    <input id="node-name" value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => { if (draft !== node.name) onRename(draft); }}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
      spellCheck={false} />
  );
}

interface InspectorProps {
  selected?: DocumentNode;
  onRename(name: string): void;
  onGeometry(geometry: Geometry): void;
  onTextContent(content: string): void;
  onTextStyle(style: Partial<TextStyle>): void;
  onShapeStyle(style: Partial<RectangleStyle>): void;
  onDuplicate(): void;
  onDelete(): void;
}

export function Inspector({ selected, onRename, onGeometry, onTextContent, onTextStyle, onShapeStyle, onDuplicate, onDelete }: InspectorProps) {
  return (
    <aside className="sidebar inspector" aria-label="プロパティ">
      <div className="panel-heading"><h2>プロパティ</h2><span>01</span></div>
      {selected ? (
        <div className="properties">
          <div className="selection-type">
            <span className="layer-icon" aria-hidden="true" />{" "}
            {selected.type === "rectangle" ? "矩形" : selected.type === "ellipse" ? "楕円" : selected.type === "text" ? "テキスト" : "フレーム"}
          </div>
          <label className="field-label" htmlFor="node-name">名前</label>
          <NameEditor key={`${selected.id}:${selected.name}`} node={selected} onRename={onRename} />
          <div className="property-divider" />
          <div className="field-label">位置・サイズ</div>
          <GeometryEditor key={`${selected.id}:${selected.x}:${selected.y}:${selected.width}:${selected.height}`}
            node={selected} onChange={onGeometry} />
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
              <StyleEditor key={`${selected.id}:${selected.fill}:${selected.stroke}:${selected.strokeWidth}:${selected.type === "rectangle" ? selected.cornerRadius : "ellipse"}`}
                node={selected} onChange={onShapeStyle} />
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
        </div>
      ) : <p className="panel-empty">キャンバス上の要素を選択すると、ここに詳細が表示されます。</p>}
    </aside>
  );
}
