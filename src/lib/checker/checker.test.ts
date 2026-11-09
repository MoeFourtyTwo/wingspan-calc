/**
 * Tests for the bonus card checker. Fixtures are small hand-written records in
 * the source format; no third-party card data is stored in this repository.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { normalize, plainText, safeUrl } from './normalize';
import { RULE_NAMES, cardKind, isNameBased, verdict } from './rules';
import {
    DATA_COMMIT,
    MIRRORS,
    checkerData,
    downloadData,
    loadCheckerData,
    readCache,
    writeCache,
} from './source';
import type { Bird } from './types';

// ---------- fixtures (source format) ----------
const rawBird = (over: Record<string, unknown> = {}) => ({
    id: 1,
    'Common name': 'Test Warbler',
    'Scientific name': 'Testus testus',
    Set: 'core',
    'Power text': 'Tuck 1 [card] from your hand behind this bird.',
    Predator: null,
    Flocking: 'X',
    'Bonus card': null,
    'Victory points': 3,
    'Nest type': 'Bowl',
    'Egg limit': 2,
    Wingspan: 20,
    Forest: 'X',
    Grassland: 'X',
    Wetland: null,
    Invertebrate: 1,
    Seed: 1,
    Fish: null,
    Fruit: null,
    Rodent: null,
    Nectar: null,
    'Wild (food)': null,
    '/ (food cost)': null,
    'Total food cost': 2,
    Anatomist: null,
    Photographer: 'X',
    'Omnivore Expert': null,
    rulings: [{ id: '1', text: 'A <strong>ruling</strong> &amp; more', source: 'https://example.com/r' }],
    ...over,
});

const rawBonus = (over: Record<string, unknown> = {}) => ({
    id: 1000,
    'Bonus card': 'Anatomist',
    Set: 'core',
    Condition: 'Birds with body parts in their names',
    'Explanatory text': 'Body parts include beak, …',
    VP: '2 to 3 birds: 3[point]; 4+ birds: 7[point]',
    Note: 'See <br>the rulebook',
    rulings: [],
    ...over,
});

const deFile = {
    birds: { '1': { 'Common name': 'Testgrasmücke', 'Power text': 'Stecke 1 Karte …', Anatomist: 'X', Photographer: null } },
    bonuses: { '1000': { Name: 'Morphologe', Condition: 'Vögel mit Körperteilen im Namen', VP: '2 - 3 Vögel: 3[point]' } },
};

const sources = () => ({
    master: [rawBird()],
    hummingbirds: [rawBird({ id: 900, 'Common name': 'Test Hummingbird', Set: 'americas', Flocking: null, Photographer: null })],
    bonus: [rawBonus(), rawBonus({ id: 1031, 'Bonus card': '[Fan Made] Something' }), rawBonus({ id: 1032, 'Bonus card': '[automa] Bot' })],
    de: deFile,
});

/** A normalised bird with neutral defaults. */
function bird(over: Partial<Bird> = {}): Bird {
    return {
        id: 1,
        set: 'core',
        hummingbird: false,
        name: { en: 'Bird', de: 'Vogel' },
        scientific: '',
        points: 5,
        habitats: ['forest'],
        nest: 'bowl',
        eggLimit: 3,
        wingspan: 40,
        food: { seed: 1 },
        foodTotal: 1,
        foodSlash: false,
        predator: false,
        flocking: false,
        bonusPower: false,
        power: { en: '', de: null },
        flags: [],
        flagsDe: [],
        rulings: [],
        ...over,
    };
}

// ---------- normalize ----------
describe('normalize', () => {
    test('maps a bird with German name, flags and rulings', () => {
        const { birds } = normalize(sources());
        const b = birds.find(b => b.id === 1)!;
        expect(b.name).toEqual({ en: 'Test Warbler', de: 'Testgrasmücke' });
        expect(b.habitats).toEqual(['forest', 'grassland']);
        expect(b.nest).toBe('bowl');
        expect(b.food).toEqual({ invertebrate: 1, seed: 1 });
        expect(b.flocking).toBe(true);
        expect(b.flags).toEqual(['Photographer']);
        expect(b.flagsDe).toEqual(['Anatomist']);
        expect(b.rulings).toEqual([{ text: 'A ruling & more', source: 'https://example.com/r' }]);
    });

    test('hummingbird cards are included and have no German flags without a German name', () => {
        const h = normalize(sources()).birds.find(b => b.id === 900)!;
        expect(h.hummingbird).toBe(true);
        expect(h.name.de).toBeNull();
        expect(h.flagsDe).toBeNull();
    });

    test('renames the "Omnivore Expert" column to the card name', () => {
        const { birds } = normalize({ ...sources(), master: [rawBird({ 'Omnivore Expert': 'X' })] });
        expect(birds[0].flags).toContain('Omnivore Specialist');
    });

    test('"*" wingspan and unknown nests', () => {
        const [b] = normalize({ ...sources(), master: [rawBird({ Wingspan: '*', 'Nest type': 'weird' })] }).birds;
        expect(b.wingspan).toBe('*');
        expect(b.nest).toBe('none');
    });

    test('bonus cards: German texts, plain text, fan-made and Automa-only cards skipped', () => {
        const { bonusCards } = normalize(sources());
        expect(bonusCards).toHaveLength(1);
        expect(bonusCards[0].name).toEqual({ en: 'Anatomist', de: 'Morphologe' });
        expect(bonusCards[0].note.en).toBe('See\nthe rulebook');
        expect(bonusCards[0].explanation.de).toBeNull();
    });

    test('garbage input never throws', () => {
        expect(normalize({ master: null, hummingbirds: 'x', bonus: [null, 1, { id: 'x' }], de: 5 })).toEqual({
            birds: [],
            bonusCards: [],
        });
        expect(normalize({ ...sources(), master: [{ id: 2 }, rawBird({ Set: null })] }).birds).toHaveLength(1);
    });
});

