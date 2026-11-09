/**
 * Which birds count for which bonus card.
 *
 * Every card is one of three kinds:
 * - `fixed`: decided by the printed card alone ("birds with a bowl nest").
 *   The data's flags are authoritative; the attribute tests below encode
 *   the card conditions and agree with the flags.
 * - `state`: depends on the game ("birds with at least 4 eggs on them").
 *   We can only say which birds *can* count.
 * - `other`: not about bird cards (e.g. the Americas hummingbird tokens).
 *
 * Official rules applied: a wild (star) nest counts as every nest type, a
 * "*" wingspan counts as any wingspan;
 * the four name-based cards are judged on the bird name of the edition in
 * use (German and English names qualify differently).
 */
import { NAME_BASED } from './normalize';
import type { Bird, Habitat, Lang, Nest } from './types';

export type CardKind = 'fixed' | 'state' | 'other';
export type Verdict = 'yes' | 'no' | 'maybe' | 'unknown' | 'n/a';

interface Rule {
    kind: CardKind;
    /** fixed: does the bird count? state: can it count at all? */
    test?: (b: Bird) => boolean;
}

const has = (b: Bird, food: keyof Bird['food']) => (b.food[food] ?? 0) > 0;
const nest = (n: Nest) => (b: Bird) => b.nest === n || b.nest === 'wild';
const only = (h: Habitat) => (b: Bird) => b.habitats.length === 1 && b.habitats[0] === h;
const lives = (h: Habitat) => (b: Bird) => b.habitats.includes(h);
const lays = (min: number) => (b: Bird) => (b.eggLimit ?? 0) >= min;

const RULES: Record<string, Rule> = {
    // --- fixed by the printed card ---
    Anatomist: { kind: 'fixed' },
    Cartographer: { kind: 'fixed' },
    Historian: { kind: 'fixed' },
    Photographer: { kind: 'fixed' },
    'Backyard Birder': { kind: 'fixed', test: b => b.points !== null && b.points < 4 },
    'Bird Bander': { kind: 'fixed', test: b => b.habitats.length > 1 },
    'Bird Counter': { kind: 'fixed', test: b => b.flocking },
    'Bird Feeder': { kind: 'fixed', test: b => has(b, 'seed') },
    'Diet Specialist': { kind: 'fixed', test: b => b.foodTotal === 3 && !b.foodSlash },
    'Enclosure Builder': { kind: 'fixed', test: nest('ground') },
    'Endangered Species Protector': { kind: 'fixed', test: b => b.bonusPower },
    Falconer: { kind: 'fixed', test: b => b.predator },
    'Fishery Manager': { kind: 'fixed', test: b => has(b, 'fish') },
    'Food Web Expert': { kind: 'fixed', test: b => Object.keys(b.food).length === 1 && has(b, 'invertebrate') },
    Forester: { kind: 'fixed', test: only('forest') },
    // A "*" wingspan (flightless birds) counts as any wingspan.
    'Large Bird Specialist': { kind: 'fixed', test: b => b.wingspan === '*' || (b.wingspan !== null && b.wingspan > 65) },
    'Nest Box Builder': { kind: 'fixed', test: nest('cavity') },
    'Omnivore Specialist': { kind: 'fixed', test: b => has(b, 'wild') },
    'Passerine Specialist': { kind: 'fixed', test: b => b.wingspan === '*' || (b.wingspan !== null && b.wingspan <= 30) },
    'Platform Builder': { kind: 'fixed', test: nest('platform') },
    'Prairie Manager': { kind: 'fixed', test: only('grassland') },
    Rodentologist: { kind: 'fixed', test: b => has(b, 'rodent') },
    'Small Clutch Specialist': { kind: 'fixed', test: b => b.eggLimit !== null && b.eggLimit <= 2 },
    Viticulturalist: { kind: 'fixed', test: b => has(b, 'fruit') },
    'Wetland Scientist': { kind: 'fixed', test: only('wetland') },
    'Wildlife Gardener': { kind: 'fixed', test: nest('bowl') },

    // --- depends on the game state: which birds *can* count ---
    'Breeding Manager': { kind: 'state', test: lays(4) },
    Oologist: { kind: 'state', test: lays(1) },
    'Avian Theriogenologist': { kind: 'state', test: lays(1) },
    'Citizen Scientist': { kind: 'state', test: b => b.flocking },
    'Pellet Dissector': { kind: 'state', test: b => b.predator || /cache/i.test(b.power.en) },
    'Forest Data Analyst': { kind: 'state', test: lives('forest') },
    'Grassland Data Analyst': { kind: 'state', test: lives('grassland') },
    'Wetland Data Analyst': { kind: 'state', test: lives('wetland') },
    'Forest Ranger': { kind: 'state', test: lives('forest') },
    'Grassland Ranger': { kind: 'state', test: lives('grassland') },
    'Wetland Ranger': { kind: 'state', test: lives('wetland') },
    'Forest Population Monitor': { kind: 'state', test: lives('forest') },
    'Grassland Population Monitor': { kind: 'state', test: lives('grassland') },
    'Wetland Population Monitor': { kind: 'state', test: lives('wetland') },
    Ecologist: { kind: 'state' },
    Behaviorist: { kind: 'state' },
    Ethologist: { kind: 'state' },
    'Visionary Leader': { kind: 'state' },
    'Mechanical Engineer': { kind: 'state' },
    'Site Selection Expert': { kind: 'state' },
    'Winter Feeder': { kind: 'other' },

    // --- Americas: scored on hummingbird tokens, not on bird cards ---
    Apiarist: { kind: 'other' },
    'Brilliant Specialist': { kind: 'other' },
    'Emerald Specialist': { kind: 'other' },
    'Mango Specialist': { kind: 'other' },
    'Topaz Specialist': { kind: 'other' },
    'Ecolodge Owner': { kind: 'other' },
    'Hummingbird Counter': { kind: 'other' },
    'Hummingbird Gardener': { kind: 'other' },
};

/** Unknown cards (e.g. from a newer data version) are treated as game-state dependent. */
export function cardKind(cardName: string): CardKind {
    return RULES[cardName]?.kind ?? 'state';
}

export function isNameBased(cardName: string): boolean {
    return (NAME_BASED as readonly string[]).includes(cardName);
}

/** Does `bird` count for the bonus card `cardName` (English name) in this edition? */
export function verdict(bird: Bird, cardName: string, edition: Lang): Verdict {
    const rule = RULES[cardName] ?? { kind: 'state' as const };
    if (rule.kind === 'other') return 'n/a';
    if (rule.kind === 'state') return !rule.test || rule.test(bird) ? 'maybe' : 'no';
    if (isNameBased(cardName)) {
        const flags = edition === 'de' ? bird.flagsDe : bird.flags;
        if (!flags) return 'unknown';
        return flags.includes(cardName) ? 'yes' : 'no';
    }
    return bird.flags.includes(cardName) || !!rule.test?.(bird) ? 'yes' : 'no';
}

/** All known card rules (for tests and coverage checks). */
export const RULE_NAMES = Object.keys(RULES);
