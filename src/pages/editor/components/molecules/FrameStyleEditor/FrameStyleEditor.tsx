import { BorderEditor } from "@/pages/editor/components/molecules/BorderEditor/BorderEditor.tsx";
import { ColorField } from "@/pages/editor/components/molecules/ColorField";
import { CornerRadiiEditor } from "@/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor";
import type { FrameNode, FrameStyle } from "@/document/types";

export function FrameStyleEditor({ node, onChange }: { node: FrameNode; onChange(style: Partial<FrameStyle>): void }) {
  return <div className="style-fields frame-style-fields">
    <ColorField label="背景" value={node.style.fill} fallback="#ffffff" onChange={(fill) => onChange({ fill })} />
    <CornerRadiiEditor radii={node.style.cornerRadii} onChange={(cornerRadii) => onChange({ cornerRadii })} />
    <label className="frame-overflow-label">はみ出しを表示
      <input type="checkbox" checked={!node.clipContent} onChange={(event) => onChange({ clipContent: !event.currentTarget.checked })} />
    </label>
    <BorderEditor style={node.style} onChange={(border) => onChange({ border })} />
  </div>;
}
