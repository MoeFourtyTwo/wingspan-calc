import { beforeEach, describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import {
    CATEGORIES,
    DEFAULT_OPTIONS,
    activeCategories,
    gameStore,
    isPlacementCategory,
    recompute,
    validateAllNectar,
    validateAllRoundGoals,
    validateNectarRow,
    validateRoundGoalsRow,
    type GameOptions,
    type Player,
} from './store';
import { HABITATS, MAX_PLAYERS, ROUND_COUNT, emptyScores, sumScores } from './rules/scoring';

const state = () => get(gameStore);
const players = () => state().players;
const player = (id: string) => players().find(p => p.id === id)!;

function addPlayers(n: number): string[] {
    for (let i = 0; i < n; i++) gameStore.addPlayer(`P${i + 1}`, `#00000${i}`);
    return players().map(p => p.id);
}

/** Set one round of round-goal placements, one entry per player (by index). */
function setRound(ids: string[], round: number, row: number[]) {
    ids.forEach((id, i) => gameStore.updateRoundPlacement(id, round, row[i]));
}

function setHabitat(ids: string[], habitat: number, row: number[]) {
    ids.forEach((id, i) => gameStore.updateNectarPlacement(id, habitat, row[i]));
}

function expectTotalsConsistent() {
    for (const p of players()) expect(p.total).toBe(sumScores(p.scores));
}

beforeEach(() => {
    gameStore.setOptions({ ...DEFAULT_OPTIONS });
    gameStore.resetGame();
});

// ---------------------------------------------------------------------------

describe('initial state / options', () => {
    test('fresh game starts in SETUP with no players', () => {
        const s = state();
        expect(s.players).toEqual([]);
        expect(s.currentPhase).toBe('SETUP');
        expect(s.currentScoringCategoryIndex).toBe(0);
        expect(s.startPlayerId).toBeNull();
        expect(typeof s.gameId).toBe('string');
        expect(s.gameId.length).toBeGreaterThan(0);
    });

    test('default options: competitive goals, Oceania on, Americas off', () => {
        expect(DEFAULT_OPTIONS).toEqual({ roundGoalMode: 'competitive', oceania: true, americas: false });
        expect(state().options).toEqual(DEFAULT_OPTIONS);
    });

    test('setOptions merges partial options', () => {
        gameStore.setOptions({ oceania: false });
        expect(state().options).toEqual({ ...DEFAULT_OPTIONS, oceania: false });
        gameStore.setOptions({ roundGoalMode: 'casual' });
        expect(state().options).toEqual({ roundGoalMode: 'casual', oceania: false, americas: false });
    });

    test('state options are a copy, not DEFAULT_OPTIONS itself', () => {
        gameStore.resetGame();
        expect(state().options).not.toBe(DEFAULT_OPTIONS);
    });
});

describe('activeCategories / isPlacementCategory', () => {
    const opts = (o: Partial<GameOptions>): GameOptions => ({ ...DEFAULT_OPTIONS, ...o });

    test.each<[string, Partial<GameOptions>, string[]]>([
        ['base game', { oceania: false, americas: false }, ['birds', 'bonus', 'round_goals', 'eggs', 'food', 'tucked']],
        ['Oceania', { oceania: true, americas: false }, ['birds', 'bonus', 'round_goals', 'eggs', 'food', 'tucked', 'nectar']],
        ['Americas', { oceania: false, americas: true }, ['birds', 'bonus', 'round_goals', 'eggs', 'food', 'tucked', 'hummingbirds']],
        ['Oceania + Americas', { oceania: true, americas: true }, [...CATEGORIES]],
    ])('%s', (_, o, expected) => {
        expect(activeCategories(opts(o))).toEqual(expected);
    });

    test('active categories keep score pad order', () => {
        const active = activeCategories(opts({ americas: true }));
        expect(active).toEqual(CATEGORIES.filter(c => active.includes(c)));
    });

    test('nectar is always a placement category', () => {
        expect(isPlacementCategory('nectar', opts({}))).toBe(true);
        expect(isPlacementCategory('nectar', opts({ roundGoalMode: 'casual' }))).toBe(true);
    });

    test('round goals are a placement category only on the competitive side', () => {
        expect(isPlacementCategory('round_goals', opts({ roundGoalMode: 'competitive' }))).toBe(true);
        expect(isPlacementCategory('round_goals', opts({ roundGoalMode: 'casual' }))).toBe(false);
    });

    test.each(['birds', 'bonus', 'eggs', 'food', 'tucked', 'hummingbirds'] as const)(
        '%s is typed in, not a placement category',
        c => {
            expect(isPlacementCategory(c, opts({ americas: true }))).toBe(false);
        },
    );
});

// ---------------------------------------------------------------------------

describe('players', () => {
    test('addPlayer creates an empty player', () => {
        gameStore.addPlayer('Anna', '#ff0000');
        const [p] = players();
        expect(p).toMatchObject({ name: 'Anna', color: '#ff0000', total: 0, leftoverFood: 0 });
        expect(p.scores).toEqual(emptyScores());
        expect(p.roundPlacements).toEqual(Array(ROUND_COUNT).fill(0));
        expect(p.nectarPlacements).toEqual(Array(HABITATS.length).fill(0));
    });

    test('player ids are unique', () => {
        const ids = addPlayers(MAX_PLAYERS);
        expect(new Set(ids).size).toBe(MAX_PLAYERS);
    });

    test(`up to ${MAX_PLAYERS} players (Asia flock mode); further adds are ignored`, () => {
        addPlayers(MAX_PLAYERS);
        expect(players()).toHaveLength(7);
        gameStore.addPlayer('Extra', '#fff');
        gameStore.addPlayer('Extra2', '#fff');
        expect(players()).toHaveLength(7);
        expect(players().some(p => p.name.startsWith('Extra'))).toBe(false);
    });

    test('solo game (1 player) is allowed', () => {
        addPlayers(1);
        expect(players()).toHaveLength(1);
    });

    test('removePlayer removes only that player', () => {
        const [a, b, c] = addPlayers(3);
        gameStore.removePlayer(b);
        expect(players().map(p => p.id)).toEqual([a, c]);
    });

    test('removing an unknown id is a no-op', () => {
        addPlayers(2);
        gameStore.removePlayer('nope');
        expect(players()).toHaveLength(2);
    });

    test('setStartPlayer', () => {
        const [, b] = addPlayers(2);
        gameStore.setStartPlayer(b);
        expect(state().startPlayerId).toBe(b);
    });
});

// ---------------------------------------------------------------------------

describe('updateScore & sanitizing', () => {
    test.each(['birds', 'bonus', 'eggs', 'food', 'tucked'] as const)('%s counts toward the total', c => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, c, 12);
        expect(player(a).scores[c]).toBe(12);
        expect(player(a).total).toBe(12);
    });

    test.each<[number, number]>([
        [-5, 0],
        [NaN, 0],
        [Infinity, 0],
        [3.7, 3],
        [0.2, 0],
        [42, 42],
    ])('input %d is stored as %d', (input, expected) => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'birds', input);
        expect(player(a).scores.birds).toBe(expected);
        expect(player(a).total).toBe(expected);
    });

    test('string-ish input from form fields is sanitized', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'eggs', '9' as unknown as number);
        expect(player(a).scores.eggs).toBe(9);
    });

    test('only the targeted player changes', () => {
        const [a, b] = addPlayers(2);
        gameStore.updateScore(a, 'birds', 30);
        expect(player(b).scores.birds).toBe(0);
        expect(player(b).total).toBe(0);
    });

    test('total is the sum of all category scores', () => {
        const [a] = addPlayers(1);
        gameStore.setOptions({ americas: true });
        gameStore.updateScore(a, 'birds', 41);
        gameStore.updateScore(a, 'bonus', 8);
        gameStore.updateScore(a, 'eggs', 14);
        gameStore.updateScore(a, 'food', 3);
        gameStore.updateScore(a, 'tucked', 9);
        gameStore.updateScore(a, 'hummingbirds', 4);
        gameStore.updateRoundPlacement(a, 0, 1);
        gameStore.updateNectarPlacement(a, 0, 1);
        expect(player(a).scores.round_goals).toBe(4);
        expect(player(a).scores.nectar).toBe(5);
        expect(player(a).total).toBe(41 + 8 + 14 + 3 + 9 + 4 + 4 + 5);
        expectTotalsConsistent();
    });

    test('overwriting a score replaces it (no accumulation)', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'birds', 10);
        gameStore.updateScore(a, 'birds', 7);
        expect(player(a).total).toBe(7);
    });

    test('setLeftoverFood sanitizes and does not affect the total', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'birds', 20);
        gameStore.setLeftoverFood(a, 3.9);
        expect(player(a).leftoverFood).toBe(3);
        gameStore.setLeftoverFood(a, -2);
        expect(player(a).leftoverFood).toBe(0);
        expect(player(a).total).toBe(20);
    });
});

