import { Canvas } from "@/pages/editor/components/organisms/Canvas";
import { EditorStatus } from "@/pages/editor/components/organisms/EditorStatus";
import { EditorToolbar } from "@/pages/editor/components/organisms/EditorToolbar";
import { ErrorToast } from "@/pages/editor/components/molecules/ErrorToast";
import { Inspector } from "@/pages/editor/components/organisms/Inspector";
import { LayersPanel } from "@/pages/editor/components/organisms/LayersPanel";
import { RecoveryDialog } from "@/pages/editor/components/organisms/RecoveryDialog";
import { resolveDocumentLayout } from "@/document/layout.ts";
import { useCanvasInteraction } from "@/pages/editor/hooks/useCanvasInteraction";
import { useEditorActions } from "@/pages/editor/hooks/useEditorActions";
import { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import "@/App.css";

function EditorPage() {
  const session = useEditorDocument();
  const interaction = useCanvasInteraction(session);
  const actions = useEditorActions(session);
  const { history, design, selectedId, selectedIds, selected, error, setError, filePath, isBusy, isDirty,
    recoveryStatus, restoreRecovery, discardRecovery, openFile, saveFile } = session;
  const { drag, pathDrag, zoom, zoomBy, viewportRef, drawTool, setDrawTool, drawing, pen, selection, guides,
    startDrag, startResize, continueDrag, finishDrag, stepHistory, startPan, continuePan, finishPan,
    onWorldPointerDown, updateDrawing, finishDrawing, cancelDrawing, updatePenCursor, finishPen,
    startPathPointDrag, continuePathPointDrag, finishPathPointDrag, cancelPathPointDrag,
    updateSelection, finishSelection, cancelSelection } = interaction;

  return <main className="app-shell">
    <EditorToolbar fileName={filePath?.split(/[\\/]/).pop() ?? "無題のドキュメント"} filePath={filePath}
      canUndo={history.past.length > 0 && !drag.current && !pathDrag.current} canRedo={history.future.length > 0 && !drag.current && !pathDrag.current}
      isBusy={isBusy} onUndo={() => stepHistory("undo")} onRedo={() => stepHistory("redo")}
       onOpen={openFile} onSave={saveFile} onCreate={actions.create} onImportImage={actions.importImage} onImportSvg={actions.importSvg}
      drawTool={drawTool} onDrawToolChange={setDrawTool} />

    <div className="workspace">
      <LayersPanel nodes={design.children} selectedId={selectedId} selectedIds={selectedIds}
        onSelect={actions.selectLayer} onReorder={actions.reorderLayer} />
      <Canvas design={resolveDocumentLayout(design)} selectedId={selectedId} selectedIds={selectedIds} zoom={zoom} onZoom={zoomBy} viewportRef={viewportRef}
        drawTool={drawTool} drawing={drawing} pen={pen} selection={selection} guides={guides}
        onNodePointerDown={startDrag} onResizePointerDown={startResize} onNodePointerMove={continueDrag} onNodePointerUp={finishDrag}
        onPathPointPointerDown={startPathPointDrag} onPathPointPointerMove={continuePathPointDrag}
        onPathPointPointerUp={finishPathPointDrag} onPathPointPointerCancel={cancelPathPointDrag}
        onPanPointerDown={startPan} onPanPointerMove={continuePan} onPanPointerUp={finishPan}
        onWorldPointerDown={onWorldPointerDown} onWorldDoubleClick={() => finishPen(false)}
        onWorldPointerMove={(event) => { updateDrawing(event); updatePenCursor(event); updateSelection(event); }}
        onWorldPointerUp={(event) => { finishDrawing(event); finishSelection(event); }}
        onWorldPointerCancel={(pointerId) => { cancelDrawing(pointerId); cancelSelection(pointerId); }}
        onImageError={(id) => setError(`画像を表示できません: ${id}`)} />
      <Inspector selected={selected} selectedCount={selectedIds.length} {...actions.inspector} />
    </div>

    <EditorStatus selected={selected} isDirty={isDirty} filePath={filePath} />
    {error && <ErrorToast message={error} onClose={() => setError(null)} />}
    {recoveryStatus.kind !== "none" && <RecoveryDialog status={recoveryStatus} onRestore={restoreRecovery}
      onDiscard={() => { void discardRecovery(); }} />}
  </main>;
}

export default EditorPage;
