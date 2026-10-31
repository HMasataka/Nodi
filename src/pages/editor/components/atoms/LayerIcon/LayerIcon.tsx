import type { DocumentNode } from "../../../../../document/types";

export function LayerIcon({ type }: { type: DocumentNode["type"] }) {
  return <span className={`layer-icon${type === "ellipse" ? " ellipse-icon" : ""}`} aria-hidden="true">
    {type === "text" ? "T" : type === "image" ? "▧" : ""}
  </span>;
}