// ---------------------------------------------------------------------------

describe('Americas hummingbird track', () => {
    test('negative hummingbird sums are kept and reduce the total', () => {
        gameStore.setOptions({ americas: true });
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'birds', 20);
        gameStore.updateScore(a, 'hummingbirds', -3);
        expect(player(a).scores.hummingbirds).toBe(-3);
        expect(player(a).total).toBe(17);
    });

    test('hummingbird input is truncated toward zero, NaN -> 0, never -0', () => {
        gameStore.setOptions({ americas: true });
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'hummingbirds', -2.8);
        expect(player(a).scores.hummingbirds).toBe(-2);
        gameStore.updateScore(a, 'hummingbirds', 5.9);
        expect(player(a).scores.hummingbirds).toBe(5);
        gameStore.updateScore(a, 'hummingbirds', NaN);
        expect(player(a).scores.hummingbirds).toBe(0);
        gameStore.updateScore(a, 'hummingbirds', -0.5);
        expect(Object.is(player(a).scores.hummingbirds, -0)).toBe(false);
    });

    test('other categories still clamp to >= 0 with Americas on', () => {
        gameStore.setOptions({ americas: true });
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'birds', -3);
        expect(player(a).scores.birds).toBe(0);
    });

    test('hummingbirds count 0 when Americas is off', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'hummingbirds', 6);
        expect(player(a).scores.hummingbirds).toBe(0);
        expect(player(a).total).toBe(0);
    });

    test('turning Americas off removes hummingbird points from the total', () => {
        gameStore.setOptions({ americas: true });
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'birds', 10);
        gameStore.updateScore(a, 'hummingbirds', -4);
        expect(player(a).total).toBe(6);
        gameStore.setOptions({ americas: false });
        expect(player(a).scores.hummingbirds).toBe(0);
        expect(player(a).total).toBe(10);
    });

    test('hummingbird track is personal: no interaction between players', () => {
        gameStore.setOptions({ americas: true });
        const [a, b] = addPlayers(2);
        gameStore.updateScore(a, 'hummingbirds', 5);
        gameStore.updateScore(b, 'hummingbirds', 5);
        expect(player(a).scores.hummingbirds).toBe(5);
        expect(player(b).scores.hummingbirds).toBe(5);
    });
});

