import { describe, expect, test } from 'vitest';
import {
    CASUAL_ROUND_GOAL_MAX,
    CATEGORIES,
    HABITATS,
    MAX_PLAYERS,
    MIN_PLAYERS,
    NECTAR_POINTS,
    PLACEMENT_CATEGORIES,
    ROUND_COUNT,
    ROUND_GOAL_POINTS,
    SIGNED_CATEGORIES,
    emptyScores,
    isValidPlacementRow,
    needsTieBreaker,
    rankPlayers,
    sanitizeCategoryPoints,
    sanitizePoints,
    sanitizeSignedPoints,
    scoreCasualRoundGoals,
    scoreNectar,
    scorePlacementRow,
    scoreRoundGoals,
    sumScores,
    validateNectarRows,
    validateRoundGoalRows,
    type Scores,
} from './scoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All rows of length `n` with entries in 0..maxValue (cartesian product). */
function allRows(n: number, maxValue: number): number[][] {
    const rows: number[][] = [[]];
    for (let i = 0; i < n; i++) {
        const next: number[][] = [];
        for (const r of rows) for (let v = 0; v <= maxValue; v++) next.push([...r, v]);
        rows.splice(0, rows.length, ...next);
    }
    return rows;
}

/**
 * Independent reference implementation of the official rules, working from
 * the raw item counts each player achieved (0 = nothing, does not place).
 *
 * Returns the placement row a correct player would enter (standard
 * competition ranking, places outside the table become 0) and the points
 * each player receives.
 */