describe('sanitising external text', () => {
    test('plainText keeps table cells and rows apart', () => {
        expect(plainText('Hinweis<br><table><th>Kombination</th><th>Entfernen</th><tr><td>Grundspiel, Ozeanien</td><td>Biologe</td></tr><tr><td>Asien</td><td>Geograf</td></tr></table>')).toBe(
            'Hinweis\nKombination: Entfernen\nGrundspiel, Ozeanien: Biologe\nAsien: Geograf',
        );
    });

    test('plainText strips tags and entities', () => {
        expect(plainText('<script>alert(1)</script><b>Hi</b>&nbsp;there<br/>next')).toBe('alert(1)Hi there\nnext');
    });

    test('safeUrl only allows http(s)', () => {
        expect(safeUrl('https://stonemaiergames.com/x')).toBe('https://stonemaiergames.com/x');
        expect(safeUrl('javascript:alert(1)')).toBeNull();
        expect(safeUrl('not a url')).toBeNull();
        expect(safeUrl(null)).toBeNull();
    });
});

// ---------- rules ----------
describe('rules', () => {
    test.each([
        ['Backyard Birder', bird({ points: 3 }), 'yes'],
        ['Backyard Birder', bird({ points: 4 }), 'no'],
        ['Bird Bander', bird({ habitats: ['forest', 'wetland'] }), 'yes'],
        ['Bird Counter', bird({ flocking: true }), 'yes'],
        ['Bird Feeder', bird({ food: { seed: 1 } }), 'yes'],
        ['Bird Feeder', bird({ food: { fish: 1 } }), 'no'],
        ['Diet Specialist', bird({ foodTotal: 3 }), 'yes'],
        ['Diet Specialist', bird({ foodTotal: 3, foodSlash: true }), 'no'],
        ['Enclosure Builder', bird({ nest: 'ground' }), 'yes'],
        ['Enclosure Builder', bird({ nest: 'wild' }), 'yes'],
        ['Enclosure Builder', bird({ nest: 'bowl' }), 'no'],
        ['Wildlife Gardener', bird({ nest: 'wild' }), 'yes'],
        ['Nest Box Builder', bird({ nest: 'cavity' }), 'yes'],
        ['Platform Builder', bird({ nest: 'none' }), 'no'],
        ['Endangered Species Protector', bird({ bonusPower: true }), 'yes'],
        ['Falconer', bird({ predator: true }), 'yes'],
        ['Fishery Manager', bird({ food: { fish: 2 } }), 'yes'],
        ['Food Web Expert', bird({ food: { invertebrate: 2 } }), 'yes'],
        ['Food Web Expert', bird({ food: { invertebrate: 1, seed: 1 } }), 'no'],
        ['Forester', bird({ habitats: ['forest'] }), 'yes'],
        ['Forester', bird({ habitats: ['forest', 'grassland'] }), 'no'],
        ['Prairie Manager', bird({ habitats: ['grassland'] }), 'yes'],
        ['Wetland Scientist', bird({ habitats: ['wetland'] }), 'yes'],
        ['Large Bird Specialist', bird({ wingspan: 66 }), 'yes'],
        ['Large Bird Specialist', bird({ wingspan: 65 }), 'no'],
        ['Large Bird Specialist', bird({ wingspan: '*' }), 'yes'],
        ['Passerine Specialist', bird({ wingspan: 30 }), 'yes'],
        ['Passerine Specialist', bird({ wingspan: 31 }), 'no'],
        ['Passerine Specialist', bird({ wingspan: '*' }), 'yes'],
        ['Omnivore Specialist', bird({ food: { wild: 1 } }), 'yes'],
        ['Rodentologist', bird({ food: { rodent: 1 } }), 'yes'],
        ['Viticulturalist', bird({ food: { fruit: 1 } }), 'yes'],
        ['Small Clutch Specialist', bird({ eggLimit: 2 }), 'yes'],
        ['Small Clutch Specialist', bird({ eggLimit: 3 }), 'no'],
    ] as const)('%s → %s', (card, b, expected) => {
        expect(verdict(b, card, 'en')).toBe(expected);
    });

    test('data flags always win for fixed cards', () => {
        expect(verdict(bird({ points: 9, flags: ['Backyard Birder'] }), 'Backyard Birder', 'en')).toBe('yes');
    });

    test('name-based cards use the flags of the chosen edition', () => {
        const b = bird({ flags: ['Photographer'], flagsDe: ['Anatomist'] });
        expect(verdict(b, 'Photographer', 'en')).toBe('yes');
        expect(verdict(b, 'Photographer', 'de')).toBe('no');
        expect(verdict(b, 'Anatomist', 'de')).toBe('yes');
        expect(verdict(b, 'Anatomist', 'en')).toBe('no');
        expect(verdict(bird({ flagsDe: null }), 'Historian', 'de')).toBe('unknown');
        expect(isNameBased('Historian')).toBe(true);
        expect(isNameBased('Forester')).toBe(false);
    });

    test('game-state cards answer "maybe" for birds that can count, "no" otherwise', () => {
        expect(verdict(bird({ eggLimit: 4 }), 'Breeding Manager', 'en')).toBe('maybe');
        expect(verdict(bird({ eggLimit: 3 }), 'Breeding Manager', 'en')).toBe('no');
        expect(verdict(bird({ eggLimit: 0 }), 'Oologist', 'en')).toBe('no');
        expect(verdict(bird({ habitats: ['wetland'] }), 'Forest Ranger', 'en')).toBe('no');
        expect(verdict(bird(), 'Ecologist', 'en')).toBe('maybe');
    });

    test('cards not about bird cards, and unknown cards', () => {
        expect(verdict(bird(), 'Mango Specialist', 'en')).toBe('n/a');
        expect(verdict(bird(), 'Winter Feeder', 'en')).toBe('n/a');
        expect(cardKind('Some Future Card')).toBe('state');
        expect(verdict(bird(), 'Some Future Card', 'en')).toBe('maybe');
    });

    test('every rule name is unique and kinds are valid', () => {
        expect(new Set(RULE_NAMES).size).toBe(RULE_NAMES.length);
        for (const n of RULE_NAMES) expect(['fixed', 'state', 'other']).toContain(cardKind(n));
    });
});

