import { BorderEditor } from "@/pages/editor/components/molecules/BorderEditor/BorderEditor.tsx";
import { CornerRadiiEditor } from "@/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor";
import { FillEditor } from "@/pages/editor/components/molecules/FillEditor";
import type { FrameNode, FrameStyle } from "@/document/types";

export function FrameStyleEditor({ node, onChange }: { node: FrameNode; onChange(style: Partial<FrameStyle>): void }) {
  return <div className="style-fields frame-style-fields">
    <FillEditor label="背景" fill={node.style.fill} onChange={(fill) => onChange({ fill })} />
    <CornerRadiiEditor radii={node.style.cornerRadii} onChange={(cornerRadii) => onChange({ cornerRadii })} />
    <label className="frame-overflow-label">はみ出しを表示
      <input type="checkbox" checked={!node.clipContent} onChange={(event) => onChange({ clipContent: !event.currentTarget.checked })} />
    </label>
    <BorderEditor style={node.style} onChange={(border) => onChange({ border })} />
  </div>;
}
