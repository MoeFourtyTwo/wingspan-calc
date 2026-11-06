import { describe, expect, test } from 'vitest';
import { drawSetup, seededRng } from './setupDraw';
import { flipGoal, fromRecord, goalCaptions, toRecord, toggleSet, withGameOptions } from './setupRecord';
import { restoreGame, DEFAULT_OPTIONS } from '../store';

const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

function draw(seed = 1) {
    const r = drawSetup({ sets: ['core', 'european'], edition: 'de', playerCount: players.length, rng: seededRng(seed) });
    if (!r.ok) throw new Error(r.error);
    return r.draw;
}

describe('toRecord / fromRecord', () => {
    test('round-trips a draw by ids', () => {
        const d = draw();
        const rec = toRecord(d, players);
        expect(rec.goals).toHaveLength(4);
        expect(Object.keys(rec.bonus)).toEqual(['a', 'b', 'c']);
        expect(rec.bonus.b).toEqual(d.bonus[1].map(c => c.id));
        expect(fromRecord(rec, players)).toEqual(d);
    });

    test('survives the JSON + restoreGame round-trip of the game store', () => {
        const d = draw(7);
        const rec = toRecord(d, players);
        const raw = JSON.parse(
            JSON.stringify({
                gameId: 'g',
                currentPhase: 'DRAW',
                currentScoringCategoryIndex: 0,
                startPlayerId: 'a',
                options: DEFAULT_OPTIONS,
                setup: rec,
                players: players.map(p => ({ ...p, name: p.id, color: '#fff' })),
            }),
        );
        expect(fromRecord(restoreGame(raw)!.setup, players)).toEqual(d);
    });

    test('returns null when the record does not fit', () => {
        const rec = toRecord(draw(), players);
        expect(fromRecord(null, players)).toBeNull();
        expect(fromRecord(rec, [])).toBeNull();
        expect(fromRecord(rec, [...players, { id: 'new' }])).toBeNull();
        expect(fromRecord({ ...rec, goals: rec.goals.slice(0, 3) }, players)).toBeNull();
        expect(fromRecord({ ...rec, goals: rec.goals.map((g, i) => (i ? g : { ...g, tileId: 'nope' })) }, players)).toBeNull();
        expect(fromRecord({ ...rec, bonus: { ...rec.bonus, a: [rec.bonus.a[0], 424242] } }, players)).toBeNull();
    });
});

describe('flipGoal', () => {
    test('turns only the given tile over and does not mutate', () => {
        const d = draw();
        const f = flipGoal(d, 2);
        expect(f.goals[2].side).toBe(1 - d.goals[2].side);
        expect(f.goals[2].tile).toBe(d.goals[2].tile);
        expect(f.goals.filter((_, i) => i !== 2)).toEqual(d.goals.filter((_, i) => i !== 2));
        expect(flipGoal(f, 2)).toEqual(d);
    });
});

describe('set selection helpers', () => {
    test('withGameOptions adds Oceania / Americas in canonical order', () => {
        expect(withGameOptions(['core'], { oceania: true, americas: false })).toEqual(['core', 'oceania']);
        expect(withGameOptions(['americas', 'core'], { oceania: true, americas: true })).toEqual(['core', 'oceania', 'americas']);
        expect(withGameOptions(['european'], { oceania: false, americas: false })).toEqual(['european']);
    });

    test('toggleSet adds/removes but never empties the selection', () => {
        expect(toggleSet(['core'], 'asia')).toEqual(['core', 'asia']);
        expect(toggleSet(['core', 'asia'], 'core')).toEqual(['asia']);
        expect(toggleSet(['asia'], 'asia')).toEqual(['asia']);
        expect(toggleSet(['oceania'], 'core')).toEqual(['core', 'oceania']);
    });
});

describe('goalCaptions', () => {
    const rec = {
        goals: [
            { tileId: 'core-forest', side: 0 as const },
            { tileId: 'core-forest', side: 1 as const },
            { tileId: 'oc-food', side: 0 as const },
            { tileId: 'gone', side: 0 as const },
        ],
        bonus: {},
    };

    test('renders the face-up side in the card edition', () => {
        expect(goalCaptions(rec, 'de')).toEqual([
            'Vögel im Wald',
            'Eier im Wald',
            'Früchte + Samen in den Futterkosten deiner Vögel',
            null,
        ]);
        expect(goalCaptions(rec, 'en')[1]).toBe('Eggs in forest');
    });

    test('no setup -> no captions', () => {
        expect(goalCaptions(null, 'en')).toEqual([null, null, null, null]);
    });
});
