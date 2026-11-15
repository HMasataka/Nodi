import { Result } from "@praha/byethrow";
import { useState } from "react";

import { Canvas } from "@/pages/editor/components/organisms/Canvas";
import { ColorResolverContext } from "@/pages/editor/colorContext.ts";
import { countRenderedTextLines } from "@/pages/editor/textIconMeasurement.ts";
import { EditorStatus } from "@/pages/editor/components/organisms/EditorStatus";
import { EditorToolbar } from "@/pages/editor/components/organisms/EditorToolbar";
import { ErrorToast } from "@/pages/editor/components/molecules/ErrorToast";
import { findNode } from "@/document/commands/index.ts";
import { Inspector } from "@/pages/editor/components/organisms/Inspector";
import { LayersPanel } from "@/pages/editor/components/organisms/LayersPanel";
import { measureNode } from "@/rendering/measure.ts";
import { RecoveryDialog } from "@/pages/editor/components/organisms/RecoveryDialog";
import { resolveColor } from "@/document/colorRef.ts";
import { resolveDocumentInstances } from "@/document/instances.ts";
import { resolveDocumentLayout } from "@/document/layout.ts";
import { spacingTokenUsage } from "@/document/spacing.ts";
import { Timeline } from "@/pages/editor/components/organisms/Timeline";
import { useCanvasInteraction } from "@/pages/editor/hooks/useCanvasInteraction";
import { useEditorActions } from "@/pages/editor/hooks/useEditorActions";
import { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { usePlayback } from "@/pages/editor/hooks/usePlayback";
import { activeAnimationTriggers, applyAnimations, applyScrollAnimations } from "@/document/animation.ts";
import type { Color, DocumentNode } from "@/document/types.ts";
import { measureSelectionSpacing, measureTextIconAlignment } from "@/document/commands/index.ts";
import "@/App.css";

function EditorPage() {
  const session = useEditorDocument();
  const interaction = useCanvasInteraction(session);
  const playback = usePlayback();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [clickedIds, setClickedIds] = useState<ReadonlySet<string>>(new Set());
  const [scrollProgress, setScrollProgress] = useState(0);
  const [highlightedComponentId, setHighlightedComponentId] = useState<string | null>(null);
  const actions = useEditorActions(session, { playhead: playback.playhead, scrollProgress });
  const interactionState = { hoveredIds: new Set(hoveredId ? [hoveredId] : []), clickedIds };
  const resolveTriggers = (node: DocumentNode) => activeAnimationTriggers(node, interactionState);
  const { history, design, selectedId, selectedIds, selected, error, setError, filePath, isBusy, isDirty,
    recoveryStatus, restoreRecovery, discardRecovery, openFile, saveFile } = session;
  const selectedComponentName = selected?.type === "instance" ? design.components.find((component) => component.id === selected.componentRef)?.name : undefined;
  const spacingX = selectedIds.length >= 3 ? measureSelectionSpacing(design, selectedIds, "x") : null;
  const spacingY = selectedIds.length >= 3 ? measureSelectionSpacing(design, selectedIds, "y") : null;
  const spacing = spacingX && spacingY ? Result.isFailure(spacingX) ? { error: spacingX.error.message }
    : Result.isFailure(spacingY) ? { error: spacingY.error.message }
      : { x: spacingX.value, y: spacingY.value } : undefined;
  const textIconResult = selectedIds.length === 2 && selectedIds.some((id) => findNode(design, id)?.type === "text")
    ? measureTextIconAlignment(design, selectedIds, countRenderedTextLines) : null;
  const textIcon = textIconResult ? Result.isFailure(textIconResult) ? { error: textIconResult.error.message }
    : { measurement: textIconResult.value } : undefined;
  const { drag, pathDrag, camera, zoom, zoomBy, viewportRef, drawTool, setDrawTool, drawing, pen, selection, guides,
    startDrag, startResize, continueDrag, finishDrag, stepHistory, startPan, continuePan, finishPan,
    onWorldPointerDown, updateDrawing, finishDrawing, cancelDrawing, updatePenCursor, finishPen,
    startPathPointDrag, continuePathPointDrag, finishPathPointDrag, cancelPathPointDrag,
    updateSelection, finishSelection, cancelSelection } = interaction;

  return <ColorResolverContext.Provider value={(color: Color) => resolveColor(color, design.palette)}>
    <main className="app-shell">
    <EditorToolbar fileName={filePath?.split(/[\\/]/).pop() ?? "無題のドキュメント"} filePath={filePath}
      canUndo={history.past.length > 0 && !drag.current && !pathDrag.current} canRedo={history.future.length > 0 && !drag.current && !pathDrag.current}
      isBusy={isBusy} onUndo={() => stepHistory("undo")} onRedo={() => stepHistory("redo")}
       onOpen={openFile} onSave={saveFile} onCreate={actions.create} onImportImage={actions.importImage} onImportSvg={actions.importSvg}
      drawTool={drawTool} onDrawToolChange={setDrawTool} />

    <div className="workspace">
      <LayersPanel nodes={design.children} components={design.components} selectedId={selectedId} selectedIds={selectedIds}
        highlightedComponentId={highlightedComponentId}
        onSelect={actions.selectLayer} onReorder={actions.reorderLayer}
        onPlaceInstance={actions.components.onPlaceInstance} onRenameComponent={actions.components.onRename}
        onDuplicateComponent={actions.components.onDuplicate} onRemoveComponent={actions.components.onRemove} />
      <Canvas design={applyScrollAnimations(applyAnimations(resolveDocumentLayout(resolveDocumentInstances(design), { measure: measureNode }), playback.playhead, resolveTriggers), scrollProgress)} selectedId={selectedId} selectedIds={selectedIds} spacing={spacing} textIcon={textIcon} zoom={zoom} onZoom={zoomBy} viewportRef={viewportRef}
        drawTool={drawTool} drawing={drawing} pen={pen} selection={selection} guides={guides} camera={camera}
        onNodePointerDown={startDrag} onResizePointerDown={startResize} onNodePointerMove={continueDrag} onNodePointerUp={finishDrag}
        onNodeEnter={(id) => setHoveredId(id)}
        onNodeLeave={(id) => setHoveredId((current) => current === id ? null : current)}
        onNodeClick={(id) => setClickedIds((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        })}
        onPathPointPointerDown={startPathPointDrag} onPathPointPointerMove={continuePathPointDrag}
        onPathPointPointerUp={finishPathPointDrag} onPathPointPointerCancel={cancelPathPointDrag}
        onPanPointerDown={startPan} onPanPointerMove={continuePan} onPanPointerUp={finishPan}
        onWorldPointerDown={onWorldPointerDown} onWorldDoubleClick={() => finishPen(false)}
        onWorldPointerMove={(event) => { updateDrawing(event); updatePenCursor(event); updateSelection(event); }}
        onWorldPointerUp={(event) => { finishDrawing(event); finishSelection(event); }}
        onWorldPointerCancel={(pointerId) => { cancelDrawing(pointerId); cancelSelection(pointerId); }}
        onImageError={(id) => setError(`画像を表示できません: ${id}`)} />
      <Inspector selected={selected} selectedCount={selectedIds.length} spacing={spacing} textIcon={textIcon} spacingTokens={design.spacing}
        spacingUsages={Object.fromEntries(design.spacing.map((token) => [token.id, spacingTokenUsage(design, token.id)]))}
        onCreateSpacingToken={actions.spacingTokens.onCreate} onRenameSpacingToken={actions.spacingTokens.onRename}
        onSetSpacingToken={actions.spacingTokens.onValue} onRemoveSpacingToken={actions.spacingTokens.onRemove} {...actions.inspector}
        componentName={selectedComponentName}
        onCreateComponent={actions.components.onCreateFromSelected}
        onGoToDefinition={() => { if (selected?.type === "instance") setHighlightedComponentId(selected.componentRef); }} />
    </div>

    <Timeline node={selected} playback={playback} scrollProgress={scrollProgress} onScrollProgress={setScrollProgress} {...actions.timeline} />
    <EditorStatus selected={selected} isDirty={isDirty} filePath={filePath} />
    {error && <ErrorToast message={error} onClose={() => setError(null)} />}
    {recoveryStatus.kind !== "none" && <RecoveryDialog status={recoveryStatus} onRestore={restoreRecovery}
      onDiscard={() => { void discardRecovery(); }} />}
    </main>
  </ColorResolverContext.Provider>;
}

export default EditorPage;
