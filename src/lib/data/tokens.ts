/**
 * Icon tokens used in card texts (e.g. "[forest]") and how to render them.
 * The German names of the five Americas hummingbird groups are provisional.
 */
import type { Lang } from './types';

export const TOKENS: Readonly<Record<string, { en: string; de: string }>> = {
    point: { en: 'pts', de: 'Pkt.' },
    forest: { en: 'forest', de: 'Wald' },
    grassland: { en: 'grassland', de: 'Grasland' },
    wetland: { en: 'wetland', de: 'Feuchtgebiet' },
    bowl: { en: 'bowl', de: 'Schalennest' },
    cavity: { en: 'cavity', de: 'Höhlennest' },
    ground: { en: 'ground', de: 'Bodennest' },
    platform: { en: 'platform', de: 'Plattformnest' },
    seed: { en: 'seed', de: 'Samen' },
    fruit: { en: 'fruit', de: 'Früchte' },
    fish: { en: 'fish', de: 'Fisch' },
    rodent: { en: 'rodent', de: 'Nager' },
    invertebrate: { en: 'invertebrate', de: 'Wirbellose' },
    wild: { en: 'any food', de: 'beliebiges Futter' },
    predator: { en: 'predator', de: 'Jäger' },
    flocking: { en: 'flocking', de: 'Schwarm' },
    hummingbird: { en: 'hummingbird', de: 'Kolibri' },
    bee: { en: 'bee', de: 'Bienen' },
    brilliant: { en: 'brilliant', de: 'Brillant' },
    emerald: { en: 'emerald', de: 'Smaragd' },
    mango: { en: 'mango', de: 'Mango' },
    topaz: { en: 'topaz', de: 'Topas' },
    // Used in bird powers and rulings (bonus card checker).
    nectar: { en: 'nectar', de: 'Nektar' },
    card: { en: 'card', de: 'Karte' },
    egg: { en: 'egg', de: 'Ei' },
    die: { en: 'die', de: 'Würfel' },
    dice: { en: 'dice', de: 'Würfel' },
    star: { en: 'star', de: 'Stern' },
    bird: { en: 'bird', de: 'Vogel' },
    cube: { en: 'action cube', de: 'Aktionswürfel' },
    automa: { en: 'Automa', de: 'Automa' },
    'duet-token': { en: 'Duet token', de: 'Duett-Marker' },
    'beak-left': { en: 'left-facing beak', de: 'Schnabel nach links' },
    bonus_cards: { en: 'bonus cards', de: 'Bonuskarten' },
};

/** Replace `[token]` markers with readable words in the given language. */
export function renderTokens(text: string, lang: Lang): string {
    return text
        .replace(/\[([a-z_-]+)\]/g, (m, key: string) => TOKENS[key]?.[lang] ?? m)
        .replace(/(\d)(pts|Pkt\.)/g, '$1 $2')
        .replace(/(\p{L}*nest)[ -]Nest\b/gu, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
