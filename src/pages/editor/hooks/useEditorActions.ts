import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { pngFiles } from "@/ipc/pngFiles";
import { renderFramePng } from "@/export/framePng";
import { savePng } from "@/export/savePng";
import { toggleSelection } from "@/pages/editor/selection";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { useElementCreation } from "@/pages/editor/hooks/useElementCreation";
import {
  type Alignment, alignNodes, deleteNode, deleteNodes, duplicateNode, type LayerDirection,
  reorderNode, setFrameStyle, setImageStyle, setMask, setNodeGeometry, setNodeStyle, setRotation, setTextContent, setTextMarkRange, setTextStyle,
} from "@/document/commands/index.ts";
import type { FrameStyle, Geometry, ImageStyle, RectangleStyle, TextMarkRangeEdit, TextStyle } from "@/document/types";

export function useEditorActions(session: ReturnType<typeof useEditorDocument>) {
  const { designRef, selected, selectedId, selectedIds, setSelectedId, setSelectedIds, setError, applyDocument, recordDocument, agentApi } = session;
  const creation = useElementCreation(session);
  const [isExporting, setIsExporting] = useState(false);
  const exporting = useRef(false);

  function deleteSelected() {
    if (!selectedId) return;
    const result = selectedIds.length > 1 ? deleteNodes(designRef.current, selectedIds) : deleteNode(designRef.current, selectedId);
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    recordDocument(result.value);
    setSelectedIds([]);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    const result = duplicateNode(designRef.current, selectedId);
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    recordDocument(result.value.document);
    setSelectedId(result.value.node.id);
  }

  async function exportSelectedFrame() {
    if (selected?.type !== "frame" || exporting.current) return;
    exporting.current = true;
    setIsExporting(true);
    try {
      const rendered = await renderFramePng(selected);
      if (Result.isFailure(rendered)) { setError(rendered.error.message); return; }
      const name = selected.name.trim().replace(/[\\/:*?"<>|]/g, "_") || "frame";
      const saved = await savePng(pngFiles, rendered.value, `${name}.png`);
      if (Result.isFailure(saved)) setError(saved.error.message);
      else if (saved.value !== null) setError(null);
    } finally {
      exporting.current = false;
      setIsExporting(false);
    }
  }

  function renameSelected(name: string) {
    if (!selected) return;
    const result = agentApi.rename(selected.id, name);
    if (Result.isFailure(result)) setError(result.error.message);
  }

  function changeSelected<T>(value: T, command: (document: typeof designRef.current, id: string, value: T) => ReturnType<typeof setNodeGeometry>) {
    if (selected) applyDocument(command(designRef.current, selected.id, value));
  }

  function reorderLayer(id: string, direction: LayerDirection) {
    applyDocument(reorderNode(designRef.current, id, direction));
  }

  function selectLayer(id: string, additive?: boolean) {
    if (additive) setSelectedIds((ids) => toggleSelection(ids, id));
    else setSelectedId(id);
  }

  return {
    ...creation,
    selectLayer,
    reorderLayer,
    inspector: {
      onRename: renameSelected,
      onGeometry: (value: Geometry) => changeSelected(value, setNodeGeometry),
      onRotation: (value: number) => changeSelected(value, setRotation),
      onMask: (value: boolean) => changeSelected(value, setMask),
      onTextContent: (value: string) => changeSelected(value, setTextContent),
      onTextStyle: (value: Partial<TextStyle>) => changeSelected(value, setTextStyle),
      onTextMarkRange: (value: TextMarkRangeEdit) => changeSelected(value, setTextMarkRange),
      onShapeStyle: (value: Partial<RectangleStyle>) => changeSelected(value, setNodeStyle),
      onFrameStyle: (value: Partial<FrameStyle>) => changeSelected(value, setFrameStyle),
      onImageStyle: (value: Partial<ImageStyle>) => changeSelected(value, setImageStyle),
      onDuplicate: duplicateSelected,
      onDelete: deleteSelected,
      onReorder: (direction: LayerDirection) => { if (selectedId) reorderLayer(selectedId, direction); },
      onAlign: (alignment: Alignment) => applyDocument(alignNodes(designRef.current, selectedIds, alignment)),
      onExportFrame: () => { void exportSelectedFrame(); },
      isExporting,
    },
  };
}
