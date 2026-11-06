/**
 * Glue between a drawn setup (tile objects) and the id-based record stored in
 * the game, plus small pure helpers for the setup helper screen.
 */
import { GOAL_TILES } from '../data/goalTiles';
import { renderTokens } from '../data/tokens';
import { SETS, type CardSet, type Lang } from '../data/types';
import { ROUND_COUNT, type DrawnGoal, type SetupDraw } from './setupDraw';

/** Structural copy of the store's SetupRecord, so this module stays store-agnostic. */
export interface SetupRecordLike {
    goals: { tileId: string; side: 0 | 1 }[];
}

export function toRecord(draw: SetupDraw): SetupRecordLike {
    return { goals: draw.goals.map(g => ({ tileId: g.tile.id, side: g.side })) };
}

/** Rebuild a draw from a stored record; null if it does not fit (caller draws again). */
export function fromRecord(record: SetupRecordLike | null): SetupDraw | null {
    if (!record || record.goals.length !== ROUND_COUNT) return null;
    const goals: DrawnGoal[] = [];
    for (const g of record.goals) {
        const tile = GOAL_TILES.find(t => t.id === g.tileId);
        if (!tile) return null;
        goals.push({ tile, side: g.side === 1 ? 1 : 0 });
    }
    return { goals };
}

/** Turn one goal tile over. */
export function flipGoal(draw: SetupDraw, round: number): SetupDraw {
    return { goals: draw.goals.map((g, i) => (i === round ? { ...g, side: (1 - g.side) as 0 | 1 } : g)) };
}

/** Add the expansions the game options already say are in play (Oceania, Americas). */
export function withGameOptions(sets: readonly CardSet[], options: { oceania: boolean; americas: boolean }): CardSet[] {
    const out = new Set(sets);
    if (options.oceania) out.add('oceania');
    if (options.americas) out.add('americas');
    return SETS.filter(s => out.has(s));
}

/** Toggle a set; the last remaining set cannot be removed. */
export function toggleSet(sets: readonly CardSet[], set: CardSet): CardSet[] {
    const next = sets.includes(set) ? sets.filter(s => s !== set) : [...sets, set];
    return next.length ? SETS.filter(s => next.includes(s)) : [...sets];
}

/** Readable face-up goal text for one drawn goal. */
export function goalText(goal: DrawnGoal, lang: Lang): string {
    return renderTokens(goal.tile.sides[goal.side][lang], lang);
}

/** Face-up goal text per round, e.g. ["Birds in forest", ...]; null if not drawn. */
export function goalCaptions(record: SetupRecordLike | null, lang: Lang): (string | null)[] {
    return Array.from({ length: ROUND_COUNT }, (_, i) => {
        const g = record?.goals[i];
        const tile = g && GOAL_TILES.find(t => t.id === g.tileId);
        return tile ? goalText({ tile, side: g.side }, lang) : null;
    });
}
