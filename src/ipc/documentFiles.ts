import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { DocumentFileAccess } from "../document/persistence.ts";

const nodiFilter = { name: "Nodi ドキュメント", extensions: ["nodi"] };

export const documentFiles: DocumentFileAccess = {
  pickOpen: () => open({ multiple: false, directory: false, filters: [nodiFilter] }),
  pickSave: (defaultPath) => save({ defaultPath, filters: [nodiFilter] }),
  read: (path) => invoke<string>("read_document", { path }),
  write: (path, contents) => invoke<void>("write_document", { path, contents }),
};
