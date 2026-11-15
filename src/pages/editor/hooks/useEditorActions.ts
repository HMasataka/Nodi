import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { pngFiles } from "@/ipc/pngFiles";
import { renderFramePng } from "@/export/framePng";
import { savePng } from "@/export/savePng";
import { toggleSelection } from "@/pages/editor/selection";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { useElementCreation } from "@/pages/editor/hooks/useElementCreation";
import {
  addAnimation, addKeyframe, addSpacingToken, type Alignment, alignNodes, type AnimationTimingPatch, deleteNode, deleteNodes, distributeNodes, duplicateNode, type FrameLayoutPatch, type KeyframePatch, type LayerDirection,
  removeAnimation, removeKeyframe, removeSpacingToken, renameSpacingToken, reorderNode, setAnimationTiming, setBlur, setFrameLayout, setFrameStyle, setImageStyle, setKeyframe, setMask, setNodeGeometry, setNodeSizeConstraint, setNodeStyle, setOpacity, setPath, setRotation, setShadow, setSpacingToken, setTextContent, setTextMarkRange, setTextStyle, type SizeAxis, type SizeConstraintPatch, type SpacingAxis,
} from "@/document/commands/index.ts";
import type { AnimatableProperty, FrameStyle, Geometry, ImageStyle, Keyframe, PathFillRule, RectangleStyle, Shadow, TextMarkRangeEdit, TextStyle, VectorPathCommand } from "@/document/types";

export function useEditorActions(session: ReturnType<typeof useEditorDocument>, playback: { playhead: number; scrollProgress: number }) {
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
      const rendered = await renderFramePng(selected, undefined, { timeMs: playback.playhead, scrollProgress: playback.scrollProgress, components: designRef.current.components, spacing: designRef.current.spacing }, designRef.current.palette);
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
    spacingTokens: {
      onCreate: (name: string, value: number) => {
        const result = addSpacingToken(designRef.current, name, value);
        if (Result.isFailure(result)) { setError(result.error.message); return; }
        recordDocument(result.value.document);
      },
      onRename: (id: string, name: string) => applyDocument(renameSpacingToken(designRef.current, id, name)),
      onValue: (id: string, value: number) => applyDocument(setSpacingToken(designRef.current, id, value)),
      onRemove: (id: string) => applyDocument(removeSpacingToken(designRef.current, id)),
    },
    inspector: {
      onRename: renameSelected,
      onGeometry: (value: Geometry) => changeSelected(value, setNodeGeometry),
      onRotation: (value: number) => changeSelected(value, setRotation),
      onOpacity: (value: number) => changeSelected(value, setOpacity),
      onShadow: (value: Shadow | null) => changeSelected(value, setShadow),
      onBlur: (value: number) => changeSelected(value, setBlur),
      onMask: (value: boolean) => changeSelected(value, setMask),
      onTextContent: (value: string) => changeSelected(value, setTextContent),
      onTextStyle: (value: Partial<TextStyle>) => changeSelected(value, setTextStyle),
      onTextMarkRange: (value: TextMarkRangeEdit) => changeSelected(value, setTextMarkRange),
      onShapeStyle: (value: Partial<RectangleStyle>) => changeSelected(value, setNodeStyle),
      onPath: (value: { commands?: VectorPathCommand[]; fillRule?: PathFillRule }) => changeSelected(value, setPath),
      onFrameStyle: (value: Partial<FrameStyle>) => changeSelected(value, setFrameStyle),
      onFrameLayout: (value: FrameLayoutPatch) => changeSelected(value, setFrameLayout),
      onSizeConstraint: (axis: SizeAxis, patch: SizeConstraintPatch) => {
        if (selected) applyDocument(setNodeSizeConstraint(designRef.current, selected.id, axis, patch));
      },
      onImageStyle: (value: Partial<ImageStyle>) => changeSelected(value, setImageStyle),
      onDuplicate: duplicateSelected,
      onDelete: deleteSelected,
      onReorder: (direction: LayerDirection) => { if (selectedId) reorderLayer(selectedId, direction); },
      onAlign: (alignment: Alignment) => applyDocument(alignNodes(designRef.current, selectedIds, alignment)),
      onDistribute: (axis: SpacingAxis, mode: "equal" | number) => applyDocument(distributeNodes(designRef.current, selectedIds, axis, mode)),
      onExportFrame: () => { void exportSelectedFrame(); },
      isExporting,
    },
    timeline: {
      onAddAnimation: () => {
        if (!selectedId) return;
        const result = addAnimation(designRef.current, selectedId, { name: "アニメーション", trigger: "load" });
        if (Result.isFailure(result)) { setError(result.error.message); return; }
        recordDocument(result.value.document);
      },
      onRemoveAnimation: (animationId: string) => {
        if (selectedId) applyDocument(removeAnimation(designRef.current, selectedId, animationId));
      },
      onSetTiming: (animationId: string, patch: AnimationTimingPatch) => {
        if (selectedId) applyDocument(setAnimationTiming(designRef.current, selectedId, animationId, patch));
      },
      onAddKeyframe: (animationId: string, property: AnimatableProperty, keyframe: Keyframe) => {
        if (selectedId) applyDocument(addKeyframe(designRef.current, selectedId, animationId, property, keyframe));
      },
      onSetKeyframe: (animationId: string, property: AnimatableProperty, time: number, patch: KeyframePatch) => {
        if (selectedId) applyDocument(setKeyframe(designRef.current, selectedId, animationId, property, time, patch));
      },
      onRemoveKeyframe: (animationId: string, property: AnimatableProperty, time: number) => {
        if (selectedId) applyDocument(removeKeyframe(designRef.current, selectedId, animationId, property, time));
      },
    },
  };
}
