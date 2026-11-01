export function ErrorToast({ message, onClose }: { message: string; onClose(): void }) {
  return <div className="error-toast" role="alert">
    {message}
    <button type="button" onClick={onClose} aria-label="閉じる">×</button>
  </div>;
}
