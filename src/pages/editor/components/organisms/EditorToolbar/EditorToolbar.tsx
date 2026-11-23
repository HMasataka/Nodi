import type { ReactNode } from "react";

import { CreationTools, type CreationToolsProps } from "@/pages/editor/components/molecules/CreationTools";
import { DocumentControls, type DocumentControlsProps } from "@/pages/editor/components/molecules/DocumentControls";

export type EditorToolbarProps = CreationToolsProps & DocumentControlsProps & { children?: ReactNode };

export function EditorToolbar(props: EditorToolbarProps) {
  return <header className="topbar">
    {props.children}
    <DocumentControls {...props} />
    <CreationTools {...props} />
  </header>;
}
