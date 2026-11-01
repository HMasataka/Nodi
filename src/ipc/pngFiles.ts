import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import type { PngFileAccess } from "@/export/savePng.ts";

export const pngFiles: PngFileAccess = {
  pickSave: (defaultPath) => save({ defaultPath, filters: [{ name: "PNG 画像", extensions: ["png"] }] }),
  write: (path, bytes) => invoke<void>("write_png", { path, bytes: Array.from(bytes) }),
};
