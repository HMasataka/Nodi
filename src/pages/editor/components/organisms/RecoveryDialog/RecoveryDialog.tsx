import { Dialog } from "@/pages/editor/components/molecules/Dialog";
import type { RecoveryStatus } from "@/pages/editor/types";

export function RecoveryDialog({ status, onRestore, onDiscard }: { status: Exclude<RecoveryStatus, { kind: "none" }>; onRestore(): void; onDiscard(): void }) {
  if (status.kind === "checking") return <Dialog title="作業内容を確認中"><p>前回の編集内容を探しています…</p></Dialog>;
  if (status.kind === "error") {
    return <Dialog title="復元データを読み取れません" primary={{ label: "破棄して開始", onSelect: onDiscard }}>
      <p role="alert">{status.message}</p>
      <p>破棄すると、新しい空のドキュメントから始めます。</p>
    </Dialog>;
  }
  return <Dialog title="未保存の編集が見つかりました" path={status.draft.sourcePath ? `元のファイル: ${status.draft.sourcePath}` : undefined}
    cancel={{ label: "破棄して開始", onSelect: onDiscard }} primary={{ label: "編集を復元", onSelect: onRestore }}>
    <p>前回の異常終了時に残った編集内容です。復元しても元のファイルは上書きされず、保存するときに保存先を選べます。</p>
  </Dialog>;
}
