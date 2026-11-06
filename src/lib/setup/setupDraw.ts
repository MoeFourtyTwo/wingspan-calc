/**
 * Setup helper: draws the round goals and the starting bonus cards.
 *
 * Rules implemented (base game setup, unchanged by the expansions):
 * - 4 round goal tiles are drawn at random, one per round, each with a
 *   random side up. Tiles of all owned expansions are shuffled together.
 * - Every player is dealt 2 bonus cards from the shuffled bonus deck and
 *   keeps 1 of them at the end of setup.
 *
 * German edition (Feuerland): several bonus cards score words in the bird
 * names, which differ between languages. Feuerland therefore recommends
 * removing some of them depending on which bird decks are mixed together.
 */
import { BONUS_CARDS } from '../data/bonusCards';
import { GOAL_TILES } from '../data/goalTiles';
import type { BonusCard, CardSet, Edition, GoalTile } from '../data/types';

export const ROUND_COUNT = 4;
export const BONUS_CARDS_PER_PLAYER = 2;

/** Bonus card ids by English name, for the removal table below. */
const HISTORIAN = 1017; // DE: Biologe
const ANATOMIST = 1000; // DE: Morphologe
const CARTOGRAPHER = 1007; // DE: Geograf
const PHOTOGRAPHER = 1023; // DE: Fotograf

/**
 * Feuerland's removal recommendation for the German edition, keyed by the
 * bird decks in play (core, european, oceania, asia; sorted, joined by "+").
 * Combinations that are not listed need no removals. The Americas birds are
 * not covered by the published table.
 */
export const GERMAN_EDITION_REMOVALS: Readonly<Record<string, readonly number[]>> = {
    'core+oceania': [HISTORIAN, ANATOMIST],
    'core+european+oceania': [CARTOGRAPHER],
    'european+oceania': [HISTORIAN, CARTOGRAPHER],
    'asia+core+european': [CARTOGRAPHER, ANATOMIST],
    'asia+core+oceania': [HISTORIAN, CARTOGRAPHER],
    'asia+core+european+oceania': [HISTORIAN, CARTOGRAPHER],
    'asia+european': [HISTORIAN, CARTOGRAPHER, ANATOMIST],
    'asia+oceania': [HISTORIAN, PHOTOGRAPHER, CARTOGRAPHER, ANATOMIST],
    'asia+european+oceania': [HISTORIAN, CARTOGRAPHER],
};

const BIRD_DECKS_IN_TABLE: readonly CardSet[] = ['core', 'european', 'oceania', 'asia'];

export function removalKey(sets: Iterable<CardSet>): string {
    return [...new Set(sets)]
        .filter(s => BIRD_DECKS_IN_TABLE.includes(s))
        .sort()
        .join('+');
}

/** Bonus card ids Feuerland recommends removing for these sets (German edition). */
export function germanEditionRemovals(sets: Iterable<CardSet>): readonly number[] {
    return GERMAN_EDITION_REMOVALS[removalKey(sets)] ?? [];
}

export interface PoolOptions {
    sets: readonly CardSet[];
    edition: Edition;
    /** Apply Feuerland's removal table (only has an effect for the German edition). */
    applyEditionRemovals?: boolean;
}

export function bonusCardPool({ sets, edition, applyEditionRemovals = true }: PoolOptions): BonusCard[] {
    const removed = edition === 'de' && applyEditionRemovals ? germanEditionRemovals(sets) : [];
    return BONUS_CARDS.filter(c => sets.includes(c.set) && !removed.includes(c.id));
}

export function goalTilePool(sets: readonly CardSet[]): GoalTile[] {
    return GOAL_TILES.filter(t => sets.includes(t.set));
}

export type Rng = () => number;

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Small deterministic PRNG (mulberry32) – handy for tests and shareable seeds. */
export function seededRng(seed: number): Rng {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface DrawnGoal {
    tile: GoalTile;
    /** 0 or 1: which side of the tile is face up. */
    side: 0 | 1;
}

export interface SetupDraw {
    goals: DrawnGoal[];
    /** bonus[player] = the bonus cards dealt to that player. */
    bonus: BonusCard[][];
}

export type SetupError = 'not-enough-goals' | 'not-enough-bonus-cards' | 'no-players';

export interface DrawOptions extends PoolOptions {
    playerCount: number;
    rng?: Rng;
}

export function drawSetup(opts: DrawOptions): { ok: true; draw: SetupDraw } | { ok: false; error: SetupError } {
    const rng = opts.rng ?? Math.random;
    if (opts.playerCount < 1) return { ok: false, error: 'no-players' };

    const tiles = goalTilePool(opts.sets);
    if (tiles.length < ROUND_COUNT) return { ok: false, error: 'not-enough-goals' };

    const deck = bonusCardPool(opts);
    if (deck.length < opts.playerCount * BONUS_CARDS_PER_PLAYER) return { ok: false, error: 'not-enough-bonus-cards' };

    const goals = shuffle(tiles, rng)
        .slice(0, ROUND_COUNT)
        .map(tile => ({ tile, side: (rng() < 0.5 ? 0 : 1) as 0 | 1 }));

    const shuffled = shuffle(deck, rng);
    const bonus = Array.from({ length: opts.playerCount }, (_, p) =>
        shuffled.slice(p * BONUS_CARDS_PER_PLAYER, (p + 1) * BONUS_CARDS_PER_PLAYER),
    );
    return { ok: true, draw: { goals, bonus } };
}

/** Re-draw a single round goal with a tile that is not already on the board. */
export function redrawGoal(draw: SetupDraw, round: number, sets: readonly CardSet[], rng: Rng = Math.random): SetupDraw {
    const used = new Set(draw.goals.map(g => g.tile.id));
    const free = goalTilePool(sets).filter(t => !used.has(t.id));
    if (free.length === 0) return draw;
    const tile = free[Math.floor(rng() * free.length)];
    const goals = draw.goals.map((g, i) => (i === round ? { tile, side: (rng() < 0.5 ? 0 : 1) as 0 | 1 } : g));
    return { ...draw, goals };
}

/** Pick the text of a card for an edition, falling back to English. */
export function localized(text: { en: string; de: string | null }, edition: Edition): string {
    return (edition === 'de' ? text.de : null) ?? text.en;
}
