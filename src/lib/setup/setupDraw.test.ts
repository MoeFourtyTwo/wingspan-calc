import { describe, expect, test } from 'vitest';
import { GOAL_TILES } from '../data/goalTiles';
import { TOKENS, renderTokens } from '../data/tokens';
import { SETS, type CardSet } from '../data/types';
import { ROUND_COUNT, applyHouseRules, drawSetup, goalTilePool, isNoGoal, redrawGoal, seededRng, shuffle, type SetupDraw } from './setupDraw';
import { flipGoal } from './setupRecord';
import { defaultPrefs, parsePrefs } from './setupPrefs';

const ALL: CardSet[] = [...SETS];

describe('goal tiles', () => {
    test('unique ids and two filled sides each', () => {
        expect(new Set(GOAL_TILES.map(t => t.id)).size).toBe(GOAL_TILES.length);
        for (const t of GOAL_TILES) for (const s of t.sides) expect(s.en && s.de).toBeTruthy();
    });

    test('tile counts per set (Asia has only duet tiles, which are excluded)', () => {
        const count = (s: CardSet) => goalTilePool([s]).length;
        expect(count('core')).toBe(8);
        expect(count('european')).toBe(5);
        expect(count('oceania')).toBe(4);
        expect(count('asia')).toBe(0);
        expect(count('americas')).toBe(5);
    });

    test('every icon token used in goal texts can be rendered in both languages', () => {
        for (const text of GOAL_TILES.flatMap(t => t.sides.flatMap(s => [s.en, s.de]))) {
            for (const [, key] of text.matchAll(/\[([a-z_-]+)\]/g)) expect(TOKENS, `${key} in "${text}"`).toHaveProperty(key);
        }
    });
});

describe('drawSetup', () => {
    test('draws 4 distinct goals with a valid side', () => {
        for (let seed = 1; seed <= 300; seed++) {
            const r = drawSetup(ALL, seededRng(seed));
            if (!r.ok) throw new Error(r.error);
            expect(r.draw.goals).toHaveLength(ROUND_COUNT);
            expect(new Set(r.draw.goals.map(g => g.tile.id)).size).toBe(ROUND_COUNT);
            expect(r.draw.goals.every(g => g.side === 0 || g.side === 1)).toBe(true);
        }
    });

    test('only uses tiles of the selected sets', () => {
        for (let seed = 1; seed <= 100; seed++) {
            const r = drawSetup(['core', 'oceania'], seededRng(seed));
            if (!r.ok) throw new Error(r.error);
            for (const g of r.draw.goals) expect(['core', 'oceania']).toContain(g.tile.set);
        }
    });

    test('is deterministic for a seed', () => {
        expect(drawSetup(ALL, seededRng(42))).toEqual(drawSetup(ALL, seededRng(42)));
    });

    test('both sides of every core tile come up over many draws', () => {
        const seen = new Set<string>();
        for (let seed = 1; seed <= 300; seed++) {
            const r = drawSetup(['core'], seededRng(seed));
            if (r.ok) r.draw.goals.forEach(g => seen.add(`${g.tile.id}:${g.side}`));
        }
        expect(seen.size).toBe(16);
    });

    test('Asia alone has no goal tiles for the normal game', () => {
        expect(drawSetup(['asia'])).toEqual({ ok: false, error: 'not-enough-goals' });
    });

    test('redrawGoal replaces one round with an unused tile', () => {
        const r = drawSetup(['core'], seededRng(7));
        if (!r.ok) throw new Error(r.error);
        for (let seed = 1; seed <= 50; seed++) {
            const next = redrawGoal(r.draw, 2, ['core'], seededRng(seed));
            expect(next.goals[0]).toBe(r.draw.goals[0]);
            expect(next.goals[1]).toBe(r.draw.goals[1]);
            expect(next.goals[3]).toBe(r.draw.goals[3]);
            expect(new Set(next.goals.map(g => g.tile.id)).size).toBe(4);
        }
    });

    test('redrawGoal keeps the draw when no unused tile is left', () => {
        const fourTiles = GOAL_TILES.filter(t => t.set === 'oceania');
        const draw = { goals: fourTiles.map(tile => ({ tile, side: 0 as const })) };
        expect(redrawGoal(draw, 1, ['oceania'])).toBe(draw);
    });
});

