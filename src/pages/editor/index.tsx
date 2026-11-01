import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";
import {
  deleteNode,
  duplicateNode,
  setFrameStyle,
  setNodeGeometry,
  setNodeStyle,
  setTextContent,
  setTextStyle,
} from "@/document/commands/index.ts";
import { readImageFile } from "@/ipc/imageFiles";
import { pngFiles } from "@/ipc/pngFiles";
import { renderFramePng } from "@/export/framePng";
import { savePng } from "@/export/savePng";
import { Canvas } from "@/pages/editor/components/organisms/Canvas";
import { Inspector } from "@/pages/editor/components/organisms/Inspector";
import { LayersPanel } from "@/pages/editor/components/organisms/LayersPanel";
import { useCanvasInteraction } from "@/pages/editor/hooks/useCanvasInteraction";
import { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import "@/App.css";

function EditorPage() {
  const session = useEditorDocument();
  const {
    history, design, designRef, selectedId, setSelectedId, selected,
    error, setError, filePath, isBusy, isDirty, agentApi, recoveryStatus, restoreRecovery, discardRecovery,
    recordDocument, applyDocument, openFile, saveFile,
  } = session;
  const {
    drag, zoom, setZoom, viewportRef, drawTool, setDrawTool, drawing,
    startDrag, startResize, continueDrag, finishDrag, stepHistory,
    startPan, continuePan, finishPan,
    onWorldPointerDown, updateDrawing, finishDrawing, cancelDrawing,
  } = useCanvasInteraction(session);
  const imageInput = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const exporting = useRef(false);

  function addRectangle() {
    const index = designRef.current.children.length;
    const parentId = selected?.type === "frame" ? selected.id : undefined;
    const result = agentApi.add({
      type: "rectangle",
      parentId,
      x: parentId ? 24 : 80 + (index % 8) * 28,
      y: parentId ? 50 : 80 + (index % 8) * 28,
      width: 184,
      height: 112,
    });
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setSelectedId(result.value.id);
  }

  function addEllipse() {
    const index = designRef.current.children.length;
    const parentId = selected?.type === "frame" ? selected.id : undefined;
    const result = agentApi.add({
      type: "ellipse", parentId,
      x: parentId ? 24 : 80 + (index % 8) * 28,
      y: parentId ? 50 : 80 + (index % 8) * 28,
      width: 112, height: 112,
    });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  function addFrame() {
    const index = designRef.current.children.length;
    const result = agentApi.add({
      type: "frame", x: 80 + (index % 6) * 28, y: 80 + (index % 6) * 28,
      width: 360, height: 260,
    });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  function addText() {
    const index = designRef.current.children.length;
    const parentId = selected?.type === "frame" ? selected.id : undefined;
    const result = agentApi.add({
      type: "text", parentId, content: "テキスト",
      x: parentId ? 24 : 80 + (index % 8) * 28,
      y: parentId ? 50 : 80 + (index % 8) * 28,
      width: 220, height: 48,
    });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  async function importImage(file: File) {
    const parentId = selected?.type === "frame" ? selected.id : undefined;
    const imported = await readImageFile(file);
    if (Result.isFailure(imported)) { setError(imported.error.message); return; }
    const index = designRef.current.children.length;
    const result = agentApi.add({
      type: "image", source: imported.value, name: file.name.replace(/\.[^.]+$/, "") || "画像",
      parentId, x: parentId ? 24 : 80 + (index % 8) * 28,
      y: parentId ? 50 : 80 + (index % 8) * 28, width: 240, height: 160,
    });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const result = deleteNode(designRef.current, selectedId);
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    recordDocument(result.value);
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    const result = duplicateNode(designRef.current, selectedId);
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
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

  const fileName = filePath?.split(/[\\/]/).pop() ?? "無題のドキュメント";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Nodi</span>
          <span className="brand-divider" />{" "}
          <span className="document-title" title={filePath ?? undefined}>{fileName}</span>
        </div>
        <span className="topbar-note">DOCUMENT / 001</span>
        <div className="history-controls" aria-label="編集履歴">
          <button className="file-button" type="button" onClick={() => stepHistory("undo")} disabled={history.past.length === 0 || !!drag.current} title="元に戻す (⌘/Ctrl+Z)">元に戻す</button>
          <button className="file-button" type="button" onClick={() => stepHistory("redo")} disabled={history.future.length === 0 || !!drag.current} title="やり直す (⌘/Ctrl+Shift+Z)">やり直す</button>
        </div>
        <button className="file-button" type="button" onClick={openFile} disabled={isBusy}>開く</button>
        <button className="file-button" type="button" onClick={saveFile} disabled={isBusy}>保存</button>
        <button className="add-button" type="button" onClick={addRectangle}>
          <span aria-hidden="true">＋</span> 矩形を追加
        </button>
        <button className="file-button" type="button" onClick={addEllipse}>楕円を追加</button>
        <div className="drawing-tools" aria-label="描画ツール">
          <button type="button" aria-pressed={drawTool === "rectangle"} onClick={() => setDrawTool(drawTool === "rectangle" ? "select" : "rectangle")}>矩形を描く</button>
          <button type="button" aria-pressed={drawTool === "ellipse"} onClick={() => setDrawTool(drawTool === "ellipse" ? "select" : "ellipse")}>楕円を描く</button>
        </div>
        <button className="file-button" type="button" onClick={addFrame}>フレームを追加</button>
        <button className="file-button" type="button" onClick={addText}>テキストを追加</button>
        <button className="file-button" type="button" onClick={() => imageInput.current?.click()}>画像を追加</button>
        <input ref={imageInput} className="image-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
          aria-label="画像ファイル" onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (file) void importImage(file).finally(() => { input.value = ""; });
          }} />
      </header>

      <div className="workspace">
        <LayersPanel nodes={design.children} selectedId={selectedId} onSelect={setSelectedId} />

        <Canvas
          design={design} selectedId={selectedId} zoom={zoom} setZoom={setZoom} viewportRef={viewportRef}
          drawTool={drawTool} drawing={drawing}
          onNodePointerDown={startDrag} onResizePointerDown={startResize}
          onNodePointerMove={continueDrag} onNodePointerUp={finishDrag}
          onPanPointerDown={startPan} onPanPointerMove={continuePan} onPanPointerUp={finishPan}
          onWorldPointerDown={onWorldPointerDown}
          onWorldPointerMove={updateDrawing} onWorldPointerUp={finishDrawing}
          onWorldPointerCancel={cancelDrawing}
          onImageError={(id) => setError(`画像を表示できません: ${id}`)}
        />

        <Inspector
          selected={selected}
          onRename={(name) => {
            if (!selected) return;
            const result = agentApi.rename(selected.id, name);
            if (Result.isFailure(result)) setError(result.error.message);
          }}
          onGeometry={(geometry) => { if (selected) applyDocument(setNodeGeometry(designRef.current, selected.id, geometry)); }}
          onTextContent={(content) => { if (selected) applyDocument(setTextContent(designRef.current, selected.id, content)); }}
          onTextStyle={(style) => { if (selected) applyDocument(setTextStyle(designRef.current, selected.id, style)); }}
          onShapeStyle={(style) => { if (selected) applyDocument(setNodeStyle(designRef.current, selected.id, style)); }}
          onFrameStyle={(style) => { if (selected) applyDocument(setFrameStyle(designRef.current, selected.id, style)); }}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onExportFrame={() => { void exportSelectedFrame(); }}
          isExporting={isExporting}
        />
      </div>

      <footer className="statusbar">
        <span>
          <span className={`status-dot${isDirty ? " is-dirty" : ""}`} /> {isDirty ? "未保存の変更" : filePath ? "保存済み" : "変更なし"}
        </span>
        <span>
          {selected
            ? `${selected.name} · ${selected.id}`
            : "要素が選択されていません"}
        </span>
      </footer>
      {error && (
        <div className="error-toast" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
      {recoveryStatus.kind !== "none" && (
        <div className="recovery-scrim">
          <section className="recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
            <span className="recovery-eyebrow">DOCUMENT / RECOVERY</span>
            <h2 id="recovery-title">{recoveryStatus.kind === "checking" ? "作業内容を確認中" : recoveryStatus.kind === "error" ? "復元データを読み取れません" : "未保存の編集が見つかりました"}</h2>
            {recoveryStatus.kind === "available" && (
              <>
                <p>前回の異常終了時に残った編集内容です。復元しても元のファイルは上書きされません。保存時に新しい保存先を選べます。</p>
                {recoveryStatus.draft.sourcePath && <code className="recovery-path">元のファイル: {recoveryStatus.draft.sourcePath}</code>}
                <div className="recovery-actions">
                  <button type="button" className="add-button" onClick={restoreRecovery}>編集を復元</button>
                  <button type="button" className="file-button" onClick={() => { void discardRecovery(); }}>破棄して開始</button>
                </div>
              </>
            )}
            {recoveryStatus.kind === "error" && (
              <>
                <p role="alert">{recoveryStatus.message}</p>
                <p>復元データを破棄すると、新しい空のドキュメントから開始します。</p>
                <div className="recovery-actions"><button type="button" className="file-button" onClick={() => { void discardRecovery(); }}>破棄して開始</button></div>
              </>
            )}
            {recoveryStatus.kind === "checking" && <p>前回の編集内容を探しています…</p>}
          </section>
        </div>
      )}
    </main>
  );
}

export default EditorPage;