// ---------- source ----------
function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

function okFetch(): typeof fetch {
    const files: Record<string, unknown> = {
        'master.json': sources().master,
        'hummingbirds.json': sources().hummingbirds,
        'bonus.json': sources().bonus,
        'i18n/de.json': sources().de,
    };
    return vi.fn(async (url: string | URL | Request) => {
        const file = Object.keys(files).find(f => String(url).endsWith(f))!;
        return new Response(JSON.stringify(files[file]), { status: 200 });
    }) as unknown as typeof fetch;
}

describe('source', () => {
    test('mirrors are pinned to the data commit', () => {
        for (const m of MIRRORS) expect(m('bonus.json')).toContain(DATA_COMMIT);
    });

    test('downloads and normalises all files', async () => {
        const data = await downloadData(okFetch());
        expect(data.birds).toHaveLength(2);
        expect(data.bonusCards).toHaveLength(1);
    });

    test('falls back to the second mirror', async () => {
        const good = okFetch();
        const f = vi.fn(async (url: string) =>
            url.includes('raw.githubusercontent') ? new Response('nope', { status: 503 }) : good(url),
        ) as unknown as typeof fetch;
        await expect(downloadData(f)).resolves.toMatchObject({ bonusCards: [{ id: 1000 }] });
    });

    test('fails when every mirror fails or the data is empty', async () => {
        await expect(downloadData(vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch)).rejects.toThrow();
        const empty = vi.fn(async () => new Response('[]', { status: 200 })) as unknown as typeof fetch;
        await expect(downloadData(empty)).rejects.toThrow(/empty/);
    });

    test('cache round-trip and rejection of bad cache entries', async () => {
        const s = memoryStorage();
        expect(readCache(s)).toBeNull();
        const data = await downloadData(okFetch());
        writeCache(data, s);
        expect(readCache(s)).toEqual(data);
        for (const k of s.m.keys()) s.m.set(k, '{"v":0,"data":{}}');
        expect(readCache(s)).toBeNull();
        for (const k of s.m.keys()) s.m.set(k, 'not json');
        expect(readCache(s)).toBeNull();
    });
});

describe('loadCheckerData', () => {
    beforeEach(() => vi.resetModules());

    test('reports an error and allows a retry', async () => {
        const failing = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
        await loadCheckerData(failing);
        expect(get(checkerData).status).toBe('error');
        await loadCheckerData(okFetch());
        expect(get(checkerData)).toMatchObject({ status: 'ready', fromCache: false });
    });
});