describe('helpers', () => {
    test('shuffle keeps all elements', () => {
        const items = Array.from({ length: 30 }, (_, i) => i);
        expect(shuffle(items, seededRng(3)).sort((a, b) => a - b)).toEqual(items);
    });

    test('seededRng stays within [0, 1)', () => {
        const rng = seededRng(99);
        for (let i = 0; i < 1000; i++) {
            const x = rng();
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(1);
        }
    });

    test('renderTokens', () => {
        expect(renderTokens('Birds in [forest]', 'en')).toBe('Birds in forest');
        expect(renderTokens('Vögel mit Wert ≤ 3 [point]', 'de')).toBe('Vögel mit Wert ≤ 3 Pkt.');
        expect(renderTokens('Vögel mit [cavity] Nest', 'de')).toBe('Vögel mit Höhlennest');
        expect(renderTokens('[unknown] x', 'en')).toBe('[unknown] x');
    });
});

describe('setup preferences', () => {
    test('defaults to the core game', () => {
        expect(defaultPrefs()).toEqual({ sets: ['core'], noGoalFirstRound: false });
    });

    test('parses stored values, drops garbage and old fields', () => {
        expect(parsePrefs({ sets: ['oceania', 'nope', 'core'], edition: 'en', applyEditionRemovals: false })).toEqual({
            sets: ['core', 'oceania'],
            noGoalFirstRound: false,
        });
        expect(parsePrefs({ sets: ['oceania'], noGoalFirstRound: true })).toEqual({ sets: ['oceania'], noGoalFirstRound: true });
        expect(parsePrefs({ sets: ['core'], noGoalFirstRound: 'yes' }).noGoalFirstRound).toBe(false);
        expect(parsePrefs({ sets: [] })).toEqual(defaultPrefs());
        expect(parsePrefs({ sets: ['asia'] })).toEqual(defaultPrefs()); // Asia has no normal goal tiles
        expect(parsePrefs('garbage')).toEqual(defaultPrefs());
    });
});

