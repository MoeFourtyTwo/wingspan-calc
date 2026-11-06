import { writable } from 'svelte/store';
import { SETS, type CardSet, type Edition } from '../data/types';

/** Remembered choices of the setup helper (per device). */
export interface SetupPrefs {
    /** Expansions whose cards and goal tiles are on the table. */
    sets: CardSet[];
    /** Language edition of the physical cards. */
    edition: Edition;
    /** Apply Feuerland's bonus card removal table (German edition only). */
    applyEditionRemovals: boolean;
}

const KEY = 'wingspan_setup_prefs';

export function defaultPrefs(language: Edition): SetupPrefs {
    return { sets: ['core'], edition: language, applyEditionRemovals: true };
}

export function parsePrefs(raw: unknown, language: Edition): SetupPrefs {
    const d = defaultPrefs(language);
    if (!raw || typeof raw !== 'object') return d;
    const r = raw as Partial<SetupPrefs>;
    const sets = Array.isArray(r.sets) ? SETS.filter(s => r.sets!.includes(s)) : d.sets;
    return {
        sets: sets.length ? sets : d.sets,
        edition: r.edition === 'en' || r.edition === 'de' ? r.edition : d.edition,
        applyEditionRemovals: typeof r.applyEditionRemovals === 'boolean' ? r.applyEditionRemovals : true,
    };
}

export function createSetupPrefs(language: Edition) {
    let initial = defaultPrefs(language);
    try {
        const stored = globalThis.localStorage?.getItem(KEY);
        if (stored) initial = parsePrefs(JSON.parse(stored), language);
    } catch {
        /* ignore */
    }
    const store = writable<SetupPrefs>(initial);
    store.subscribe(p => {
        try {
            globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
        } catch {
            /* ignore */
        }
    });
    return store;
}
