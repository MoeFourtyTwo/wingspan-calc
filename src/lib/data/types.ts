/** Card sets / expansions. `asia` = Wingspan Asia (standalone, can be mixed in). */
export const SETS = ['core', 'european', 'oceania', 'asia', 'americas'] as const;
export type CardSet = (typeof SETS)[number];

/** Language of goal texts. */
export type Lang = 'en' | 'de';

export interface GoalSide {
    en: string;
    de: string;
    /** The Oceania "No goal" side: nobody scores this round. */
    noGoal?: true;
}

/** A double-sided round goal tile. */
export interface GoalTile {
    id: string;
    set: CardSet;
    sides: readonly [GoalSide, GoalSide];
}
