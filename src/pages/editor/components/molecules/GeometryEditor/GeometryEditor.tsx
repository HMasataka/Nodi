import { useState } from "react";
import type { DocumentNode, Geometry } from "@/document/types";

export function GeometryEditor({ node, onChange }: { node: DocumentNode; onChange(geometry: Geometry): void }) {
  const [draft, setDraft] = useState<Record<keyof Geometry, string>>({
    x: String(node.x), y: String(node.y), width: String(node.width), height: String(node.height),
  });
  const fields: { key: keyof Geometry; label: string }[] = [
    { key: "x", label: "X" }, { key: "y", label: "Y" },
    { key: "width", label: "W" }, { key: "height", label: "H" },
  ];
  return <div className="geometry-fields">
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
  </div>;
}
