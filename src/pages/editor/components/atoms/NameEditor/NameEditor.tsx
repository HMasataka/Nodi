import { useState } from "react";
import type { DocumentNode } from "../../../../../document/types";

export function NameEditor({ node, onRename }: { node: DocumentNode; onRename(name: string): void }) {
  const [draft, setDraft] = useState(node.name);
  return <input id="node-name" value={draft}
    onChange={(event) => setDraft(event.currentTarget.value)}
    onBlur={() => { if (draft !== node.name) onRename(draft); }}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
    spellCheck={false} />;
}
