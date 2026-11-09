/**
 * Pure helpers for the bonus card checker UI: forgiving name search,
 * set filtering and grouping of verdicts.
 */
import { isMainSet } from './normalize';
import { cardKind, verdict, type CardKind, type Verdict } from './rules';
import type { Bird, BonusCard, Lang, Text } from './types';

// ---------- text ----------

/** Text in the edition language, falling back to English. */
export function localText(text: Text, lang: Lang): string {
    return lang === 'de' ? (text.de ?? text.en) : text.en;
}

/** True if a German text was asked for but only the English one exists. */
export function isFallback(text: Text, lang: Lang): boolean {
    return lang === 'de' && !text.de;
}

/** The English name to show under a German one, if it differs; otherwise null. */
export function englishSubtitle(text: Text, lang: Lang): string | null {
    return lang === 'de' && text.de && fold(text.de) !== fold(text.en) ? text.en : null;
}

/** Second line under a bird name: the English name in DE mode, else the scientific name. */
export function birdSubtitle(b: Bird, lang: Lang): string {
    return englishSubtitle(b.name, lang) ?? b.scientific;
}

/**
 * Fold a string for searching: lower case, no accents or umlauts
 * ("Kākāpō" → "kakapo", "Grünfink" → "grunfink"), ß → ss, and without
 * spaces, hyphens and other punctuation ("Black-capped" → "blackcapped").
 */
export function fold(s: string): string {
    return s
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Like {@link fold} but spells umlauts the German way ("ü" → "ue"). */
function foldGerman(s: string): string {
    return fold(s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue'));
}

/** All folded forms a search may match, separated by spaces (which a folded query never contains). */
export function searchKey(...names: (string | null | undefined)[]): string {
    const keys = new Set<string>();
    for (const n of names) {
        if (!n) continue;
        keys.add(fold(n));
        keys.add(foldGerman(n));
        // Word starts, so "kehlchen" ranks below "schwarz…" but "capped" still ranks as a word start.
        for (const w of n.split(/[\s\-–'’]+/).slice(1)) if (w) keys.add('^' + fold(w));
    }
    return [...keys].join(' ');
}

/**
 * How well `query` (already folded) matches: 0 = the display name starts
 * with it, 1 = another name or a word starts with it, 2 = contained
 * somewhere, -1 = no match.
 */
export function matchRank(query: string, display: string, key: string): number {
    if (!query) return 0;
    if (fold(display).startsWith(query)) return 0;
    if ((' ' + key).includes(' ' + query) || key.includes('^' + query)) return 1;
    return key.includes(query) ? 2 : -1;
}

const collator = (lang: Lang) => new Intl.Collator(lang, { sensitivity: 'base' });

/** Search items by a forgiving query; best matches first, then alphabetical. */
export function searchBy<T>(
    items: readonly T[],
    query: string,
    display: (item: T) => string,
    key: (item: T) => string,
    lang: Lang,
): T[] {
    const q = fold(query);
    const cmp = collator(lang);
    return items
        .map(item => ({ item, name: display(item), rank: matchRank(q, display(item), key(item)) }))
        .filter(x => x.rank >= 0)
        .sort((a, b) => a.rank - b.rank || cmp.compare(a.name, b.name))
        .map(x => x.item);
}

const birdKeys = new WeakMap<Bird, string>();
const cardKeys = new WeakMap<BonusCard, string>();

export function birdSearchKey(b: Bird): string {
    let k = birdKeys.get(b);
    if (k === undefined) birdKeys.set(b, (k = searchKey(b.name.de, b.name.en, b.scientific)));
    return k;
}

export function cardSearchKey(c: BonusCard): string {
    let k = cardKeys.get(c);
    if (k === undefined) cardKeys.set(c, (k = searchKey(c.name.de, c.name.en)));
    return k;
}

export function searchBirds(birds: readonly Bird[], query: string, lang: Lang): Bird[] {
    return searchBy(birds, query, b => localText(b.name, lang), birdSearchKey, lang);
}

export function searchCards(cards: readonly BonusCard[], query: string, lang: Lang): BonusCard[] {
    return searchBy(cards, query, c => localText(c.name, lang), cardSearchKey, lang);
}

// ---------- sets ----------

/** The set chips of the checker settings; `promo` stands for every promo pack. */
export const SET_CHIPS = ['core', 'european', 'oceania', 'asia', 'americas', 'promo'] as const;
export type SetChip = (typeof SET_CHIPS)[number];

/** Which chip a card set belongs to. */
export function chipOf(set: string): SetChip {
    return isMainSet(set) ? (set as SetChip) : 'promo';
}

export function inSets(set: string, chips: readonly SetChip[]): boolean {
    return chips.includes(chipOf(set));
}

/** Toggle a chip; the last selected chip cannot be removed. Keeps the canonical order. */
export function toggleChip(chips: readonly SetChip[], chip: SetChip): SetChip[] {
    const on = chips.includes(chip);
    if (on && chips.length === 1) return [...chips];
    return SET_CHIPS.filter(c => (c === chip ? !on : chips.includes(c)));
}

// ---------- verdicts ----------

export interface CardCheck {
    kind: CardKind;
    /** Birds per verdict, alphabetical in the edition language. */
    yes: Bird[];
    maybe: Bird[];
    no: Bird[];
    unknown: Bird[];
    /** state cards: every listed bird can count. */
    allCan: boolean;
}

/** Which of `birds` count for `card` in this edition. */
export function checkCard(birds: readonly Bird[], card: BonusCard, edition: Lang): CardCheck {
    const kind = cardKind(card.name.en);
    const res: CardCheck = { kind, yes: [], maybe: [], no: [], unknown: [], allCan: false };
    if (kind === 'other') return res;
    const cmp = collator(edition);
    const sorted = [...birds].sort((a, b) => cmp.compare(localText(a.name, edition), localText(b.name, edition)));
    for (const b of sorted) {
        const v = verdict(b, card.name.en, edition);
        if (v === 'yes') res.yes.push(b);
        else if (v === 'maybe') res.maybe.push(b);
        else if (v === 'unknown') res.unknown.push(b);
        else if (v === 'no') res.no.push(b);
    }
    res.allCan = kind === 'state' && res.no.length === 0 && res.maybe.length > 0;
    return res;
}

export interface BirdCheck {
    yes: BonusCard[];
    maybe: BonusCard[];
    no: BonusCard[];
    unknown: BonusCard[];
    /** Cards that are not about bird cards at all. */
    na: BonusCard[];
}

/** Which of `cards` the bird counts for in this edition. */
export function checkBird(bird: Bird, cards: readonly BonusCard[], edition: Lang): BirdCheck {
    const res: BirdCheck = { yes: [], maybe: [], no: [], unknown: [], na: [] };
    const cmp = collator(edition);
    const sorted = [...cards].sort((a, b) => cmp.compare(localText(a.name, edition), localText(b.name, edition)));
    const bucket: Record<Verdict, keyof BirdCheck> = { yes: 'yes', maybe: 'maybe', no: 'no', unknown: 'unknown', 'n/a': 'na' };
    for (const c of sorted) res[bucket[verdict(bird, c.name.en, edition)]].push(c);
    return res;
}

/** Shown list for a card while searching: every matching bird, best match first, with its verdict. */
export function searchCardBirds(
    birds: readonly Bird[],
    card: BonusCard,
    query: string,
    edition: Lang,
): { bird: Bird; verdict: Verdict }[] {
    return searchBirds(birds, query, edition).map(bird => ({ bird, verdict: verdict(bird, card.name.en, edition) }));
}
