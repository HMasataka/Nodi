import type { DocumentNode, Geometry } from "@/document/types";

import { Field } from "@/pages/editor/components/atoms/Field";

const FIELDS: readonly [keyof Geometry, string][][] = [[["x", "X"], ["y", "Y"]], [["width", "W"], ["height", "H"]]];

// X・Y・W・H を2列で並べる。空欄は NaN として渡し、検証は確定する側に任せる。
export function GeometryEditor({ node, onChange }: { node: DocumentNode; onChange(geometry: Geometry): void }) {
  const geometry: Geometry = { x: node.x, y: node.y, width: node.width, height: node.height };
  return <>
    {FIELDS.map((row) => <div key={row[0][0]} className="field-pair">
      {row.map(([key, label]) => <Field key={key} label={label} type="number" step="any" value={String(node[key])}
        onCommit={(raw) => onChange({ ...geometry, [key]: raw.trim() === "" ? NaN : Number(raw) })} />)}
    </div>)}
  </>;
}
