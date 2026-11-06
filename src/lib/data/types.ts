/** Card sets / expansions. `asia` = Wingspan Asia (standalone, can be mixed in). */
export const SETS = ['core', 'european', 'oceania', 'asia', 'americas'] as const;
export type CardSet = (typeof SETS)[number];

/** Which printed edition the cards on the table come from. */
export type Edition = 'en' | 'de';

/** Text per edition; `de: null` means no German text is known yet. */
export interface Localized {
    en: string;
    de: string | null;
}

export interface BonusCard {
    id: number;
    set: CardSet;
    /** Marked as usable in solo games against the Automa. */
    automa: boolean;
    name: Localized;
    condition: Localized;
    /** Scoring, e.g. "2 to 3 birds: 3[point]; 4+ birds: 7[point]". */
    vp: Localized;
}

export interface GoalSide {
    en: string;
    de: string;
}

/** A double-sided round goal tile. */
export interface GoalTile {
    id: string;
    set: CardSet;
    sides: readonly [GoalSide, GoalSide];
}
