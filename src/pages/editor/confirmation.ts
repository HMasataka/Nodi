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
