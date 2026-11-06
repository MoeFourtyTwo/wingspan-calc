/**
 * Setup helper: draws the round goals.
 *
 * Base game setup (unchanged by the expansions): 4 round goal tiles are drawn
 * at random, one per round, each with a random side up. Tiles of all owned
 * expansions are shuffled together.
 *
 * Bonus cards are deliberately not dealt here: they are secret, and dealing
 * them on a shared screen would reveal everyone's hand.
 */
import { GOAL_TILES } from '../data/goalTiles';
import type { CardSet, GoalTile } from '../data/types';

export const ROUND_COUNT = 4;

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

/** Small deterministic PRNG (mulberry32) – handy for tests. */
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
}

export type SetupError = 'not-enough-goals';

const randomSide = (rng: Rng) => (rng() < 0.5 ? 0 : 1) as 0 | 1;

export function drawSetup(
    sets: readonly CardSet[],
    rng: Rng = Math.random,
): { ok: true; draw: SetupDraw } | { ok: false; error: SetupError } {
    const tiles = goalTilePool(sets);
    if (tiles.length < ROUND_COUNT) return { ok: false, error: 'not-enough-goals' };
    const goals = shuffle(tiles, rng)
        .slice(0, ROUND_COUNT)
        .map(tile => ({ tile, side: randomSide(rng) }));
    return { ok: true, draw: { goals } };
}

/** Re-draw a single round goal with a tile that is not already on the board. */
export function redrawGoal(draw: SetupDraw, round: number, sets: readonly CardSet[], rng: Rng = Math.random): SetupDraw {
    const used = new Set(draw.goals.map(g => g.tile.id));
    const free = goalTilePool(sets).filter(t => !used.has(t.id));
    if (free.length === 0) return draw;
    const tile = free[Math.floor(rng() * free.length)];
    return { goals: draw.goals.map((g, i) => (i === round ? { tile, side: randomSide(rng) } : g)) };
}
