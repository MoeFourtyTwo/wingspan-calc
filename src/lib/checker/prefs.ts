/**
 * Remembered settings of the bonus card checker (per device).
 */
import { writable } from 'svelte/store';
import { SET_CHIPS, type SetChip } from './search';
import type { Lang } from './types';

export interface CheckerPrefs {
    /** Card edition; null = follow the UI language. */
    edition: Lang | null;
    /** Sets in the game; null = not chosen yet (derived from the game options on first use). */
    sets: SetChip[] | null;
}

export const CHECKER_PREFS_KEY = 'wingspan_checker_prefs';

export function defaultCheckerPrefs(): CheckerPrefs {
    return { edition: null, sets: null };
}

/** Validate stored prefs; anything unknown falls back to the defaults. */
export function parseCheckerPrefs(raw: unknown): CheckerPrefs {
    if (!raw || typeof raw !== 'object') return defaultCheckerPrefs();
    const r = raw as Record<string, unknown>;
    const edition = r.edition === 'en' || r.edition === 'de' ? r.edition : null;
    const sets = Array.isArray(r.sets) ? SET_CHIPS.filter(c => (r.sets as unknown[]).includes(c)) : [];
    return { edition, sets: sets.length ? sets : null };
}

/** Sets pre-selected from the game options: the core game plus the expansions in play. */
export function setsFromOptions(options: { oceania?: boolean; americas?: boolean } | undefined): SetChip[] {
    return SET_CHIPS.filter(c => c === 'core' || (c === 'oceania' && !!options?.oceania) || (c === 'americas' && !!options?.americas));
}

/** The effective settings. */
export function resolvePrefs(
    prefs: CheckerPrefs,
    uiLang: Lang,
    options: { oceania?: boolean; americas?: boolean } | undefined,
): { edition: Lang; sets: SetChip[] } {
    return { edition: prefs.edition ?? uiLang, sets: prefs.sets ?? setsFromOptions(options) };
}

export function createCheckerPrefs(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
    let initial = defaultCheckerPrefs();
    try {
        const stored = storage?.getItem(CHECKER_PREFS_KEY);
        if (stored) initial = parseCheckerPrefs(JSON.parse(stored));
    } catch {
        /* storage unavailable or corrupt */
    }
    const store = writable<CheckerPrefs>(initial);
    store.subscribe(p => {
        try {
            storage?.setItem(CHECKER_PREFS_KEY, JSON.stringify(p));
        } catch {
            /* storage unavailable */
        }
    });
    return store;
}

export const checkerPrefs = createCheckerPrefs();
