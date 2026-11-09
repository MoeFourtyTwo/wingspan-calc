/**
 * Tests for the checker UI helpers (search, sets, grouping) and prefs.
 * Fixtures are hand-written; no third-party card data is stored here.
 */
import { describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import {
    birdSubtitle,
    checkBird,
    englishSubtitle,
    checkCard,
    chipOf,
    fold,
    inSets,
    isFallback,
    localText,
    matchRank,
    searchBirds,
    searchCardBirds,
    searchCards,
    searchKey,
    toggleChip,
} from './search';
import {
    CHECKER_PREFS_KEY,
    createCheckerPrefs,
    defaultCheckerPrefs,
    parseCheckerPrefs,
    resolvePrefs,
    setsFromOptions,
} from './prefs';
import type { Bird, BonusCard } from './types';

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

function card(en: string, de: string | null = null, set = 'core'): BonusCard {
    const t = { en: '', de: null };
    return { id: 1000, set, name: { en, de }, condition: t, explanation: t, scoring: t, note: t, rulings: [] };
}

const kakapo = bird({ id: 2, set: 'oceania', name: { en: 'Kākāpō', de: 'Kākāpō' }, scientific: 'Strigops habroptila', wingspan: '*' });
const stonechat = bird({ id: 3, set: 'european', name: { en: 'European Stonechat', de: 'Schwarzkehlchen' }, wingspan: 20 });
const chickadee = bird({ id: 4, name: { en: 'Black-capped Chickadee', de: 'Schwarzkopfmeise' }, wingspan: 20 });
const greenfinch = bird({ id: 5, set: 'european', name: { en: 'European Greenfinch', de: 'Grünfink' }, wingspan: 25 });
const americas = bird({ id: 6, set: 'americas', name: { en: 'Blue-footed Booby', de: null }, flagsDe: null, flags: ['Anatomist'], wingspan: 150 });
const emu = bird({ id: 7, set: 'oceania', name: { en: 'Emu', de: 'Emu' }, wingspan: '*', eggLimit: 6 });
const birds = [kakapo, stonechat, chickadee, greenfinch, americas, emu];

describe('fold & search', () => {
    test('fold ignores case, accents, umlauts, ß and hyphens', () => {
        expect(fold('Kākāpō')).toBe('kakapo');
        expect(fold('Grünfink')).toBe('grunfink');
        expect(fold('Black-capped Chickadee')).toBe('blackcappedchickadee');
        expect(fold('Großtrappe')).toBe('grosstrappe');
    });

    test('"kakapo" finds Kākāpō, "schwarzkehl" finds Schwarzkehlchen', () => {
        expect(searchBirds(birds, 'kakapo', 'de')).toEqual([kakapo]);
        expect(searchBirds(birds, 'schwarzkehl', 'de')).toEqual([stonechat]);
        expect(searchBirds(birds, 'SCHWARZ', 'de')).toEqual([stonechat, chickadee]);
    });

    test('German umlaut spellings and English / scientific names match', () => {
        expect(searchBirds(birds, 'gruenfink', 'de')).toEqual([greenfinch]);
        expect(searchBirds(birds, 'grunfink', 'de')).toEqual([greenfinch]);
        expect(searchBirds(birds, 'stonechat', 'de')).toEqual([stonechat]);
        expect(searchBirds(birds, 'black capped', 'de')).toEqual([chickadee]);
        expect(searchBirds(birds, 'blackcapped', 'en')).toEqual([chickadee]);
        expect(searchBirds(birds, 'strigops', 'en')).toEqual([kakapo]);
    });

    test('ranking: display-name prefix before word start before substring, then alphabetical', () => {
        const a = bird({ id: 10, name: { en: 'Fink Owl', de: 'Finkeneule' } });
        const b = bird({ id: 11, name: { en: 'Mountain Finch', de: 'Bergfink' } });
        const c = bird({ id: 12, name: { en: 'Big Finkster', de: 'Großer Finkster' } });
        expect(searchBirds([b, c, a], 'fink', 'de').map(x => x.id)).toEqual([10, 12, 11]);
        expect(matchRank('', 'x', 'x')).toBe(0);
        expect(matchRank('zz', 'x', searchKey('x'))).toBe(-1);
    });

    test('empty query lists everything alphabetically in the edition language', () => {
        expect(searchBirds([stonechat, emu, chickadee], '', 'de').map(b => b.id)).toEqual([emu.id, stonechat.id, chickadee.id]);
        expect(searchBirds([stonechat, emu, chickadee], '', 'en').map(b => b.id)).toEqual([chickadee.id, emu.id, stonechat.id]);
    });

    test('cards are found by German and English names', () => {
        const cards = [card('Anatomist', 'Morphologe'), card('Large Bird Specialist', 'Grossvogelkundler')];
        expect(searchCards(cards, 'morph', 'de')[0].name.en).toBe('Anatomist');
        expect(searchCards(cards, 'anatom', 'de')[0].name.en).toBe('Anatomist');
        expect(searchCards(cards, 'großvogel', 'de')[0].name.en).toBe('Large Bird Specialist');
    });

    test('subtitles: English name only when it differs', () => {
        expect(birdSubtitle(stonechat, 'de')).toBe('European Stonechat');
        expect(birdSubtitle(emu, 'de')).toBe('');
        expect(birdSubtitle(kakapo, 'en')).toBe('Strigops habroptila');
        expect(birdSubtitle(americas, 'de')).toBe('');
        expect(englishSubtitle({ en: 'Anatomist', de: 'Morphologe' }, 'de')).toBe('Anatomist');
        expect(englishSubtitle({ en: 'Anatomist', de: 'Morphologe' }, 'en')).toBeNull();
    });

    test('localText falls back to English', () => {
        expect(localText(americas.name, 'de')).toBe('Blue-footed Booby');
        expect(isFallback(americas.name, 'de')).toBe(true);
        expect(isFallback(americas.name, 'en')).toBe(false);
        expect(localText(stonechat.name, 'de')).toBe('Schwarzkehlchen');
    });
});

describe('sets', () => {
    test('promo packs share one chip', () => {
        expect(chipOf('promoUS')).toBe('promo');
        expect(chipOf('promoNZ')).toBe('promo');
        expect(chipOf('asia')).toBe('asia');
        expect(inSets('promoEurope', ['core', 'promo'])).toBe(true);
        expect(inSets('promoEurope', ['core'])).toBe(false);
        expect(inSets('oceania', ['core'])).toBe(false);
    });

    test('toggleChip keeps canonical order and at least one set', () => {
        expect(toggleChip(['core'], 'asia')).toEqual(['core', 'asia']);
        expect(toggleChip(['asia', 'core'], 'european')).toEqual(['core', 'european', 'asia']);
        expect(toggleChip(['core', 'asia'], 'core')).toEqual(['asia']);
        expect(toggleChip(['core'], 'core')).toEqual(['core']);
    });
});

describe('checkCard / checkBird', () => {
    test('fixed card: yes and no, alphabetical', () => {
        const res = checkCard(birds, card('Passerine Specialist'), 'de');
        expect(res.kind).toBe('fixed');
        // "*" wingspan counts as any wingspan.
        expect(res.yes.map(b => b.id)).toEqual([emu.id, greenfinch.id, kakapo.id, stonechat.id, chickadee.id]);
        expect(res.no).toEqual([americas]);
    });

    test('name-based card in DE: Americas birds are unknown', () => {
        const de = checkCard(birds, card('Anatomist', 'Morphologe'), 'de');
        expect(de.unknown).toEqual([americas]);
        const en = checkCard(birds, card('Anatomist', 'Morphologe'), 'en');
        expect(en.yes).toEqual([americas]);
        expect(en.unknown).toEqual([]);
    });

    test('state card: maybe, and allCan when every bird can count', () => {
        const breeding = checkCard(birds, card('Breeding Manager'), 'en');
        expect(breeding.kind).toBe('state');
        expect(breeding.maybe).toEqual([emu]);
        expect(breeding.allCan).toBe(false);
        expect(checkCard(birds, card('Ecologist'), 'en').allCan).toBe(true);
    });

    test('other card: no birds listed', () => {
        const res = checkCard(birds, card('Hummingbird Counter'), 'en');
        expect(res.kind).toBe('other');
        expect(res.yes.length + res.maybe.length + res.no.length).toBe(0);
    });

    test('checkBird groups cards per verdict', () => {
        const cards = [card('Large Bird Specialist'), card('Passerine Specialist'), card('Breeding Manager'), card('Falconer'), card('Apiarist'), card('Anatomist')];
        const res = checkBird(emu, cards, 'de');
        expect(res.yes.map(c => c.name.en)).toEqual(['Large Bird Specialist', 'Passerine Specialist']);
        expect(res.maybe.map(c => c.name.en)).toEqual(['Breeding Manager']);
        expect(res.no.map(c => c.name.en)).toEqual(['Anatomist', 'Falconer']);
        expect(res.na.map(c => c.name.en)).toEqual(['Apiarist']);
        expect(checkBird(americas, cards, 'de').unknown.map(c => c.name.en)).toEqual(['Anatomist']);
    });

    test('searchCardBirds shows non-qualifying matches with their verdict', () => {
        expect(searchCardBirds(birds, card('Large Bird Specialist'), 'schwarzkehl', 'de')).toEqual([{ bird: stonechat, verdict: 'no' }]);
        expect(searchCardBirds(birds, card('Large Bird Specialist'), 'emu', 'de')).toEqual([{ bird: emu, verdict: 'yes' }]);
    });
});

describe('checker prefs', () => {
    test('parse validates edition and sets', () => {
        expect(parseCheckerPrefs(null)).toEqual(defaultCheckerPrefs());
        expect(parseCheckerPrefs({ edition: 'fr', sets: 'x' })).toEqual({ edition: null, sets: null });
        expect(parseCheckerPrefs({ edition: 'de', sets: ['promo', 'bogus', 'core'] })).toEqual({ edition: 'de', sets: ['core', 'promo'] });
        expect(parseCheckerPrefs({ edition: 'en', sets: [] })).toEqual({ edition: 'en', sets: null });
    });

    test('sets from the game options', () => {
        expect(setsFromOptions({ oceania: true, americas: false })).toEqual(['core', 'oceania']);
        expect(setsFromOptions({ oceania: false, americas: true })).toEqual(['core', 'americas']);
        expect(setsFromOptions(undefined)).toEqual(['core']);
    });

    test('resolvePrefs: edition follows the UI language until chosen', () => {
        expect(resolvePrefs(defaultCheckerPrefs(), 'de', { oceania: true })).toEqual({ edition: 'de', sets: ['core', 'oceania'] });
        expect(resolvePrefs({ edition: 'en', sets: ['asia'] }, 'de', { oceania: true })).toEqual({ edition: 'en', sets: ['asia'] });
    });

    test('store persists and survives broken storage', () => {
        const mem = new Map<string, string>();
        const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
        const s = createCheckerPrefs(storage);
        s.set({ edition: 'de', sets: ['core', 'asia'] });
        expect(JSON.parse(mem.get(CHECKER_PREFS_KEY)!)).toEqual({ edition: 'de', sets: ['core', 'asia'] });
        expect(get(createCheckerPrefs(storage))).toEqual({ edition: 'de', sets: ['core', 'asia'] });

        const broken = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('denied');
            },
        };
        const b = createCheckerPrefs(broken);
        expect(get(b)).toEqual(defaultCheckerPrefs());
        expect(() => b.set({ edition: 'en', sets: null })).not.toThrow();
    });
});
