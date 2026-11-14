import { writable } from 'svelte/store';
import { GOAL_TILES } from '../data/goalTiles';
import { SETS, type CardSet } from '../data/types';

/** Expansions that contain round goal tiles for the normal game (not Asia). */
export const GOAL_SETS: readonly CardSet[] = SETS.filter(s => GOAL_TILES.some(t => t.set === s));

/** Remembered choices of the setup helper (per device). */
export interface SetupPrefs {
    /** Expansions whose goal tiles are in the box. */
    sets: CardSet[];
    /** House rule: "No goal" (Oceania) may only be the round 1 goal. */
    noGoalFirstRound: boolean;
}

const KEY = 'wingspan_setup_prefs';

export function defaultPrefs(): SetupPrefs {
    return { sets: ['core'], noGoalFirstRound: false };
}

export function parsePrefs(raw: unknown): SetupPrefs {
    if (!raw || typeof raw !== 'object') return defaultPrefs();
    const r = raw as Partial<SetupPrefs>;
    const sets = Array.isArray(r.sets) ? GOAL_SETS.filter(s => r.sets!.includes(s)) : [];
    return {
        sets: sets.length ? sets : defaultPrefs().sets,
        noGoalFirstRound: r.noGoalFirstRound === true,
    };
}

export function createSetupPrefs() {
    let initial = defaultPrefs();
    try {
        const stored = globalThis.localStorage?.getItem(KEY);
        if (stored) initial = parsePrefs(JSON.parse(stored));
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

/** App-wide prefs store. */
export const setupPrefs = createSetupPrefs();
