import { describe, expect, test } from 'vitest';
import { BONUS_CARDS } from '../data/bonusCards';
import { GOAL_TILES } from '../data/goalTiles';
import { TOKENS, renderTokens } from '../data/tokens';
import { SETS, type CardSet } from '../data/types';
import {
    BONUS_CARDS_PER_PLAYER,
    GERMAN_EDITION_REMOVALS,
    ROUND_COUNT,
    bonusCardPool,
    drawSetup,
    germanEditionRemovals,
    goalTilePool,
    localized,
    redrawGoal,
    removalKey,
    seededRng,
    shuffle,
} from './setupDraw';
import { defaultPrefs, parsePrefs } from './setupPrefs';

const ALL: CardSet[] = [...SETS];
const byName = (en: string) => BONUS_CARDS.find(c => c.name.en === en)!;

/** All non-empty subsets of the sets. */
function subsets(items: readonly CardSet[]): CardSet[][] {
    const out: CardSet[][] = [];
    for (let mask = 1; mask < 1 << items.length; mask++) out.push(items.filter((_, i) => mask & (1 << i)));
    return out;
}

describe('bonus card database', () => {
    test('ids are unique and every card has English texts', () => {
        expect(new Set(BONUS_CARDS.map(c => c.id)).size).toBe(BONUS_CARDS.length);
        for (const c of BONUS_CARDS) {
            expect(c.name.en, String(c.id)).toBeTruthy();
            expect(c.condition.en, String(c.id)).toBeTruthy();
            expect(c.vp.en, String(c.id)).toBeTruthy();
            expect(SETS).toContain(c.set);
        }
    });

    test('contains no fan-made or Automa-only cards', () => {
        for (const c of BONUS_CARDS) expect(c.name.en).not.toMatch(/^\[|automa|fan made/i);
    });

    test('card counts per set', () => {
        const count = (s: CardSet) => BONUS_CARDS.filter(c => c.set === s).length;
        expect(count('core')).toBe(26);
        expect(count('european')).toBe(5);
        expect(count('oceania')).toBe(5);
        expect(count('asia')).toBe(11);
        expect(count('americas')).toBe(8);
    });

    test('every card except the Americas ones has a German edition text', () => {
        for (const c of BONUS_CARDS.filter(c => c.set !== 'americas')) {
            expect(c.name.de, c.name.en).toBeTruthy();
            expect(c.condition.de, c.name.en).toBeTruthy();
            expect(c.vp.de, c.name.en).toBeTruthy();
        }
    });

    test('German edition replaced name-based cards (language dependent)', () => {
        const historian = byName('Historian');
        expect(historian.name.de).toBe('Biologe');
        expect(historian.condition.en).toMatch(/named after a person/i);
        expect(historian.condition.de).toMatch(/Pflanzen- oder Tiernamen/);
        expect(byName('Anatomist').name.de).toBe('Morphologe');
        expect(byName('Cartographer').name.de).toBe('Geograf');
    });

    test('German Photographer scores differently than the English one', () => {
        const p = byName('Photographer');
        expect(p.vp.en).toContain('4 to 5 birds: 3[point]');
        expect(p.vp.de).toContain('4 - 5 Vögel: 4[point]');
    });

    test('every icon token used in card texts can be rendered in both languages', () => {
        const texts = [
            ...BONUS_CARDS.flatMap(c => [c.condition.en, c.condition.de, c.vp.en, c.vp.de]),
            ...GOAL_TILES.flatMap(t => t.sides.flatMap(s => [s.en, s.de])),
        ].filter((s): s is string => !!s);
        for (const text of texts) {
            for (const [, key] of text.matchAll(/\[([a-z_-]+)\]/g)) expect(TOKENS, `${key} in "${text}"`).toHaveProperty(key);
        }
    });
});

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
});

describe('German edition removal table (Feuerland)', () => {
    test('key ignores Americas, duplicates and order', () => {
        expect(removalKey(['oceania', 'core', 'americas', 'core'])).toBe('core+oceania');
    });

    test.each(Object.entries(GERMAN_EDITION_REMOVALS))('%s removes only known name-based cards', (_, ids) => {
        for (const id of ids) expect([1000, 1007, 1017, 1023]).toContain(id);
    });

    test('examples from the table', () => {
        expect(germanEditionRemovals(['core', 'oceania']).map(id => BONUS_CARDS.find(c => c.id === id)!.name.de)).toEqual([
            'Biologe',
            'Morphologe',
        ]);
        expect(germanEditionRemovals(['core'])).toEqual([]);
        expect(germanEditionRemovals(['core', 'european'])).toEqual([]);
        expect(germanEditionRemovals(['asia', 'oceania'])).toHaveLength(4);
    });

    test('removals apply to the German edition only and can be switched off', () => {
        const sets: CardSet[] = ['core', 'oceania'];
        const en = bonusCardPool({ sets, edition: 'en' });
        const de = bonusCardPool({ sets, edition: 'de' });
        const deAll = bonusCardPool({ sets, edition: 'de', applyEditionRemovals: false });
        expect(en.length - de.length).toBe(2);
        expect(deAll).toHaveLength(en.length);
        expect(de.some(c => c.name.en === 'Historian')).toBe(false);
    });

    test('pool only contains cards of the selected sets', () => {
        for (const sets of subsets(ALL)) {
            for (const c of bonusCardPool({ sets, edition: 'de' })) expect(sets).toContain(c.set);
        }
    });
});