// ---------------------------------------------------------------------------

describe('competitive round goals in the store', () => {
    test('placements are converted to points per round table', () => {
        const ids = addPlayers(3);
        setRound(ids, 0, [1, 2, 3]); // 4/1/0
        setRound(ids, 1, [2, 1, 3]); // 5/2/1
        setRound(ids, 2, [3, 2, 1]); // 6/3/2
        setRound(ids, 3, [1, 0, 2]); // 7/4/3
        expect(players().map(p => p.scores.round_goals)).toEqual([4 + 2 + 2 + 7, 1 + 5 + 3 + 0, 0 + 1 + 6 + 4]);
        expectTotalsConsistent();
    });

    test('ties: R1 two tie for 1st -> 2 each', () => {
        const ids = addPlayers(3);
        setRound(ids, 0, [1, 1, 3]);
        expect(players().map(p => p.scores.round_goals)).toEqual([2, 2, 0]);
    });

    test('ties: R4 three tie for 1st -> 4 each', () => {
        const ids = addPlayers(3);
        setRound(ids, 3, [1, 1, 1]);
        expect(players().map(p => p.scores.round_goals)).toEqual([4, 4, 4]);
    });

    test('ties: R2 1st + two tied 2nd -> 5,1,1', () => {
        const ids = addPlayers(3);
        setRound(ids, 1, [1, 2, 2]);
        expect(players().map(p => p.scores.round_goals)).toEqual([5, 1, 1]);
    });

    test('ties: R4 four tied for 1st -> 3 each', () => {
        const ids = addPlayers(4);
        setRound(ids, 3, [1, 1, 1, 1]);
        expect(players().map(p => p.scores.round_goals)).toEqual([3, 3, 3, 3]);
    });

    test('invalid rows are flagged and score 0 for that round', () => {
        const ids = addPlayers(3);
        setRound(ids, 0, [1, 2, 3]);
        setRound(ids, 1, [2, 0, 0]); // 2nd without 1st
        setRound(ids, 2, [1, 3, 0]); // 3rd with only one 1st
        expect(validateRoundGoalsRow(players(), 0)).toBe(true);
        expect(validateRoundGoalsRow(players(), 1)).toBe(false);
        expect(validateRoundGoalsRow(players(), 2)).toBe(false);
        expect(validateRoundGoalsRow(players(), 3)).toBe(true);
        expect(validateAllRoundGoals(players())).toBe(false);
        expect(players().map(p => p.scores.round_goals)).toEqual([4, 1, 0]);
    });

    test('rank beyond the points table is invalid', () => {
        const ids = addPlayers(4);
        setRound(ids, 0, [1, 2, 3, 4]);
        expect(validateRoundGoalsRow(players(), 0)).toBe(false);
        expect(players().every(p => p.scores.round_goals === 0)).toBe(true);
    });

    test('fixing an invalid row restores points', () => {
        const ids = addPlayers(2);
        setRound(ids, 0, [2, 0]);
        expect(players()[0].scores.round_goals).toBe(0);
        gameStore.updateRoundPlacement(ids[1], 0, 1);
        expect(players().map(p => p.scores.round_goals)).toEqual([1, 4]);
        expect(validateAllRoundGoals(players())).toBe(true);
    });

    test('typed round_goals are overwritten by placements in competitive mode', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'round_goals', 99);
        expect(player(a).scores.round_goals).toBe(0);
    });

    test('resetAllRoundPlacements clears placements and points', () => {
        const ids = addPlayers(2);
        setRound(ids, 0, [1, 2]);
        setRound(ids, 3, [2, 1]);
        gameStore.resetAllRoundPlacements();
        for (const p of players()) {
            expect(p.roundPlacements).toEqual([0, 0, 0, 0]);
            expect(p.scores.round_goals).toBe(0);
        }
        expectTotalsConsistent();
    });

    test('removing a player recomputes the others (tie broken up)', () => {
        const [a, b, c] = addPlayers(3);
        setRound([a, b, c], 3, [1, 1, 3]); // 5,5,3
        expect(players().map(p => p.scores.round_goals)).toEqual([5, 5, 3]);
        gameStore.removePlayer(c);
        // a and b still tie for 1st -> floor((7+4)/2) = 5
        expect(players().map(p => p.scores.round_goals)).toEqual([5, 5]);
        gameStore.setOptions({}); // no-op recompute
        gameStore.removePlayer(b);
        // a alone "tied" with nobody now gets 1st place points
        expect(player(a).scores.round_goals).toBe(7);
        expectTotalsConsistent();
    });

    test('removing the 1st place player makes a row invalid -> 0 for remaining', () => {
        const [a, b, c] = addPlayers(3);
        setRound([a, b, c], 0, [1, 2, 3]);
        gameStore.removePlayer(a);
        expect(validateRoundGoalsRow(players(), 0)).toBe(false);
        expect(players().map(p => p.scores.round_goals)).toEqual([0, 0]);
        expectTotalsConsistent();
    });

    test('totals stay consistent for many random placement edits', () => {
        const ids = addPlayers(5);
        let seed = 7;
        const rnd = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let i = 0; i < 200; i++) {
            const id = ids[rnd(ids.length)];
            gameStore.updateRoundPlacement(id, rnd(ROUND_COUNT), rnd(4));
            gameStore.updateNectarPlacement(id, rnd(HABITATS.length), rnd(3));
            gameStore.updateScore(id, 'birds', rnd(50));
            expectTotalsConsistent();
            for (const p of players()) {
                expect(p.scores.round_goals).toBeGreaterThanOrEqual(0);
                expect(p.scores.round_goals).toBeLessThanOrEqual(22);
                expect(p.scores.nectar).toBeGreaterThanOrEqual(0);
                expect(p.scores.nectar).toBeLessThanOrEqual(15);
            }
        }
    });
});