describe('house rule: "No goal" only in round 1', () => {
    const SETS_WITH_NO_GOAL: CardSet[] = ['core', 'european', 'oceania'];
    const RULE = { noGoalFirstRound: true };
    const ids = (d: SetupDraw) => d.goals.map(g => `${g.tile.id}:${g.side}`);
    const draw = (seed: number, rules = {}) => {
        const r = drawSetup(SETS_WITH_NO_GOAL, seededRng(seed), rules);
        if (!r.ok) throw new Error(r.error);
        return r.draw;
    };

    test('the "No goal" side is marked in the data', () => {
        const marked = GOAL_TILES.flatMap(t => t.sides.map((s, i) => (s.noGoal ? `${t.id}:${i}` : null))).filter(Boolean);
        expect(marked).toEqual(['oc-nogoal:1']);
    });

    test('same goals and sides as without the rule – only the order may change', () => {
        let swapped = 0;
        for (let seed = 1; seed <= 3000; seed++) {
            const plain = draw(seed);
            const ruled = draw(seed, RULE);
            expect([...ids(ruled)].sort()).toEqual([...ids(plain)].sort());
            if (ids(ruled).join() !== ids(plain).join()) swapped++;
        }
        expect(swapped).toBeGreaterThan(0); // the rule did kick in
    });

    test('so "No goal" is in the game exactly as often as without the rule', () => {
        let plain = 0;
        let ruled = 0;
        for (let seed = 1; seed <= 3000; seed++) {
            if (draw(seed).goals.some(isNoGoal)) plain++;
            if (draw(seed, RULE).goals.some(isNoGoal)) ruled++;
        }
        expect(ruled).toBe(plain);
        expect(plain).toBeGreaterThan(0);
    });

    test('"No goal" never ends up in rounds 2–4 with the rule', () => {
        let inRound1 = 0;
        for (let seed = 1; seed <= 3000; seed++) {
            const d = draw(seed, RULE);
            expect(d.goals.slice(1).some(isNoGoal)).toBe(false);
            if (isNoGoal(d.goals[0])) inRound1++;
        }
        expect(inRound1).toBeGreaterThan(0);
    });

    test('a swap only exchanges round 1 with the round "No goal" was drawn for', () => {
        for (let seed = 1; seed <= 3000; seed++) {
            const plain = draw(seed);
            const at = plain.goals.findIndex(isNoGoal);
            if (at <= 0) continue;
            const ruled = applyHouseRules(plain, RULE);
            expect(ruled.goals[0]).toBe(plain.goals[at]);
            expect(ruled.goals[at]).toBe(plain.goals[0]);
            for (let i = 1; i < 4; i++) if (i !== at) expect(ruled.goals[i]).toBe(plain.goals[i]);
            return;
        }
        throw new Error('no seed drew "No goal" after round 1');
    });

    test('no change without the rule, without "No goal", or when it is already in round 1', () => {
        const d = draw(1);
        expect(applyHouseRules(d)).toBe(d);
        expect(applyHouseRules(d, { noGoalFirstRound: false })).toBe(d);
        const noGoal = GOAL_TILES.find(t => t.id === 'oc-nogoal')!;
        const first = { goals: [{ tile: noGoal, side: 1 as const }, ...d.goals.slice(1).filter(g => g.tile.id !== 'oc-nogoal')] };
        if (first.goals.length === 4) expect(applyHouseRules(first, RULE)).toBe(first);
        const otherSide = { goals: d.goals.map((g, i) => (i === 2 ? { tile: noGoal, side: 0 as const } : g)) };
        expect(applyHouseRules(otherSide, RULE)).toBe(otherSide); // the rodent + fish side is a normal goal
    });

    test('re-drawing a later round that lands on "No goal" moves it to round 1', () => {
        const noGoal = GOAL_TILES.find(t => t.id === 'oc-nogoal')!;
        const start = { goals: goalTilePool(['core']).slice(0, 4).map(tile => ({ tile, side: 0 as const })) };
        // a pool where the only unused tile is the Oceania one, and an rng that picks its "No goal" side
        const sets: CardSet[] = ['core', 'oceania'];
        const free = goalTilePool(sets).filter(t => !start.goals.some(g => g.tile.id === t.id));
        const pick = free.indexOf(noGoal);
        const rng = (() => {
            const seq = [(pick + 0.5) / free.length, 0.99];
            let i = 0;
            return () => seq[i++ % seq.length];
        })();
        const next = redrawGoal(start, 2, sets, rng, RULE);
        expect(isNoGoal(next.goals[0])).toBe(true);
        expect(next.goals[2]).toBe(start.goals[0]);
        expect(next.goals[1]).toBe(start.goals[1]);
        expect(next.goals[3]).toBe(start.goals[3]);
    });

    test('flipping the tile to "No goal" in a later round moves it to round 1', () => {
        const noGoal = GOAL_TILES.find(t => t.id === 'oc-nogoal')!;
        const others = goalTilePool(['core']).slice(0, 3).map(tile => ({ tile, side: 0 as const }));
        const d = { goals: [others[0], others[1], { tile: noGoal, side: 0 as const }, others[2]] };
        const flipped = applyHouseRules(flipGoal(d, 2), RULE);
        expect(isNoGoal(flipped.goals[0])).toBe(true);
        expect(flipped.goals[2]).toBe(others[0]);
    });
});
