import { createContext, useContext } from "react";

import type { PaletteColor } from "@/document/types.ts";
import { createColorResolver, type ThemedColorResolver } from "@/document/colorRef.ts";

export type ColorResolver = ThemedColorResolver;

/** 文書のパレットを元に色参照を解決する関数を提供する。既定では HEX をそのまま返す。 */
export const ColorResolverContext = createContext<ColorResolver>(createColorResolver([]));

export function useColorResolver(): ColorResolver {
  return useContext(ColorResolverContext);
}

/** 現在の文書のパレット一覧を提供する。既定は空。 */
export const PaletteContext = createContext<readonly PaletteColor[]>([]);

export function usePalette(): readonly PaletteColor[] {
  return useContext(PaletteContext);
}
