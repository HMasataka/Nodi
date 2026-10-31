import { invoke } from "@tauri-apps/api/core";
import type { RecoveryFileAccess } from "@/persistence/recovery.ts";

export const recoveryFiles: RecoveryFileAccess = {
  read: () => invoke<string | null>("read_recovery"),
  write: (contents) => invoke<void>("write_recovery", { contents }),
  clear: () => invoke<void>("clear_recovery"),
};
