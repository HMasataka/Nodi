import { CreationTools, type CreationToolsProps } from "@/pages/editor/components/molecules/CreationTools";
import { DocumentControls, type DocumentControlsProps } from "@/pages/editor/components/molecules/DocumentControls";

export type EditorToolbarProps = CreationToolsProps & DocumentControlsProps;

export function EditorToolbar(props: EditorToolbarProps) {
  return <header className="topbar">
    <DocumentControls {...props} />
    <CreationTools {...props} />
  </header>;
}
