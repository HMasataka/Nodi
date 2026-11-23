// 確認のダイアログに出す内容。共通のダイアログ部品で、取り消す操作と主となる操作の2つを並べる。
export type ConfirmationRequest = {
  title: string;
  body: string;
  path?: string;
  cancelLabel: string;
  confirmLabel: string;
};

// 未保存の変更があるときに、別のドキュメントを開こうとした。
export const UNSAVED_OPEN_CONFIRMATION: ConfirmationRequest = {
  title: "未保存の変更があります",
  body: "別のドキュメントを開くと、保存していない変更は失われます。",
  cancelLabel: "キャンセル",
  confirmLabel: "破棄して開く",
};

// 未保存の変更があるときに、開いているファイルが外部で書き換わった。
export function externalChangeConfirmation(path: string): ConfirmationRequest {
  return {
    title: "ファイルが外部で更新されました",
    body: "再読み込みすると、保存していない変更は破棄されます。",
    path,
    cancelLabel: "今の内容を残す",
    confirmLabel: "再読み込み",
  };
}
