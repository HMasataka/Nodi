import { createContext, useContext } from "react";

import type { Color, PaletteColor } from "@/document/types.ts";

export type ColorResolver = (color: Color) => string;

/** 文書のパレットを元に色参照を解決する関数を提供する。既定では HEX をそのまま返す。 */
export const ColorResolverContext = createContext<ColorResolver>((color) => (typeof color === "string" ? color : "#000000"));

export function useColorResolver(): ColorResolver {
  return useContext(ColorResolverContext);
}

/** 現在の文書のパレット一覧を提供する。既定は空。 */
export const PaletteContext = createContext<readonly PaletteColor[]>([]);

export function usePalette(): readonly PaletteColor[] {
  return useContext(PaletteContext);
}
