import { createContext, useContext } from "react";

import type { Color } from "@/document/types.ts";

export type ColorResolver = (color: Color) => string;

/** 文書のパレットを元に色参照を解決する関数を提供する。既定では HEX をそのまま返す。 */
export const ColorResolverContext = createContext<ColorResolver>((color) => (typeof color === "string" ? color : "#000000"));

export function useColorResolver(): ColorResolver {
  return useContext(ColorResolverContext);
}
