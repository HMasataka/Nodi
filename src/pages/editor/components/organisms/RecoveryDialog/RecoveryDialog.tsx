import type { RecoveryStatus } from "@/pages/editor/types";

export function RecoveryDialog({ status, onRestore, onDiscard }: { status: Exclude<RecoveryStatus, { kind: "none" }>; onRestore(): void; onDiscard(): void }) {
  return <div className="recovery-scrim">
    <section className="recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
      <span className="recovery-eyebrow">DOCUMENT / RECOVERY</span>
      <h2 id="recovery-title">{status.kind === "checking" ? "作業内容を確認中" : status.kind === "error" ? "復元データを読み取れません" : "未保存の編集が見つかりました"}</h2>
      {status.kind === "available" && <>
        <p>前回の異常終了時に残った編集内容です。復元しても元のファイルは上書きされません。保存時に新しい保存先を選べます。</p>
        {status.draft.sourcePath && <code className="recovery-path">元のファイル: {status.draft.sourcePath}</code>}
        <div className="recovery-actions">
          <button type="button" className="add-button" onClick={onRestore}>編集を復元</button>
          <button type="button" className="file-button" onClick={onDiscard}>破棄して開始</button>
        </div>
      </>}
      {status.kind === "error" && <>
        <p role="alert">{status.message}</p>
        <p>復元データを破棄すると、新しい空のドキュメントから開始します。</p>
        <div className="recovery-actions"><button type="button" className="file-button" onClick={onDiscard}>破棄して開始</button></div>
      </>}
      {status.kind === "checking" && <p>前回の編集内容を探しています…</p>}
    </section>
  </div>;
}