describe('drawSetup', () => {
    test('draws 4 distinct goals and 2 distinct bonus cards per player', () => {
        for (let seed = 1; seed <= 200; seed++) {
            const players = (seed % 7) + 1;
            const r = drawSetup({ sets: ALL, edition: 'de', playerCount: players, rng: seededRng(seed) });
            expect(r.ok).toBe(true);
            if (!r.ok) continue;
            expect(r.draw.goals).toHaveLength(ROUND_COUNT);
            expect(new Set(r.draw.goals.map(g => g.tile.id)).size).toBe(ROUND_COUNT);
            expect(r.draw.goals.every(g => g.side === 0 || g.side === 1)).toBe(true);
            expect(r.draw.bonus).toHaveLength(players);
            const ids = r.draw.bonus.flat().map(c => c.id);
            expect(ids).toHaveLength(players * BONUS_CARDS_PER_PLAYER);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    test('respects owned sets and the German removals', () => {
        for (let seed = 1; seed <= 100; seed++) {
            const r = drawSetup({ sets: ['core', 'oceania'], edition: 'de', playerCount: 5, rng: seededRng(seed) });
            if (!r.ok) throw new Error(r.error);
            for (const g of r.draw.goals) expect(['core', 'oceania']).toContain(g.tile.set);
            for (const c of r.draw.bonus.flat()) {
                expect(['core', 'oceania']).toContain(c.set);
                expect(['Historian', 'Anatomist']).not.toContain(c.name.en);
            }
        }
    });

    test('is deterministic for a seed', () => {
        const a = drawSetup({ sets: ALL, edition: 'en', playerCount: 3, rng: seededRng(42) });
        const b = drawSetup({ sets: ALL, edition: 'en', playerCount: 3, rng: seededRng(42) });
        expect(a).toEqual(b);
    });

    test('both sides and every core tile come up over many draws', () => {
        const seen = new Set<string>();
        for (let seed = 1; seed <= 300; seed++) {
            const r = drawSetup({ sets: ['core'], edition: 'en', playerCount: 1, rng: seededRng(seed) });
            if (r.ok) r.draw.goals.forEach(g => seen.add(`${g.tile.id}:${g.side}`));
        }
        expect(seen.size).toBe(16);
    });

    test.each([
        [{ sets: ['asia'] as CardSet[], playerCount: 2 }, 'not-enough-goals'],
        [{ sets: ['core'] as CardSet[], playerCount: 0 }, 'no-players'],
        [{ sets: ['core', 'oceania'] as CardSet[], playerCount: 50 }, 'not-enough-bonus-cards'],
    ])('reports errors %#', (opts, error) => {
        expect(drawSetup({ ...opts, edition: 'en' })).toEqual({ ok: false, error });
    });

    test('redrawGoal replaces one round with an unused tile', () => {
        const r = drawSetup({ sets: ['core'], edition: 'en', playerCount: 2, rng: seededRng(7) });
        if (!r.ok) throw new Error(r.error);
        for (let seed = 1; seed <= 50; seed++) {
            const next = redrawGoal(r.draw, 2, ['core'], seededRng(seed));
            expect(next.goals[0]).toBe(r.draw.goals[0]);
            expect(next.goals[1]).toBe(r.draw.goals[1]);
            expect(next.goals[3]).toBe(r.draw.goals[3]);
            expect(new Set(next.goals.map(g => g.tile.id)).size).toBe(4);
            expect(next.bonus).toBe(r.draw.bonus);
        }
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

    test('localized falls back to English', () => {
        expect(localized({ en: 'Apiarist', de: null }, 'de')).toBe('Apiarist');
        expect(localized({ en: 'Forester', de: 'Förster' }, 'de')).toBe('Förster');
        expect(localized({ en: 'Forester', de: 'Förster' }, 'en')).toBe('Forester');
    });

    test('renderTokens', () => {
        expect(renderTokens('2 to 3 birds: 3[point]', 'en')).toBe('2 to 3 birds: 3 pts');
        expect(renderTokens('Vögel mit [cavity] Nest', 'de')).toBe('Vögel mit Höhlennest');
        expect(renderTokens('[ground] nest birds', 'en')).toBe('ground nest birds');
        expect(renderTokens('[unknown] x', 'en')).toBe('[unknown] x');
    });
});


describe('setup preferences', () => {
    test('defaults follow the UI language', () => {
        expect(defaultPrefs('de')).toEqual({ sets: ['core'], edition: 'de', applyEditionRemovals: true });
    });

    test('parses stored values and drops garbage', () => {
        expect(parsePrefs({ sets: ['oceania', 'nope', 'core'], edition: 'en', applyEditionRemovals: false }, 'de')).toEqual({
            sets: ['core', 'oceania'],
            edition: 'en',
            applyEditionRemovals: false,
        });
        expect(parsePrefs({ sets: [], edition: 'fr' }, 'de')).toEqual(defaultPrefs('de'));
        expect(parsePrefs('garbage', 'en')).toEqual(defaultPrefs('en'));
    });
});
