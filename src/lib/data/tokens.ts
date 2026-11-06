/**
 * Icon tokens used in card texts (e.g. "[forest]") and how to render them.
 * The German names of the five Americas hummingbird groups are provisional.
 */
import type { Edition } from './types';

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
};

/** Replace `[token]` markers with readable words in the given language. */
export function renderTokens(text: string, lang: Edition): string {
    return text
        .replace(/\[([a-z_-]+)\]/g, (m, key: string) => TOKENS[key]?.[lang] ?? m)
        .replace(/(\d)(pts|Pkt\.)/g, '$1 $2')
        .replace(/(\p{L}*nest)[ -]Nest\b/gu, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
