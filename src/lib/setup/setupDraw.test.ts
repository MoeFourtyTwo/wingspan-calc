import { describe, expect, test } from 'vitest';
import { GOAL_TILES } from '../data/goalTiles';
import { TOKENS, renderTokens } from '../data/tokens';
import { SETS, type CardSet } from '../data/types';
import { ROUND_COUNT, drawSetup, goalTilePool, redrawGoal, seededRng, shuffle } from './setupDraw';
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
        expect(defaultPrefs()).toEqual({ sets: ['core'] });
    });

    test('parses stored values, drops garbage and old fields', () => {
        expect(parsePrefs({ sets: ['oceania', 'nope', 'core'], edition: 'en', applyEditionRemovals: false })).toEqual({
            sets: ['core', 'oceania'],
        });
        expect(parsePrefs({ sets: [] })).toEqual(defaultPrefs());
        expect(parsePrefs({ sets: ['asia'] })).toEqual(defaultPrefs()); // Asia has no normal goal tiles
        expect(parsePrefs('garbage')).toEqual(defaultPrefs());
    });
});