describe('casual (blue side) round goals in the store', () => {
    beforeEach(() => gameStore.setOptions({ roundGoalMode: 'casual' }));

    test('round_goals is a manually typed number', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'round_goals', 13);
        expect(player(a).scores.round_goals).toBe(13);
        expect(player(a).total).toBe(13);
    });

    test('placements do not override the typed value', () => {
        const ids = addPlayers(2);
        gameStore.updateScore(ids[0], 'round_goals', 9);
        setRound(ids, 0, [2, 1]);
        expect(player(ids[0]).scores.round_goals).toBe(9);
        expect(player(ids[1]).scores.round_goals).toBe(0);
    });

    test('typed value is sanitized', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'round_goals', -4);
        expect(player(a).scores.round_goals).toBe(0);
        gameStore.updateScore(a, 'round_goals', 6.6);
        expect(player(a).scores.round_goals).toBe(6);
    });

    test('switching back to competitive recomputes from placements', () => {
        const ids = addPlayers(2);
        gameStore.updateScore(ids[0], 'round_goals', 9);
        setRound(ids, 0, [1, 2]);
        gameStore.setOptions({ roundGoalMode: 'competitive' });
        expect(players().map(p => p.scores.round_goals)).toEqual([4, 1]);
        expectTotalsConsistent();
    });
});

