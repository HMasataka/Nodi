import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const DOCUMENT_CHANGED_EVENT = "nodi:document-changed";

export const documentWatch = {
  start: (path: string) => invoke<void>("start_watch", { path }),
  stop: () => invoke<void>("stop_watch"),
  onChange: (handler: () => void): Promise<UnlistenFn> => listen(DOCUMENT_CHANGED_EVENT, () => handler()),
};
