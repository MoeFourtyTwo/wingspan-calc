/**
 * Setup helper: draws the round goals.
 *
 * Base game setup (unchanged by the expansions): 4 round goal tiles are drawn
 * at random, one per round, each with a random side up. Tiles of all owned
 * expansions are shuffled together.
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

/** Optional house rules for the draw. */
export interface HouseRules {
    /**
     * "No goal" may only be the round 1 goal. If it is drawn for a later
     * round, it swaps places with the round 1 goal – like drawing by hand and
     * swapping. Only the order changes, so the chance that "No goal" is in
     * the game at all stays exactly the same.
     */
    noGoalFirstRound?: boolean;
}

export const isNoGoal = (goal: DrawnGoal) => !!goal.tile.sides[goal.side].noGoal;

/** Apply the house rules to a draw (returns the same object if nothing changes). */
export function applyHouseRules(draw: SetupDraw, rules: HouseRules = {}): SetupDraw {
    if (!rules.noGoalFirstRound) return draw;
    const i = draw.goals.findIndex(isNoGoal);
    if (i <= 0) return draw;
    const goals = [...draw.goals];
    [goals[0], goals[i]] = [goals[i], goals[0]];
    return { goals };
}

const randomSide = (rng: Rng) => (rng() < 0.5 ? 0 : 1) as 0 | 1;

export function drawSetup(
    sets: readonly CardSet[],
    rng: Rng = Math.random,
    rules: HouseRules = {},
): { ok: true; draw: SetupDraw } | { ok: false; error: SetupError } {
    const tiles = goalTilePool(sets);
    if (tiles.length < ROUND_COUNT) return { ok: false, error: 'not-enough-goals' };
    const goals = shuffle(tiles, rng)
        .slice(0, ROUND_COUNT)
        .map(tile => ({ tile, side: randomSide(rng) }));
    return { ok: true, draw: applyHouseRules({ goals }, rules) };
}

/** Re-draw a single round goal with a tile that is not already on the board. */
export function redrawGoal(
    draw: SetupDraw,
    round: number,
    sets: readonly CardSet[],
    rng: Rng = Math.random,
    rules: HouseRules = {},
): SetupDraw {
    const used = new Set(draw.goals.map(g => g.tile.id));
    const free = goalTilePool(sets).filter(t => !used.has(t.id));
    if (free.length === 0) return draw;
    const tile = free[Math.floor(rng() * free.length)];
    return applyHouseRules({ goals: draw.goals.map((g, i) => (i === round ? { tile, side: randomSide(rng) } : g)) }, rules);
}
