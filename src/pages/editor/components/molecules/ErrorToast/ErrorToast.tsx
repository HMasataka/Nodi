import { Icon } from "@/pages/editor/components/atoms/Icon";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";

// エラーを知らせるトースト。キャンバスの右下の角に付け、暗い地でキャンバスと区別する。
export function ErrorToast({ message, onClose }: { message: string; onClose(): void }) {
  return <div className="error-toast" role="alert">
    <Icon name="alert" className="error-toast-icon" />
    <p className="error-toast-message">{message}</p>
    <IconButton icon="close" label="閉じる" className="error-toast-close" onClick={onClose} />
  </div>;
}