function referenceFromCounts(counts: readonly number[], table: readonly number[]) {
    const placements = counts.map(c => {
        if (c <= 0) return 0;
        const rank = 1 + counts.filter(o => o > c).length;
        return rank <= table.length ? rank : 0;
    });
    const points = counts.map(c => {
        if (c <= 0) return 0;
        const better = counts.filter(o => o > c).length;
        const tied = counts.filter(o => o === c).length;
        let sum = 0;
        for (let slot = better; slot < better + tied; slot++) sum += table[slot] ?? 0;
        return Math.floor(sum / tied);
    });
    return { placements, points };
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function scores(partial: Partial<Scores>): Scores {
    return { ...emptyScores(), ...partial };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('rule constants', () => {
    test('score categories follow the official score pad', () => {
        expect([...CATEGORIES]).toEqual([
            'birds',
            'bonus',
            'round_goals',
            'eggs',
            'food',
            'tucked',
            'nectar',
            'hummingbirds',
        ]);
    });

    test('only the Americas hummingbird track may be negative', () => {
        expect([...SIGNED_CATEGORIES]).toEqual(['hummingbirds']);
    });

    test('hummingbird track is personal: not a placement category', () => {
        expect(PLACEMENT_CATEGORIES).not.toContain('hummingbirds');
    });

    test('placement categories are round goals and nectar', () => {
        expect([...PLACEMENT_CATEGORIES].sort()).toEqual(['nectar', 'round_goals']);
    });

    test('there are 4 rounds and 3 habitats', () => {
        expect(ROUND_COUNT).toBe(4);
        expect([...HABITATS]).toEqual(['forest', 'grassland', 'wetland']);
    });

    test('competitive round goal points table (green side)', () => {
        expect(ROUND_GOAL_POINTS).toEqual([
            [4, 1, 0],
            [5, 2, 1],
            [6, 3, 2],
            [7, 4, 3],
        ]);
        expect(ROUND_GOAL_POINTS).toHaveLength(ROUND_COUNT);
    });

    test('casual (blue side) cap is 5 per round', () => {
        expect(CASUAL_ROUND_GOAL_MAX).toBe(5);
    });

    test('Oceania nectar: 5 for most, 2 for second, only two places', () => {
        expect(NECTAR_POINTS).toEqual([5, 2]);
    });

    test('player count is 1..7 (Asia flock mode)', () => {
        expect(MIN_PLAYERS).toBe(1);
        expect(MAX_PLAYERS).toBe(7);
    });

    test('points tables are non-increasing by place and non-negative', () => {
        for (const table of [...ROUND_GOAL_POINTS, NECTAR_POINTS]) {
            for (let i = 0; i < table.length; i++) {
                expect(table[i]).toBeGreaterThanOrEqual(0);
                if (i > 0) expect(table[i]).toBeLessThanOrEqual(table[i - 1]);
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Basic score arithmetic
// ---------------------------------------------------------------------------

describe('emptyScores / sumScores', () => {
    test('emptyScores has every category at 0', () => {
        const s = emptyScores();
        expect(Object.keys(s).sort()).toEqual([...CATEGORIES].sort());
        for (const c of CATEGORIES) expect(s[c]).toBe(0);
        expect(sumScores(s)).toBe(0);
    });

    test('emptyScores returns a fresh object each call', () => {
        const a = emptyScores();
        a.birds = 10;
        expect(emptyScores().birds).toBe(0);
    });

    test('total is the sum of all eight categories', () => {
        const s = scores({ birds: 40, bonus: 9, round_goals: 15, eggs: 18, food: 4, tucked: 11, nectar: 7, hummingbirds: 6 });
        expect(sumScores(s)).toBe(40 + 9 + 15 + 18 + 4 + 11 + 7 + 6);
    });

    test('a negative hummingbird sum reduces the total', () => {
        expect(sumScores(scores({ birds: 30, eggs: 10, hummingbirds: -4 }))).toBe(36);
        expect(sumScores(scores({ hummingbirds: -3 }))).toBe(-3);
    });

    test.each(CATEGORIES.map(c => [c]))('category %s contributes to the total', c => {
        expect(sumScores(scores({ [c]: 3 }))).toBe(3);
    });

    test('missing category values are treated as 0', () => {
        const partial = { birds: 5 } as unknown as Scores;
        expect(sumScores(partial)).toBe(5);
    });
});

describe('sanitizePoints', () => {
    test.each([
        [0, 0],
        [7, 7],
        [12.9, 12],
        [0.5, 0],
        [-3, 0],
        [-0.1, 0],
        [NaN, 0],
        [Infinity, 0],
        [-Infinity, 0],
        ['15', 15],
        ['4.7', 4],
        ['', 0],
        ['abc', 0],
        [null, 0],
        [undefined, 0],
        [{}, 0],
    ])('sanitizePoints(%j) = %j', (input, expected) => {
        expect(sanitizePoints(input)).toBe(expected);
    });

    test('result is always a non-negative integer', () => {
        for (const v of [-100, -1.5, 0, 0.0001, 1, 1.999, 99, 1e6, NaN]) {
            const r = sanitizePoints(v);
            expect(Number.isInteger(r)).toBe(true);
            expect(r).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('sanitizeSignedPoints (hummingbird track)', () => {
    test.each([
        [0, 0],
        [5, 5],
        [-5, -5],
        [3.9, 3],
        [-3.9, -3],
        [-0.4, 0],
        [-0, 0],
        [NaN, 0],
        [Infinity, 0],
        [-Infinity, 0],
        ['-7', -7],
        ['2.5', 2],
        ['', 0],
        ['x', 0],
        [null, 0],
        [undefined, 0],
    ])('sanitizeSignedPoints(%j) = %j', (input, expected) => {
        expect(sanitizeSignedPoints(input)).toBe(expected);
    });

    test('never returns -0', () => {
        for (const v of [-0, -0.1, -0.999, '-0', '-0.5']) {
            expect(Object.is(sanitizeSignedPoints(v), -0)).toBe(false);
        }
    });

    test('result is always a finite integer', () => {
        for (const v of [-1e6, -2.5, -1, 0, 1, 2.5, 1e6, NaN, Infinity]) {
            const r = sanitizeSignedPoints(v);
            expect(Number.isInteger(r)).toBe(true);
        }
    });
});

describe('sanitizeCategoryPoints', () => {
    test('hummingbirds keep negative values', () => {
        expect(sanitizeCategoryPoints('hummingbirds', -6)).toBe(-6);
        expect(sanitizeCategoryPoints('hummingbirds', -2.7)).toBe(-2);
        expect(Object.is(sanitizeCategoryPoints('hummingbirds', -0.2), -0)).toBe(false);
        expect(sanitizeCategoryPoints('hummingbirds', NaN)).toBe(0);
    });

    test.each(CATEGORIES.filter(c => c !== 'hummingbirds').map(c => [c]))(
        '%s clamps negatives to 0 and floors fractions',
        c => {
            expect(sanitizeCategoryPoints(c, -6)).toBe(0);
            expect(sanitizeCategoryPoints(c, 7.8)).toBe(7);
            expect(sanitizeCategoryPoints(c, NaN)).toBe(0);
        },
    );
});

// ---------------------------------------------------------------------------
// Placement row validation
// ---------------------------------------------------------------------------

describe('isValidPlacementRow', () => {
    describe('valid rows (standard competition ranking 1-2-2-4)', () => {
        test.each<[string, number[], number]>([
            ['empty row', [], 3],
            ['nobody placed', [0, 0, 0], 3],
            ['single winner', [1, 0, 0], 3],
            ['1-2-3', [1, 2, 3], 3],
            ['1-2-3 + nobody', [1, 2, 3, 0, 0], 3],
            ['unordered 3-1-2', [3, 1, 2], 3],
            ['two tie for 1st, next is 3rd', [1, 1, 3], 3],
            ['three tie for 1st', [1, 1, 1], 3],
            ['four tie for 1st', [1, 1, 1, 1], 3],
            ['seven tie for 1st', [1, 1, 1, 1, 1, 1, 1], 3],
            ['1st + two tied 2nd', [1, 2, 2], 3],
            ['1st + three tied 2nd', [1, 2, 2, 2], 3],
            ['1st, 2nd + two tied 3rd', [1, 2, 3, 3], 3],
            ['1st, 2nd, nobody else scored', [1, 2, 0, 0], 3],
            ['nectar 1-2', [1, 2], 2],
            ['nectar two tie for 1st', [1, 1, 0], 2],
            ['nectar 1st + tied 2nd', [1, 2, 2, 0], 2],
            ['solo player', [1], 3],
        ])('%s: %j', (_, row, places) => {
            expect(isValidPlacementRow(row, places)).toBe(true);
        });
    });

    describe('invalid rows', () => {
        test.each<[string, number[], number]>([
            ['2nd without 1st', [2, 0, 0], 3],
            ['two 2nd without 1st', [2, 2, 0], 3],
            ['3rd without anyone better', [3, 0, 0], 3],
            ['3rd with only one 1st and no 2nd', [1, 3, 0], 3],
            ['2nd after a tie for 1st', [1, 1, 2], 3],
            ['3rd after a 1st+tied-2nd (would be 4th)', [1, 2, 2, 3], 3],
            ['3rd after three tied for 1st', [1, 1, 1, 3], 3],
            ['rank greater than table size', [1, 2, 3, 4], 3],
            ['nectar has no 3rd place', [1, 2, 3], 2],
            ['negative rank', [1, -1], 3],
            ['non-integer rank', [1, 1.5], 3],
            ['NaN rank', [1, NaN], 3],
            ['Infinity rank', [Infinity], 3],
            ['2nd without 1st (nectar)', [0, 2], 2],
        ])('%s: %j', (_, row, places) => {
            expect(isValidPlacementRow(row, places)).toBe(false);
        });
    });

    test('order of players in the row does not matter', () => {
        for (let n = 1; n <= 5; n++) {
            for (const row of allRows(n, 3)) {
                const reversed = [...row].reverse();
                expect(isValidPlacementRow(reversed, 3)).toBe(isValidPlacementRow(row, 3));
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Placement row scoring (tie rule)
// ---------------------------------------------------------------------------

describe('scorePlacementRow – round goals without ties', () => {
    test.each(ROUND_GOAL_POINTS.map((t, r) => [r + 1, t] as const))(
        'round %i: 1st/2nd/3rd get %j',
        (_round, table) => {
            expect(scorePlacementRow([1, 2, 3], table)).toEqual([...table]);
            expect(scorePlacementRow([3, 2, 1], table)).toEqual([...table].reverse());
        },
    );

    test('players with 0 (no matching items / "Other") get nothing', () => {
        expect(scorePlacementRow([1, 0, 2, 0], ROUND_GOAL_POINTS[3])).toEqual([7, 0, 4, 0]);
        expect(scorePlacementRow([0, 0, 0], ROUND_GOAL_POINTS[3])).toEqual([0, 0, 0]);
    });

    test('a sole 1st place in a 1-player game takes the 1st place points', () => {
        ROUND_GOAL_POINTS.forEach(table => {
            expect(scorePlacementRow([1], table)).toEqual([table[0]]);
        });
    });
});

describe('scorePlacementRow – ties (sum of occupied places / tied players, rounded down)', () => {
    test.each<[string, number[], readonly number[], number[]]>([
        // Round 1: 4/1/0
        ['R1 two tie for 1st -> floor((4+1)/2)=2', [1, 1, 0], ROUND_GOAL_POINTS[0], [2, 2, 0]],
        ['R1 two tie for 1st, next is 3rd (0 pts)', [1, 1, 3], ROUND_GOAL_POINTS[0], [2, 2, 0]],
        ['R1 three tie for 1st -> floor(5/3)=1', [1, 1, 1], ROUND_GOAL_POINTS[0], [1, 1, 1]],
        ['R1 1st + two tied 2nd -> floor((1+0)/2)=0', [1, 2, 2], ROUND_GOAL_POINTS[0], [4, 0, 0]],
        // Round 2: 5/2/1
        ['R2 two tie for 1st -> floor(7/2)=3', [1, 1, 3], ROUND_GOAL_POINTS[1], [3, 3, 1]],
        ['R2 1st + two tied 2nd -> floor((2+1)/2)=1', [1, 2, 2], ROUND_GOAL_POINTS[1], [5, 1, 1]],
        ['R2 1st, 2nd + two tied 3rd -> floor(1/2)=0', [1, 2, 3, 3], ROUND_GOAL_POINTS[1], [5, 2, 0, 0]],
        ['R2 three tie for 1st -> floor(8/3)=2', [1, 1, 1], ROUND_GOAL_POINTS[1], [2, 2, 2]],
        // Round 3: 6/3/2
        ['R3 two tie for 1st -> floor(9/2)=4', [1, 1, 3], ROUND_GOAL_POINTS[2], [4, 4, 2]],
        ['R3 1st + two tied 2nd -> floor(5/2)=2', [1, 2, 2], ROUND_GOAL_POINTS[2], [6, 2, 2]],
        ['R3 1st, 2nd + two tied 3rd -> floor(2/2)=1', [1, 2, 3, 3], ROUND_GOAL_POINTS[2], [6, 3, 1, 1]],
        // Round 4: 7/4/3
        ['R4 two tie for 1st -> floor(11/2)=5', [1, 1, 3], ROUND_GOAL_POINTS[3], [5, 5, 3]],
        ['R4 three tie for 1st -> floor(14/3)=4', [1, 1, 1], ROUND_GOAL_POINTS[3], [4, 4, 4]],
        ['R4 four tie for 1st -> floor(14/4)=3', [1, 1, 1, 1], ROUND_GOAL_POINTS[3], [3, 3, 3, 3]],
        ['R4 five tie for 1st -> floor(14/5)=2', [1, 1, 1, 1, 1], ROUND_GOAL_POINTS[3], [2, 2, 2, 2, 2]],
        ['R4 seven tie for 1st -> floor(14/7)=2', [1, 1, 1, 1, 1, 1, 1], ROUND_GOAL_POINTS[3], [2, 2, 2, 2, 2, 2, 2]],
        ['R4 1st + two tied 2nd -> floor(7/2)=3', [1, 2, 2, 0], ROUND_GOAL_POINTS[3], [7, 3, 3, 0]],
        ['R4 1st + three tied 2nd -> floor(7/3)=2', [1, 2, 2, 2], ROUND_GOAL_POINTS[3], [7, 2, 2, 2]],
        ['R4 1st, 2nd + three tied 3rd -> floor(3/3)=1', [1, 2, 3, 3, 3], ROUND_GOAL_POINTS[3], [7, 4, 1, 1, 1]],
        ['R4 1st, 2nd + four tied 3rd -> floor(3/4)=0', [1, 2, 3, 3, 3, 3], ROUND_GOAL_POINTS[3], [7, 4, 0, 0, 0, 0]],
    ])('%s', (_, row, table, expected) => {
        expect(scorePlacementRow(row, table)).toEqual(expected);
    });
});

describe('scorePlacementRow – Oceania nectar (5/2)', () => {
    test.each<[string, number[], number[]]>([
        ['1st and 2nd', [1, 2], [5, 2]],
        ['1st, 2nd, others nothing', [2, 0, 1, 0], [2, 0, 5, 0]],
        ['two tie for 1st -> floor(7/2)=3', [1, 1, 0], [3, 3, 0]],
        ['three tie for 1st -> floor(7/3)=2', [1, 1, 1], [2, 2, 2]],
        ['four tie for 1st -> floor(7/4)=1', [1, 1, 1, 1], [1, 1, 1, 1]],
        ['five tie for 1st -> floor(7/5)=1', [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
        ['1st + two tie for 2nd -> floor(2/2)=1', [1, 2, 2], [5, 1, 1]],
        ['1st + three tie for 2nd -> floor(2/3)=0', [1, 2, 2, 2], [5, 0, 0, 0]],
        ['only 1st', [0, 1, 0], [0, 5, 0]],
        ['nobody spent nectar', [0, 0, 0], [0, 0, 0]],
    ])('%s', (_, row, expected) => {
        expect(scorePlacementRow(row, NECTAR_POINTS)).toEqual(expected);
    });
});

describe('scorePlacementRow – invalid rows score 0 for everyone', () => {
    test.each<[string, number[], readonly number[]]>([
        ['2nd without 1st', [2, 0, 0], ROUND_GOAL_POINTS[3]],
        ['3rd with only one 1st', [1, 3, 0], ROUND_GOAL_POINTS[3]],
        ['2nd after tie for 1st', [1, 1, 2], ROUND_GOAL_POINTS[3]],
        ['rank beyond table', [1, 2, 3, 4], ROUND_GOAL_POINTS[3]],
        ['3rd place in nectar', [1, 2, 3], NECTAR_POINTS],
        ['non-integer', [1, 2.5], ROUND_GOAL_POINTS[3]],
        ['negative', [1, -2], ROUND_GOAL_POINTS[3]],
    ])('%s', (_, row, table) => {
        expect(scorePlacementRow(row, table)).toEqual(row.map(() => 0));
    });
});

describe('scorePlacementRow – exhaustive properties (2–5 players)', () => {
    const tables: [string, readonly number[]][] = [
        ...ROUND_GOAL_POINTS.map((t, i) => [`round ${i + 1}`, t] as [string, readonly number[]]),
        ['nectar', NECTAR_POINTS],
    ];

    describe.each(tables)('%s', (_, table) => {
        test.each([2, 3, 4, 5])('%i players: all rows with entries 0..places+1', n => {
            let validCount = 0;
            for (const row of allRows(n, table.length + 1)) {
                const valid = isValidPlacementRow(row, table.length);
                const pts = scorePlacementRow(row, table);
                expect(pts).toHaveLength(n);

                // points are always non-negative integers
                for (const p of pts) {
                    expect(Number.isInteger(p)).toBe(true);
                    expect(p).toBeGreaterThanOrEqual(0);
                }

                if (!valid) {
                    expect(pts.every(p => p === 0)).toBe(true);
                    continue;
                }
                validCount++;

                // never more points handed out than the table holds
                expect(sum(pts)).toBeLessThanOrEqual(sum(table));

                // nobody scores more than the 1st place value
                for (const p of pts) expect(p).toBeLessThanOrEqual(table[0]);

                // unplaced players score nothing
                row.forEach((r, i) => {
                    if (r === 0) expect(pts[i]).toBe(0);
                });

                // a better place never scores less than a worse place
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        if (row[i] > 0 && (row[j] === 0 || row[i] < row[j])) {
                            expect(pts[i]).toBeGreaterThanOrEqual(pts[j]);
                        }
                    }
                }

                // tied players score the same
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        if (row[i] === row[j]) expect(pts[i]).toBe(pts[j]);
                    }
                }

                // permuting players permutes their points
                const reversed = [...row].reverse();
                expect(scorePlacementRow(reversed, table)).toEqual([...pts].reverse());
            }
            expect(validCount).toBeGreaterThan(0);
        });

        test.each([2, 3, 4, 5])(
            '%i players: valid rows are exactly the rows achievable from item counts, and points match the reference',
            n => {
                // Every combination of item counts 0..n per player.
                const achievable = new Set<string>();
                for (const counts of allRows(n, n)) {
                    const ref = referenceFromCounts(counts, table);
                    achievable.add(ref.placements.join(','));
                    expect(isValidPlacementRow(ref.placements, table.length)).toBe(true);
                    expect(scorePlacementRow(ref.placements, table)).toEqual(ref.points);
                }
                // Conversely, every row the validator accepts can arise from a real game.
                for (const row of allRows(n, table.length)) {
                    if (isValidPlacementRow(row, table.length)) {
                        // A row may leave a ranked player at 0 (fewer items entered), so
                        // compare against rows achievable after zeroing some players: it
                        // suffices that the non-zero part is achievable on its own.
                        const counts = row.map(r => (r === 0 ? 0 : table.length + 1 - r));
                        const ref = referenceFromCounts(counts, table);
                        expect(ref.placements).toEqual(row);
                        expect(achievable.has(row.join(','))).toBe(true);
                    }
                }
            },
        );
    });

    test('a 1st place always beats a 2nd place even in the worst tie for 1st (R1)', () => {
        // Two tied for 1st get floor(5/2)=2 > 0 (3rd). Single 2nd gets 1 < 4.
        expect(scorePlacementRow([1, 1, 3], ROUND_GOAL_POINTS[0])).toEqual([2, 2, 0]);
    });
});

// ---------------------------------------------------------------------------
// Whole-game round goals and nectar
// ---------------------------------------------------------------------------

describe('scoreRoundGoals (competitive / green side)', () => {
    test('sums the four rounds per player', () => {
        // placements[player][round]
        const placements = [
            [1, 2, 3, 1],
            [2, 1, 1, 2],
            [3, 3, 2, 0],
        ];
        expect(scoreRoundGoals(placements)).toEqual([
            4 + 2 + 2 + 7,
            1 + 5 + 6 + 4,
            0 + 1 + 3 + 0,
        ]);
    });

    test('ties in different rounds', () => {
        const placements = [
            [1, 1, 1, 1],
            [1, 2, 1, 1],
            [3, 2, 1, 1],
        ];
        expect(scoreRoundGoals(placements)).toEqual([
            2 + 5 + 3 + 4,
            2 + 1 + 3 + 4,
            0 + 1 + 3 + 4,
        ]);
    });

    test('an invalid round scores 0 for that round only', () => {
        const placements = [
            [1, 2, 1, 1],
            [2, 2, 3, 2], // round 2: two 2nd places and no 1st among them... (player0 has 2nd too)
        ];
        // round 2 = [2, 2] -> invalid (no 1st); round 3 = [1, 3] -> invalid (3rd without 2nd)
        expect(validateRoundGoalRows(placements)).toEqual([true, false, false, true]);
        expect(scoreRoundGoals(placements)).toEqual([4 + 0 + 0 + 7, 1 + 0 + 0 + 4]);
    });

    test('missing round entries count as "not placed"', () => {
        expect(scoreRoundGoals([[1], [2]])).toEqual([4, 1]);
    });

    test('no players -> empty result', () => {
        expect(scoreRoundGoals([])).toEqual([]);
    });

    test('maximum possible round goal score is 4+5+6+7 = 22', () => {
        expect(scoreRoundGoals([[1, 1, 1, 1], [0, 0, 0, 0]])).toEqual([22, 0]);
    });
});

describe('scoreCasualRoundGoals (blue side)', () => {
    test.each<[number[], number]>([
        [[0, 0, 0, 0], 0],
        [[1, 2, 3, 4], 10],
        [[5, 5, 5, 5], 20],
        [[6, 10, 99, 5], 20],
        [[3, 7, 0, 2], 3 + 5 + 0 + 2],
        [[-2, 2, NaN, 2.9], 0 + 2 + 0 + 2],
        [[1, 1], 2],
        [[5, 5, 5, 5, 5], 20], // extra entries beyond 4 rounds are ignored
    ])('%j -> %i', (counts, expected) => {
        expect(scoreCasualRoundGoals(counts)).toBe(expected);
    });

    test('never exceeds 5 per round / 20 total', () => {
        for (let a = 0; a <= 8; a++) {
            for (let b = 0; b <= 8; b++) {
                const s = scoreCasualRoundGoals([a, b, a, b]);
                expect(s).toBe(2 * Math.min(5, a) + 2 * Math.min(5, b));
                expect(s).toBeLessThanOrEqual(20);
            }
        }
    });
});

describe('scoreNectar (Oceania)', () => {
    test('sums the three habitats per player', () => {
        // placements[player][habitat] = forest, grassland, wetland
        const placements = [
            [1, 2, 0],
            [2, 1, 1],
            [0, 0, 2],
        ];
        expect(scoreNectar(placements)).toEqual([5 + 2, 2 + 5 + 5, 2]);
    });

    test('tie rule per habitat', () => {
        const placements = [
            [1, 1, 1],
            [1, 2, 1],
            [0, 2, 1],
        ];
        // forest: two tie 1st -> 3 each; grassland: 1st + two tied 2nd -> 5,1,1;
        // wetland: three tie 1st -> floor(7/3) = 2
        expect(scoreNectar(placements)).toEqual([3 + 5 + 2, 3 + 1 + 2, 0 + 1 + 2]);
    });

    test('invalid habitat rows score 0 only for that habitat', () => {
        const placements = [
            [1, 2, 1],
            [3, 0, 2],
        ];
        expect(validateNectarRows(placements)).toEqual([false, false, true]);
        expect(scoreNectar(placements)).toEqual([5, 2]);
    });

    test('maximum nectar score is 15', () => {
        expect(scoreNectar([[1, 1, 1], [0, 0, 0]])).toEqual([15, 0]);
    });
});

describe('validateRoundGoalRows / validateNectarRows', () => {
    test('one flag per round / habitat', () => {
        expect(validateRoundGoalRows([[0, 0, 0, 0]])).toHaveLength(ROUND_COUNT);
        expect(validateNectarRows([[0, 0, 0]])).toHaveLength(HABITATS.length);
    });

    test('empty grids are valid', () => {
        expect(validateRoundGoalRows([])).toEqual([true, true, true, true]);
        expect(validateNectarRows([])).toEqual([true, true, true]);
    });

    test('3rd place is allowed for round goals but not for nectar', () => {
        const grid = [
            [1, 1, 1, 1],
            [2, 2, 2, 2],
            [3, 3, 3, 3],
        ];
        expect(validateRoundGoalRows(grid)).toEqual([true, true, true, true]);
        expect(validateNectarRows(grid)).toEqual([false, false, false]);
    });
});

// ---------------------------------------------------------------------------
// Winner determination
// ---------------------------------------------------------------------------

describe('rankPlayers', () => {
    const byId = (standings: ReturnType<typeof rankPlayers>) =>
        Object.fromEntries(standings.map(s => [s.id, s]));

    test('highest total wins, sorted descending', () => {
        const st = rankPlayers([
            { id: 'a', total: 80 },
            { id: 'b', total: 95 },
            { id: 'c', total: 70 },
        ]);
        expect(st.map(s => s.id)).toEqual(['b', 'a', 'c']);
        expect(st.map(s => s.rank)).toEqual([1, 2, 3]);
        expect(st.map(s => s.winner)).toEqual([true, false, false]);
    });

    test('tie on total is broken by most leftover food', () => {
        const st = byId(
            rankPlayers([
                { id: 'a', total: 90, leftoverFood: 1 },
                { id: 'b', total: 90, leftoverFood: 3 },
                { id: 'c', total: 60, leftoverFood: 9 },
            ]),
        );
        expect(st.b).toMatchObject({ rank: 1, winner: true });
        expect(st.a).toMatchObject({ rank: 2, winner: false });
        expect(st.c).toMatchObject({ rank: 3, winner: false });
    });

    test('food does not matter when totals differ', () => {
        const st = byId(
            rankPlayers([
                { id: 'a', total: 91, leftoverFood: 0 },
                { id: 'b', total: 90, leftoverFood: 10 },
            ]),
        );
        expect(st.a.winner).toBe(true);
        expect(st.b.winner).toBe(false);
    });

    test('still tied after food -> shared victory', () => {
        const st = byId(
            rankPlayers([
                { id: 'a', total: 90, leftoverFood: 2 },
                { id: 'b', total: 90, leftoverFood: 2 },
                { id: 'c', total: 85, leftoverFood: 5 },
            ]),
        );
        expect(st.a).toMatchObject({ rank: 1, winner: true });
        expect(st.b).toMatchObject({ rank: 1, winner: true });
        // competition ranking: next rank after a 2-way tie is 3
        expect(st.c).toMatchObject({ rank: 3, winner: false });
    });

    test('missing leftover food counts as 0', () => {
        const st = byId(
            rankPlayers([
                { id: 'a', total: 50 },
                { id: 'b', total: 50, leftoverFood: 0 },
                { id: 'c', total: 50, leftoverFood: 1 },
            ]),
        );
        expect(st.c.rank).toBe(1);
        expect(st.a.rank).toBe(2);
        expect(st.b.rank).toBe(2);
    });

    test('invalid leftover food values are sanitized', () => {
        const st = byId(
            rankPlayers([
                { id: 'a', total: 50, leftoverFood: -5 },
                { id: 'b', total: 50, leftoverFood: NaN },
            ]),
        );
        expect(st.a.rank).toBe(1);
        expect(st.b.rank).toBe(1);
    });

    test('ties lower down share a rank too', () => {
        const st = rankPlayers([
            { id: 'a', total: 100 },
            { id: 'b', total: 80 },
            { id: 'c', total: 80 },
            { id: 'd', total: 70 },
        ]);
        expect(st.map(s => s.rank)).toEqual([1, 2, 2, 4]);
        expect(st.filter(s => s.winner).map(s => s.id)).toEqual(['a']);
    });

    test('everybody tied -> everybody wins', () => {
        const st = rankPlayers(Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, total: 42, leftoverFood: 1 })));
        expect(st.every(s => s.rank === 1 && s.winner)).toBe(true);
    });

    test('negative totals (hummingbird track) are ranked correctly', () => {
        const st = rankPlayers([
            { id: 'a', total: -2 },
            { id: 'b', total: 0 },
            { id: 'c', total: -5 },
        ]);
        expect(st.map(s => s.id)).toEqual(['b', 'a', 'c']);
        expect(st[0].winner).toBe(true);
    });

    test('solo player wins', () => {
        expect(rankPlayers([{ id: 'solo', total: 0 }])).toEqual([{ id: 'solo', total: 0, rank: 1, winner: true }]);
    });

    test('no players -> no standings', () => {
        expect(rankPlayers([])).toEqual([]);
    });

    test('does not mutate the input', () => {
        const input = [
            { id: 'a', total: 1 },
            { id: 'b', total: 2 },
        ];
        rankPlayers(input);
        expect(input.map(p => p.id)).toEqual(['a', 'b']);
    });

    test('property: ranks are consistent with (total, food) ordering', () => {
        // deterministic pseudo-random
        let seed = 12345;
        const rnd = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let iter = 0; iter < 300; iter++) {
            const n = 1 + rnd(MAX_PLAYERS);
            const players = Array.from({ length: n }, (_, i) => ({
                id: `p${i}`,
                total: 60 + rnd(5),
                leftoverFood: rnd(3),
            }));
            const st = rankPlayers(players);
            expect(st).toHaveLength(n);
            const food = new Map(players.map(p => [p.id, p.leftoverFood]));
            for (const s of st) {
                const better = players.filter(
                    p => p.total > s.total || (p.total === s.total && p.leftoverFood > food.get(s.id)!),
                ).length;
                expect(s.rank).toBe(better + 1);
                expect(s.winner).toBe(s.rank === 1);
            }
            expect(st.some(s => s.winner)).toBe(true);
        }
    });
});

describe('needsTieBreaker', () => {
    test.each<[string, number[], boolean]>([
        ['no players', [], false],
        ['solo', [50], false],
        ['clear winner', [50, 40, 40], false],
        ['tie for first', [50, 50, 40], true],
        ['three-way tie for first', [50, 50, 50], true],
        ['tie only for second', [60, 50, 50], false],
    ])('%s', (_, totals, expected) => {
        expect(needsTieBreaker(totals.map((total, i) => ({ id: String(i), total })))).toBe(expected);
    });
});
