/**
 * Pure, framework-free implementation of the Wingspan (Flügelschlag)
 * end-of-game scoring rules. Everything in here is deterministic and
 * side-effect free so it can be exhaustively unit-tested.
 *
 * See docs/REGELN.md for the rules (in German) this module implements.
 */

/** Scoring categories in the order of the official score pad. */
export const CATEGORIES = [
    'birds',
    'bonus',
    'round_goals',
    'eggs',
    'food',
    'tucked',
    'nectar',
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Scores = Record<Category, number>;

/** Categories whose points are derived from a placement grid, not typed in. */
export const PLACEMENT_CATEGORIES: readonly Category[] = ['round_goals', 'nectar'];

export const ROUND_COUNT = 4;
export const HABITATS = ['forest', 'grassland', 'wetland'] as const;
export type Habitat = (typeof HABITATS)[number];

/** Base game + Oceania: 1–5 players. Wingspan Asia "Flock" mode: up to 7. */
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 7;

/**
 * Competitive (green) side of the goal board.
 * Index = round (0-based), values = points for [1st, 2nd, 3rd] place.
 */
export const ROUND_GOAL_POINTS: readonly (readonly number[])[] = [
    [4, 1, 0],
    [5, 2, 1],
    [6, 3, 2],
    [7, 4, 3],
];

/** Non-competitive (blue) side: 1 point per matching item, max 5 per round. */
export const CASUAL_ROUND_GOAL_MAX = 5;

/** Oceania expansion: per habitat, most nectar spent = 5, second most = 2. */
export const NECTAR_POINTS: readonly number[] = [5, 2];

/**
 * A placement value as entered in the grids:
 * 0 = not placed / does not score, 1 = 1st, 2 = 2nd, 3 = 3rd.
 */
export type Placement = number;

export function emptyScores(): Scores {
    return { birds: 0, bonus: 0, round_goals: 0, eggs: 0, food: 0, tucked: 0, nectar: 0 };
}

/** Clamp an arbitrary user input to a non-negative integer. */
export function sanitizePoints(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
}

export function sumScores(scores: Scores): number {
    return CATEGORIES.reduce((acc, c) => acc + (scores[c] ?? 0), 0);
}

/**
 * Validates one row of a placement grid (one round or one habitat).
 *
 * Placements follow "standard competition ranking" (1-2-2-4): tied players
 * share a place and the following place(s) are skipped. E.g. if two players
 * tie for 1st, the next player is 3rd – there is no 2nd place.
 *
 * Formally: a place `r` may only be occupied if exactly `r - 1` players are
 * ranked better than it. Places beyond the points table are not allowed.
 */
export function isValidPlacementRow(placements: readonly Placement[], placeCount: number): boolean {
    for (const p of placements) {
        if (!Number.isInteger(p) || p < 0 || p > placeCount) return false;
    }
    for (let rank = 1; rank <= placeCount; rank++) {
        const occupied = placements.some(p => p === rank);
        if (!occupied) continue;
        const better = placements.filter(p => p > 0 && p < rank).length;
        if (better !== rank - 1) return false;
    }
    return true;
}

/**
 * Points for one placement row.
 *
 * Tie rule (identical for round goals and nectar): tied players add up the
 * points of the place they tie for and of the place(s) they "occupy" below
 * it, divide by the number of tied players and round down.
 *
 * Assumes a valid row (see {@link isValidPlacementRow}); invalid rows score 0
 * for everyone so that inconsistent input never produces phantom points.
 */
export function scorePlacementRow(placements: readonly Placement[], pointsTable: readonly number[]): number[] {
    if (!isValidPlacementRow(placements, pointsTable.length)) return placements.map(() => 0);

    return placements.map(rank => {
        if (rank <= 0) return 0;
        const tied = placements.filter(p => p === rank).length;
        let sum = 0;
        for (let slot = rank - 1; slot < rank - 1 + tied; slot++) {
            sum += pointsTable[slot] ?? 0;
        }
        return Math.floor(sum / tied);
    });
}

/**
 * Competitive round goal points per player.
 * @param placements placements[player][round]
 */
export function scoreRoundGoals(placements: readonly (readonly Placement[])[]): number[] {
    const totals = placements.map(() => 0);
    for (let round = 0; round < ROUND_COUNT; round++) {
        const row = placements.map(p => p[round] ?? 0);
        scorePlacementRow(row, ROUND_GOAL_POINTS[round]).forEach((pts, i) => (totals[i] += pts));
    }
    return totals;
}

/**
 * Non-competitive (blue side) round goal points for one player:
 * 1 point per matching item per round, capped at 5 per round.
 */
export function scoreCasualRoundGoals(itemCounts: readonly number[]): number {
    return itemCounts
        .slice(0, ROUND_COUNT)
        .reduce((acc, n) => acc + Math.min(CASUAL_ROUND_GOAL_MAX, sanitizePoints(n)), 0);
}

/**
 * Oceania nectar points per player.
 * @param placements placements[player][habitat]
 */
export function scoreNectar(placements: readonly (readonly Placement[])[]): number[] {
    const totals = placements.map(() => 0);
    for (let h = 0; h < HABITATS.length; h++) {
        const row = placements.map(p => p[h] ?? 0);
        scorePlacementRow(row, NECTAR_POINTS).forEach((pts, i) => (totals[i] += pts));
    }
    return totals;
}

export function validateRoundGoalRows(placements: readonly (readonly Placement[])[]): boolean[] {
    return ROUND_GOAL_POINTS.map((table, round) =>
        isValidPlacementRow(placements.map(p => p[round] ?? 0), table.length),
    );
}

export function validateNectarRows(placements: readonly (readonly Placement[])[]): boolean[] {
    return HABITATS.map((_, h) => isValidPlacementRow(placements.map(p => p[h] ?? 0), NECTAR_POINTS.length));
}

export interface RankablePlayer {
    id: string;
    total: number;
    /** Unused food tokens in the player's supply – the official tie-breaker. */
    leftoverFood?: number;
}

export interface Standing {
    id: string;
    total: number;
    /** 1-based final rank; tied players share the same rank. */
    rank: number;
    /** True if the player won (shared victories are possible). */
    winner: boolean;
}

/**
 * Final standings. Highest total wins. Ties are broken by the most unused
 * food tokens in the supply; if still tied, the players share the place.
 */
export function rankPlayers(players: readonly RankablePlayer[]): Standing[] {
    const food = (p: RankablePlayer) => sanitizePoints(p.leftoverFood ?? 0);
    const sorted = [...players].sort((a, b) => b.total - a.total || food(b) - food(a));

    const standings: Standing[] = [];
    sorted.forEach((p, i) => {
        const prev = sorted[i - 1];
        const tiedWithPrev = prev && prev.total === p.total && food(prev) === food(p);
        const rank = tiedWithPrev ? standings[i - 1].rank : i + 1;
        standings.push({ id: p.id, total: p.total, rank, winner: rank === 1 });
    });
    return standings;
}

/** Whether the leftover-food tie-breaker is needed to decide the winner. */
export function needsTieBreaker(players: readonly RankablePlayer[]): boolean {
    if (players.length < 2) return false;
    const best = Math.max(...players.map(p => p.total));
    return players.filter(p => p.total === best).length > 1;
}
