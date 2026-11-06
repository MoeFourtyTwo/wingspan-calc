import { describe, expect, test } from 'vitest';
import { restoreGame, DEFAULT_OPTIONS, type GameState } from './store';

const player = (over: Record<string, unknown> = {}) => ({
    id: 'a',
    name: 'Anna',
    color: '#fff',
    roundPlacements: [1, 1, 1, 1],
    nectarPlacements: [1, 0, 0],
    scores: { birds: 30, bonus: 5, round_goals: 999, eggs: 4, food: 2, tucked: 3, nectar: 999, hummingbirds: 0 },
    total: 12345,
    leftoverFood: 2,
    ...over,
});

const game = (over: Partial<GameState> | Record<string, unknown> = {}) => ({
    gameId: 'g1',
    players: [player()],
    currentPhase: 'SCORING',
    currentScoringCategoryIndex: 3,
    startPlayerId: 'a',
    options: DEFAULT_OPTIONS,
    ...over,
});

describe('restoreGame (resume an interrupted game)', () => {
    test.each([null, undefined, 42, 'x', {}, { gameId: 'g', players: 'nope', currentPhase: 'SCORING' }])(
        'rejects malformed data %#',
        raw => expect(restoreGame(raw)).toBeNull(),
    );

    test('rejects unknown phases', () => {
        expect(restoreGame(game({ currentPhase: 'HACKED' }))).toBeNull();
    });

    test('recomputes derived scores and totals instead of trusting stored ones', () => {
        const s = restoreGame(game())!;
        const p = s.players[0];
        expect(p.scores.round_goals).toBe(4 + 5 + 6 + 7);
        expect(p.scores.nectar).toBe(5);
        expect(p.total).toBe(30 + 5 + 22 + 4 + 2 + 3 + 5);
    });

    test('sanitizes values and fills missing fields from older versions', () => {
        const s = restoreGame(
            game({
                options: { oceania: false },
                players: [player({ scores: { birds: -5, eggs: 'x' }, roundPlacements: undefined, leftoverFood: -1 })],
            }),
        )!;
        const p = s.players[0];
        expect(s.options).toEqual({ ...DEFAULT_OPTIONS, oceania: false });
        expect(p.scores.birds).toBe(0);
        expect(p.scores.eggs).toBe(0);
        expect(p.scores.hummingbirds).toBe(0);
        expect(p.roundPlacements).toEqual([0, 0, 0, 0]);
        expect(p.leftoverFood).toBe(0);
    });

    test('keeps negative hummingbird scores when Americas is on', () => {
        const s = restoreGame(
            game({
                options: { ...DEFAULT_OPTIONS, americas: true },
                players: [player({ scores: { hummingbirds: -3 } })],
            }),
        )!;
        expect(s.players[0].scores.hummingbirds).toBe(-3);
    });

    test('clamps the category index and drops a dangling start player', () => {
        const s = restoreGame(game({ currentScoringCategoryIndex: 99, startPlayerId: 'ghost' }))!;
        expect(s.currentScoringCategoryIndex).toBe(6); // 7 categories without Americas
        expect(s.startPlayerId).toBeNull();
    });

    test('a game without players resumes in setup', () => {
        expect(restoreGame(game({ players: [] }))!.currentPhase).toBe('SETUP');
    });

    test('drops invalid player entries and caps at 7 players', () => {
        const many = Array.from({ length: 9 }, (_, i) => player({ id: `p${i}` }));
        const s = restoreGame(game({ players: [null, { id: 1 }, ...many] }))!;
        expect(s.players).toHaveLength(7);
    });
});
