import { useState } from "react";
import type { FrameNode, FrameStyle } from "@/document/types";

export function FrameStyleEditor({ node, onChange }: { node: FrameNode; onChange(style: Partial<FrameStyle>): void }) {
  const [background, setBackground] = useState(node.style.fill ?? "#ffffff");
  return <div className="style-fields frame-style-fields">
    <label>背景 <input type="color" value={background} onChange={(event) => setBackground(event.currentTarget.value)} onBlur={() => { if (background !== (node.style.fill ?? "#ffffff")) onChange({ fill: background }); }} /></label>
    <label className="frame-overflow-label">はみ出しを表示
      <input type="checkbox" checked={!node.clipContent} onChange={(event) => onChange({ clipContent: !event.currentTarget.checked })} />
    </label>
  </div>;
}
