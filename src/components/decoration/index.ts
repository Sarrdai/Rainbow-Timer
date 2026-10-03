import { DARK_CORNERS, LIGHT_CORNERS } from './corners';
import { DARK_GARLANDS, LIGHT_GARLANDS } from './garlands';
import type { DecoTheme, DecoVariant } from './kit';

export type { DecoLayout, DecoTheme, DecoVariant } from './kit';

/** Decoration variants per theme: each party picks one garland and one corner decoration at random */
export const DECO_SETS: Record<DecoTheme, { garlands: DecoVariant[]; corners: DecoVariant[] }> = {
    light: { garlands: LIGHT_GARLANDS, corners: LIGHT_CORNERS },
    dark: { garlands: DARK_GARLANDS, corners: DARK_CORNERS },
};
