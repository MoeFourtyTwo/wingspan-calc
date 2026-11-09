/**
 * Turns the raw community card data (wingsearch JSON files, loaded at
 * runtime) into the compact {@link CheckerData} shape. Defensive on purpose:
 * the input is external data, so every field is validated and unknown
 * shapes are skipped instead of crashing the app.
 */
import type { Bird, BonusCard, CheckerData, Habitat, Nest, Ruling, Text } from './types';

type Raw = Record<string, unknown>;

/** Data flag column → bonus card name, where they differ. */
const FLAG_ALIASES: Record<string, string> = { 'Omnivore Expert': 'Omnivore Specialist' };

/** The four cards scored on words in the bird's name (differ per language). */
export const NAME_BASED = ['Anatomist', 'Cartographer', 'Historian', 'Photographer'] as const;

/** Every card column the data may flag (English names). */
const FLAG_COLUMNS = [
    ...NAME_BASED,
    'Backyard Birder', 'Bird Bander', 'Bird Counter', 'Bird Feeder', 'Diet Specialist', 'Enclosure Builder',
    'Endangered Species Protector', 'Falconer', 'Fishery Manager', 'Food Web Expert', 'Forester',
    'Large Bird Specialist', 'Nest Box Builder', 'Omnivore Expert', 'Passerine Specialist', 'Platform Builder',
    'Prairie Manager', 'Rodentologist', 'Small Clutch Specialist', 'Viticulturalist', 'Wetland Scientist',
    'Wildlife Gardener',
];

const MAIN_SETS = new Set(['core', 'european', 'oceania', 'asia', 'americas']);
const NESTS: Nest[] = ['bowl', 'cavity', 'ground', 'platform', 'wild'];

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
};
const isX = (v: unknown) => v === 'X' || v === 'x' || v === true;

/** Strip HTML tags/entities from external text so it can be shown as plain text. */
export function plainText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|li|tr|div)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

const text = (en: unknown, de?: unknown): Text => ({
    en: plainText(str(en) ?? ''),
    de: str(de) ? plainText(str(de)!) : null,
});

function rulings(raw: unknown): Ruling[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(r => (r && typeof r === 'object' ? (r as Raw) : {}))
        .map(r => ({ text: plainText(str(r.text) ?? ''), source: safeUrl(r.source) }))
        .filter(r => r.text);
}

/** Only allow http(s) links from external data. */
export function safeUrl(v: unknown): string | null {
    const s = str(v);
    if (!s) return null;
    try {
        const u = new URL(s);
        return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
    } catch {
        return null;
    }
}

export function isMainSet(set: string): boolean {
    return MAIN_SETS.has(set);
}

function flagsOf(r: Raw, columns: readonly string[]): string[] {
    return columns.filter(c => isX(r[c])).map(c => FLAG_ALIASES[c] ?? c);
}

function normalizeBird(r: Raw, de: Raw | undefined, hummingbird: boolean): Bird | null {
    const id = num(r.id);
    const name = str(r['Common name']);
    const set = str(r.Set);
    if (id === null || !name || !set) return null;

    const habitats = (['Forest', 'Grassland', 'Wetland'] as const)
        .filter(h => isX(r[h]))
        .map(h => h.toLowerCase() as Habitat);
    const nestRaw = str(r['Nest type'])?.toLowerCase();
    const food: Bird['food'] = {};
    for (const [col, key] of [
        ['Invertebrate', 'invertebrate'], ['Seed', 'seed'], ['Fish', 'fish'], ['Fruit', 'fruit'],
        ['Rodent', 'rodent'], ['Nectar', 'nectar'], ['Wild (food)', 'wild'],
    ] as const) {
        const n = num(r[col]);
        if (n && n > 0) food[key] = n;
    }

    return {
        id,
        set,
        hummingbird,
        name: { en: name, de: de ? str(de['Common name']) : null },
        scientific: str(r['Scientific name']) ?? '',
        points: num(r['Victory points']),
        habitats,
        nest: NESTS.includes(nestRaw as Nest) ? (nestRaw as Nest) : 'none',
        eggLimit: num(r['Egg limit']),
        wingspan: str(r.Wingspan) === '*' ? '*' : num(r.Wingspan),
        food,
        foodTotal: num(r['Total food cost']),
        foodSlash: isX(r['/ (food cost)']),
        predator: isX(r.Predator),
        flocking: isX(r.Flocking),
        bonusPower: isX(r['Bonus card']),
        power: text(r['Power text'] ?? r.Benefit, de?.['Power text']),
        flags: flagsOf(r, FLAG_COLUMNS),
        flagsDe: de ? flagsOf(de, NAME_BASED) : null,
        rulings: [...rulings(r.rulings), ...rulings(r.additionalRulings)],
    };
}

function normalizeBonus(r: Raw, de: Raw | undefined): BonusCard | null {
    const id = num(r.id);
    const name = str(r['Bonus card']);
    const set = str(r.Set);
    // Skip fan-made and Automa-only cards ("[Fan Made] …", "[automa] …").
    if (id === null || !name || !set || name.startsWith('[')) return null;
    return {
        id,
        set,
        name: text(name, de?.Name),
        condition: text(r.Condition, de?.Condition),
        explanation: text(r['Explanatory text'], de?.['Explanatory text']),
        scoring: text(r.VP, de?.VP),
        note: text(r.Note, de?.Note),
        rulings: rulings(r.rulings),
    };
}

export interface RawSources {
    master: unknown;
    hummingbirds: unknown;
    bonus: unknown;
    de: unknown;
}

const list = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter((x): x is Raw => !!x && typeof x === 'object') : []);
const dict = (v: unknown): Record<string, Raw> => (v && typeof v === 'object' ? (v as Record<string, Raw>) : {});

export function normalize(src: RawSources): CheckerData {
    const de = dict(src.de);
    const deBirds = dict(de.birds);
    const deBonus = dict(de.bonuses);
    const birds = [
        ...list(src.master).map(r => normalizeBird(r, deBirds[String(r.id)], false)),
        ...list(src.hummingbirds).map(r => normalizeBird(r, deBirds[String(r.id)], true)),
    ].filter((b): b is Bird => !!b);
    const bonusCards = list(src.bonus)
        .map(r => normalizeBonus(r, deBonus[String(r.id)]))
        .filter((c): c is BonusCard => !!c);
    return { birds, bonusCards };
}