// ---------------------------------------------------------------------------

describe('Oceania nectar in the store', () => {
    test('most nectar 5, second 2 per habitat', () => {
        const ids = addPlayers(3);
        setHabitat(ids, 0, [1, 2, 0]);
        setHabitat(ids, 1, [2, 1, 0]);
        setHabitat(ids, 2, [0, 2, 1]);
        expect(players().map(p => p.scores.nectar)).toEqual([5 + 2, 2 + 5 + 2, 5]);
        expectTotalsConsistent();
    });

    test('two tie for first -> 3 each; two tie for second -> 1 each', () => {
        const ids = addPlayers(3);
        setHabitat(ids, 0, [1, 1, 0]);
        setHabitat(ids, 1, [1, 2, 2]);
        expect(players().map(p => p.scores.nectar)).toEqual([3 + 5, 3 + 1, 0 + 1]);
    });

    test('3rd place in nectar is invalid', () => {
        const ids = addPlayers(3);
        setHabitat(ids, 0, [1, 2, 3]);
        expect(validateNectarRow(players(), 0)).toBe(false);
        expect(validateAllNectar(players())).toBe(false);
        expect(players().every(p => p.scores.nectar === 0)).toBe(true);
    });

    test('nectar only counts when Oceania is on', () => {
        const ids = addPlayers(2);
        setHabitat(ids, 0, [1, 2]);
        expect(players().map(p => p.total)).toEqual([5, 2]);
        gameStore.setOptions({ oceania: false });
        expect(players().map(p => p.scores.nectar)).toEqual([0, 0]);
        expect(players().map(p => p.total)).toEqual([0, 0]);
        // placements are kept and count again once Oceania is re-enabled
        gameStore.setOptions({ oceania: true });
        expect(players().map(p => p.scores.nectar)).toEqual([5, 2]);
    });

    test('typed nectar score is ignored (always derived)', () => {
        const [a] = addPlayers(1);
        gameStore.updateScore(a, 'nectar', 10);
        expect(player(a).scores.nectar).toBe(0);
        gameStore.setOptions({ oceania: false });
        gameStore.updateScore(a, 'nectar', 10);
        expect(player(a).scores.nectar).toBe(0);
    });

    test('resetAllNectarPlacements clears placements and points', () => {
        const ids = addPlayers(2);
        setHabitat(ids, 2, [1, 2]);
        gameStore.resetAllNectarPlacements();
        for (const p of players()) {
            expect(p.nectarPlacements).toEqual([0, 0, 0]);
            expect(p.scores.nectar).toBe(0);
        }
        expectTotalsConsistent();
    });

    test('removing a player recomputes nectar for the others', () => {
        const [a, b, c] = addPlayers(3);
        setHabitat([a, b, c], 0, [1, 2, 2]); // 5,1,1
        expect(players().map(p => p.scores.nectar)).toEqual([5, 1, 1]);
        gameStore.removePlayer(c);
        expect(players().map(p => p.scores.nectar)).toEqual([5, 2]);
    });
});

// ---------------------------------------------------------------------------

