import { Result } from "@praha/byethrow";
import { useCallback, useState } from "react";

import { Canvas } from "@/pages/editor/components/organisms/Canvas";
import { countRenderedTextLines } from "@/pages/editor/textIconMeasurement.ts";
import { ErrorToast } from "@/pages/editor/components/molecules/ErrorToast";
import { findNode } from "@/document/commands/index.ts";
import { Inspector } from "@/pages/editor/components/organisms/Inspector";
import { LayersPanel } from "@/pages/editor/components/organisms/LayersPanel";
import { measureNode } from "@/rendering/measure.ts";
import { PreviewStage } from "@/pages/editor/components/organisms/PreviewStage";
import { RecoveryDialog } from "@/pages/editor/components/organisms/RecoveryDialog";
import { resolveColor } from "@/document/colorRef.ts";
import { resolveDocumentInstances } from "@/document/instances.ts";
import { resolveDocumentLayout } from "@/document/layout.ts";
import { spacingTokenUsage } from "@/document/spacing.ts";
import { Timeline } from "@/pages/editor/components/organisms/Timeline";
import { useCanvasInteraction } from "@/pages/editor/hooks/useCanvasInteraction";
import { useEditorActions } from "@/pages/editor/hooks/useEditorActions";
import { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { useEditorShortcuts } from "@/pages/editor/hooks/useEditorShortcuts";
import { usePanelLayout } from "@/pages/editor/hooks/usePanelLayout";
import { usePlayback } from "@/pages/editor/hooks/usePlayback";
import { activeAnimationTriggers, applyAnimations, applyScrollAnimations } from "@/document/animation.ts";
import type { Color, DocumentNode } from "@/document/types.ts";
import { ColorResolverContext, PaletteContext } from "@/pages/editor/colorContext.ts";
import { measureSelectionSpacing, measureTextIconAlignment } from "@/document/commands/index.ts";
import "@/App.css";

import { ActionChip } from "@/pages/editor/components/molecules/ActionChip";
import { AssetsPanel } from "@/pages/editor/components/organisms/AssetsPanel";
import { Dialog } from "@/pages/editor/components/molecules/Dialog";
import { FileChip } from "@/pages/editor/components/molecules/FileChip";
import { FloatingTools } from "@/pages/editor/components/molecules/FloatingTools";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";
import { workspaceColumns } from "@/pages/editor/panelLayout.ts";

type LeftPanelTab = "layers" | "assets";
const LEFT_PANEL_TABS: { value: LeftPanelTab; label: string }[] = [{ value: "layers", label: "レイヤー" }, { value: "assets", label: "アセット" }];

// 拡大・縮小のショートカット1回分の倍率。
const ZOOM_STEP = 1.25;

function EditorPage() {
  const session = useEditorDocument();
  const interaction = useCanvasInteraction(session);
  const playback = usePlayback();
  const panels = usePanelLayout();
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("layers");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [clickedIds, setClickedIds] = useState<ReadonlySet<string>>(new Set());
  const [scrollProgress, setScrollProgress] = useState(0);
  // タイムラインで開いているアニメーション。プロパティのアニメーションの行からも切り換える。
  const [activeAnimationId, setActiveAnimationId] = useState<string | null>(null);
  // プレビュー中か。選択がフレームでなくなったら（元に戻すなどで）プレビューを終える。
  const [previewing, setPreviewing] = useState(false);
  const closePreview = useCallback(() => setPreviewing(false), []);
  const actions = useEditorActions(session, { playhead: playback.playhead, scrollProgress });
  const interactionState = { hoveredIds: new Set(hoveredId ? [hoveredId] : []), clickedIds };
  const resolveTriggers = (node: DocumentNode) => activeAnimationTriggers(node, interactionState);
  const { history, design, selectedId, selectedIds, selected, error, setError, filePath, isBusy, isDirty,
    confirmation, recoveryStatus, restoreRecovery, discardRecovery, openFile, saveFile } = session;
  const spacingUsages = Object.fromEntries(design.spacing.map((token) => [token.id, spacingTokenUsage(design, token.id)]));
  const fileName = filePath?.split(/[\\/]/).pop() ?? "無題のドキュメント";
  const previewFrame = previewing && selected?.type === "frame" ? selected : null;
  const selectedComponentName = selected?.type === "instance" ? design.components.find((component) => component.id === selected.componentRef)?.name : undefined;
  const selectedComponentNode = selected?.type === "instance" ? design.components.find((component) => component.id === selected.componentRef)?.node : undefined;
  const spacingX = selectedIds.length >= 3 ? measureSelectionSpacing(design, selectedIds, "x") : null;
  const spacingY = selectedIds.length >= 3 ? measureSelectionSpacing(design, selectedIds, "y") : null;
  const spacing = spacingX && spacingY ? Result.isFailure(spacingX) ? { error: spacingX.error.message }
    : Result.isFailure(spacingY) ? { error: spacingY.error.message }
      : { x: spacingX.value, y: spacingY.value } : undefined;
  const textIconResult = selectedIds.length === 2 && selectedIds.some((id) => findNode(design, id)?.type === "text")
    ? measureTextIconAlignment(design, selectedIds, countRenderedTextLines) : null;
  const textIcon = textIconResult ? Result.isFailure(textIconResult) ? { error: textIconResult.error.message }
    : { measurement: textIconResult.value } : undefined;
  const { drag, pathDrag, camera, zoom, zoomBy, zoomTo, fitAll, viewportRef, drawTool, setDrawTool, drawing, pen, selection, guides, selectedPathPoint,
    startDrag, startResize, continueDrag, finishDrag, stepHistory, startPan, continuePan, finishPan,
    onWorldPointerDown, updateDrawing, finishDrawing, cancelDrawing, updatePenCursor, finishPen,
    startPathPointDrag, continuePathPointDrag, finishPathPointDrag, cancelPathPointDrag,
    updateSelection, finishSelection, cancelSelection } = interaction;
  const canUndo = history.past.length > 0 && !drag.current && !pathDrag.current;
  const canRedo = history.future.length > 0 && !drag.current && !pathDrag.current;
  useEditorShortcuts({
    save: () => { void saveFile(); },
    open: () => { void openFile(); },
    undo: () => stepHistory("undo"),
    redo: () => stepHistory("redo"),
    tool: ({ tool }) => setDrawTool(tool),
    delete: actions.edit.deleteSelected,
    duplicate: () => { actions.edit.duplicateSelected(); },
    selectAll: actions.edit.selectAll,
    // 作成ツールを選んでいるときは選択ツールに戻し、選択ツールのときは選択を外す。
    deselect: () => {
      if (drawTool !== "select") { setDrawTool("select"); return true; }
      return actions.edit.clearSelection();
    },
    nudge: ({ dx, dy }) => drag.current || pathDrag.current ? true : actions.edit.nudgeSelected(dx, dy),
    reorder: ({ direction }) => { if (selectedId) actions.reorderLayer(selectedId, direction); },
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    zoomReset: () => zoomTo(1),
    zoomFit: fitAll,
    togglePanel: ({ panel }) => panels.toggle(panel),
  });

  return <ColorResolverContext.Provider value={(color: Color) => resolveColor(color, design.palette)}>
    <PaletteContext.Provider value={design.palette}>
    <main className="app-shell">
    <div className="workspace" style={{ gridTemplateColumns: workspaceColumns(panels.layout) }}>
      {panels.layout.left && <div className="left-panels">
        <div className="left-panel-tabs">
          <Segmented<LeftPanelTab> label="左パネル" value={leftTab} onChange={setLeftTab} options={LEFT_PANEL_TABS} />
        </div>
        {leftTab === "layers"
          ? <LayersPanel nodes={design.children} selectedId={selectedId} selectedIds={selectedIds}
            onSelect={actions.selectLayer} onReorder={actions.reorderLayer} />
          : <AssetsPanel components={design.components} highlightedComponentId={selected?.type === "instance" ? selected.componentRef : null}
            onPlaceInstance={actions.components.onPlaceInstance} onRenameComponent={actions.components.onRename}
            onDuplicateComponent={actions.components.onDuplicate} onRemoveComponent={actions.components.onRemove}
            palette={design.palette} onCreatePalette={actions.palette.onCreate} onImportPalette={actions.palette.onImport}
            onRenamePalette={actions.palette.onRename} onRecolorPalette={actions.palette.onRecolor}
            onDuplicatePalette={actions.palette.onDuplicate} onDeletePalette={actions.palette.onDelete}
            spacing={design.spacing} spacingUsages={spacingUsages}
            onCreateSpacing={actions.spacingTokens.onCreate} onRenameSpacing={actions.spacingTokens.onRename}
            onSetSpacing={actions.spacingTokens.onValue} onRemoveSpacing={actions.spacingTokens.onRemove} />}
      </div>}
      <div className="editor-center">
        <div className="canvas-stage">
          <Canvas design={applyScrollAnimations(applyAnimations(resolveDocumentLayout(resolveDocumentInstances(design), { measure: measureNode }), playback.playhead, resolveTriggers), scrollProgress)} selectedId={selectedId} selectedIds={selectedIds} spacing={spacing} textIcon={textIcon} zoom={zoom} viewportRef={viewportRef}
            drawTool={drawTool} drawing={drawing} pen={pen} selectedPathPoint={selectedPathPoint} selection={selection} guides={guides} camera={camera}
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
          <FileChip fileName={fileName} filePath={filePath} isDirty={isDirty} isBusy={isBusy} canUndo={canUndo} canRedo={canRedo}
            leftPanelOpen={panels.layout.left} onToggleLeftPanel={() => panels.toggle("left")}
            onOpen={() => { void openFile(); }} onSave={() => { void saveFile(); }} onImportSvg={actions.importSvg}
            onUndo={() => stepHistory("undo")} onRedo={() => stepHistory("redo")} />
          {previewFrame && <PreviewStage frame={previewFrame} spacing={design.spacing} onClose={closePreview} />}
          <ActionChip zoom={zoom} rightPanelOpen={panels.layout.right} onToggleRightPanel={() => panels.toggle("right")}
            previewing={!!previewFrame} canPreview={selected?.type === "frame"} onTogglePreview={() => setPreviewing(!previewFrame)} />
          {!previewFrame && <FloatingTools drawTool={drawTool} onDrawToolChange={setDrawTool} onImportImage={actions.importImage}
            timelineOpen={panels.layout.timeline} onToggleTimeline={() => panels.toggle("timeline")} />}
          {error && <ErrorToast message={error} onClose={() => setError(null)} />}
        </div>
        {panels.layout.timeline && <Timeline node={selected} playback={playback} scrollProgress={scrollProgress} onScrollProgress={setScrollProgress} {...actions.timeline}
          activeAnimationId={activeAnimationId} onSelectAnimation={setActiveAnimationId} onClose={() => panels.toggle("timeline")} />}
      </div>
      {panels.layout.right && <Inspector selected={selected} selectedCount={selectedIds.length} spacing={spacing} textIcon={textIcon} spacingTokens={design.spacing}
        {...actions.inspector}
        componentName={selectedComponentName} componentNode={selectedComponentNode}
        onCreateComponent={actions.components.onCreateFromSelected}
        onCopyId={(id) => { navigator.clipboard.writeText(id).catch(() => setError("ID をクリップボードにコピーできません")); }}
        onGoToDefinition={() => { setLeftTab("assets"); if (!panels.layout.left) panels.toggle("left"); }}
        onSetOverride={(childId, patch) => { if (selectedId) actions.components.onSetOverride(selectedId, childId, patch); }}
        onResetOverride={(childId) => { if (selectedId) actions.components.onResetOverride(selectedId, childId); }}
        onDetach={() => actions.components.onDetach()} />}
    </div>
    {confirmation && <Dialog title={confirmation.title} path={confirmation.path}
      cancel={{ label: confirmation.cancelLabel, onSelect: () => confirmation.resolve(false) }}
      primary={{ label: confirmation.confirmLabel, onSelect: () => confirmation.resolve(true) }}>
      <p>{confirmation.body}</p>
    </Dialog>}
    {recoveryStatus.kind !== "none" && <RecoveryDialog status={recoveryStatus} onRestore={restoreRecovery}
      onDiscard={() => { void discardRecovery(); }} />}
    </main>
    </PaletteContext.Provider>
  </ColorResolverContext.Provider>;
}

export default EditorPage;
