import { useState } from "react";
import type { TextNode } from "../../../../../document/types";

export function ContentEditor({ node, onChange }: { node: TextNode; onChange(content: string): void }) {
  const [draft, setDraft] = useState(node.content);
  return <textarea className="content-editor" value={draft}
    onChange={(event) => setDraft(event.currentTarget.value)}
    onBlur={() => { if (draft !== node.content) onChange(draft); }}
    aria-label="テキスト本文" />;
}