describe('recompute (pure)', () => {
    function mkPlayer(over: Partial<Player>): Player {
        return {
            id: Math.random().toString(36),
            name: 'x',
            color: '#000',
            roundPlacements: [0, 0, 0, 0],
            nectarPlacements: [0, 0, 0],
            scores: emptyScores(),
            total: 0,
            leftoverFood: 0,
            ...over,
        };
    }

    test('does not mutate its input', () => {
        const p = mkPlayer({ roundPlacements: [1, 0, 0, 0], scores: { ...emptyScores(), birds: 3 } });
        const before = JSON.stringify(p);
        const [out] = recompute([p], { ...DEFAULT_OPTIONS });
        expect(JSON.stringify(p)).toBe(before);
        expect(out.total).toBe(3 + 4);
    });

    test('stale totals are always replaced by the category sum', () => {
        const p = mkPlayer({ total: 999, scores: { ...emptyScores(), eggs: 5 } });
        expect(recompute([p], { ...DEFAULT_OPTIONS })[0].total).toBe(5);
    });

    test('all option combinations keep total = sum of scores', () => {
        const base = [
            mkPlayer({ roundPlacements: [1, 1, 2, 1], nectarPlacements: [1, 0, 2], scores: { ...emptyScores(), birds: 30, round_goals: 8, hummingbirds: -2 } }),
            mkPlayer({ roundPlacements: [2, 1, 1, 0], nectarPlacements: [2, 1, 1], scores: { ...emptyScores(), birds: 25, hummingbirds: 3 } }),
        ];
        for (const roundGoalMode of ['competitive', 'casual'] as const) {
            for (const oceania of [true, false]) {
                for (const americas of [true, false]) {
                    const out = recompute(base, { roundGoalMode, oceania, americas });
                    for (const p of out) expect(p.total).toBe(sumScores(p.scores));
                    if (!oceania) expect(out.every(p => p.scores.nectar === 0)).toBe(true);
                    if (!americas) expect(out.every(p => p.scores.hummingbirds === 0)).toBe(true);
                    if (americas) expect(out.map(p => p.scores.hummingbirds)).toEqual([-2, 3]);
                    if (roundGoalMode === 'casual') expect(out.map(p => p.scores.round_goals)).toEqual([8, 0]);
                    else expect(out.map(p => p.scores.round_goals)).toEqual([4 + 3 + 3 + 7, 1 + 3 + 6 + 0]);
                }
            }
        }
    });
});

// ---------------------------------------------------------------------------

describe('navigation', () => {
    test('setPhase', () => {
        gameStore.setPhase('SCORING');
        expect(state().currentPhase).toBe('SCORING');
    });

    test.each<[string, Partial<GameOptions>]>([
        ['base', { oceania: false, americas: false }],
        ['Oceania', { oceania: true, americas: false }],
        ['Oceania + Americas', { oceania: true, americas: true }],
    ])('nextCategory walks all active categories then goes to RESULT (%s)', (_, o) => {
        gameStore.setOptions(o);
        gameStore.setPhase('SCORING');
        const n = activeCategories(state().options).length;
        for (let i = 0; i < n - 1; i++) {
            expect(state().currentScoringCategoryIndex).toBe(i);
            gameStore.nextCategory();
            expect(state().currentPhase).toBe('SCORING');
        }
        expect(state().currentScoringCategoryIndex).toBe(n - 1);
        gameStore.nextCategory();
        expect(state().currentPhase).toBe('RESULT');
    });

    test('prevCategory steps back and returns to SETUP from the first category', () => {
        gameStore.setPhase('SCORING');
        gameStore.nextCategory();
        gameStore.nextCategory();
        expect(state().currentScoringCategoryIndex).toBe(2);
        gameStore.prevCategory();
        expect(state().currentScoringCategoryIndex).toBe(1);
        gameStore.prevCategory();
        expect(state().currentScoringCategoryIndex).toBe(0);
        gameStore.prevCategory();
        expect(state().currentPhase).toBe('SETUP');
        expect(state().currentScoringCategoryIndex).toBe(0);
    });

    test.each<[Partial<GameOptions>, number]>([
        [{ oceania: false, americas: false }, 6],
        [{ oceania: true, americas: false }, 7],
        [{ oceania: false, americas: true }, 7],
        [{ oceania: true, americas: true }, 8],
    ])('backToScoring returns to the last active category (%j)', (o, count) => {
        gameStore.setOptions(o);
        gameStore.setPhase('RESULT');
        gameStore.backToScoring();
        expect(state().currentPhase).toBe('SCORING');
        expect(state().currentScoringCategoryIndex).toBe(count - 1);
    });
});

describe('resetGame', () => {
    test('clears players and phase but keeps options', () => {
        gameStore.setOptions({ roundGoalMode: 'casual', oceania: false, americas: true });
        const [a] = addPlayers(3);
        gameStore.setStartPlayer(a);
        gameStore.setPhase('RESULT');
        const oldId = state().gameId;
        gameStore.resetGame();
        const s = state();
        expect(s.players).toEqual([]);
        expect(s.currentPhase).toBe('SETUP');
        expect(s.currentScoringCategoryIndex).toBe(0);
        expect(s.startPlayerId).toBeNull();
        expect(s.gameId).not.toBe(oldId);
        expect(s.options).toEqual({ roundGoalMode: 'casual', oceania: false, americas: true });
    });
});
