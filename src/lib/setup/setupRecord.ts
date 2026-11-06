/**
 * Glue between a drawn setup (full card objects) and the id-based
 * {@link SetupRecord} stored in the game, plus small pure helpers for the
 * setup helper screen.
 */
import { BONUS_CARDS } from '../data/bonusCards';
import { GOAL_TILES } from '../data/goalTiles';
import { renderTokens } from '../data/tokens';
import { SETS, type CardSet, type Edition } from '../data/types';
import { BONUS_CARDS_PER_PLAYER, ROUND_COUNT, type DrawnGoal, type SetupDraw } from './setupDraw';

/** Structural subset of the game store types, so this module stays store-agnostic. */
interface PlayerLike {
    id: string;
}
export interface SetupRecordLike {
    goals: { tileId: string; side: 0 | 1 }[];
    bonus: Record<string, number[]>;
}

/** Store a draw by ids. `players[i]` received `draw.bonus[i]`. */
export function toRecord(draw: SetupDraw, players: readonly PlayerLike[]): SetupRecordLike {
    return {
        goals: draw.goals.map(g => ({ tileId: g.tile.id, side: g.side })),
        bonus: Object.fromEntries(players.map((p, i) => [p.id, (draw.bonus[i] ?? []).map(c => c.id)])),
    };
}

/**
 * Rebuild a draw from a stored record. Returns null if the record does not
 * fit (unknown tile, a player without the full hand of bonus cards, ...),
 * in which case the caller should simply draw again.
 */
export function fromRecord(record: SetupRecordLike | null, players: readonly PlayerLike[]): SetupDraw | null {
    if (!record || record.goals.length !== ROUND_COUNT || players.length === 0) return null;
    const goals: DrawnGoal[] = [];
    for (const g of record.goals) {
        const tile = GOAL_TILES.find(t => t.id === g.tileId);
        if (!tile) return null;
        goals.push({ tile, side: g.side === 1 ? 1 : 0 });
    }
    const bonus = [];
    for (const p of players) {
        const ids = record.bonus[p.id] ?? [];
        const cards = ids.map(id => BONUS_CARDS.find(c => c.id === id));
        if (cards.length !== BONUS_CARDS_PER_PLAYER || cards.some(c => !c)) return null;
        bonus.push(cards as NonNullable<(typeof cards)[number]>[]);
    }
    return { goals, bonus };
}

/** Turn one goal tile over. */
export function flipGoal(draw: SetupDraw, round: number): SetupDraw {
    return {
        ...draw,
        goals: draw.goals.map((g, i) => (i === round ? { ...g, side: (1 - g.side) as 0 | 1 } : g)),
    };
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

/** Readable face-up goal text per round, e.g. ["Birds in forest", ...]; null if not drawn. */
export function goalCaptions(record: SetupRecordLike | null, edition: Edition): (string | null)[] {
    return Array.from({ length: ROUND_COUNT }, (_, i) => {
        const g = record?.goals[i];
        const tile = g && GOAL_TILES.find(t => t.id === g.tileId);
        return tile ? renderTokens(tile.sides[g.side][edition], edition) : null;
    });
}
