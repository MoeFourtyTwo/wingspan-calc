/**
 * Loads the community card database at runtime.
 *
 * The data comes from the open-source project wingsearch
 * (https://github.com/navarog/wingsearch, GPL-3.0). It is *not* bundled with
 * this app: it is downloaded on demand, pinned to one commit so a later
 * format change upstream cannot break the checker, normalised, and cached
 * on the device so the checker keeps working offline at the table.
 */
import { writable } from 'svelte/store';
import { normalize, type RawSources } from './normalize';
import type { CheckerData } from './types';

/** Pinned wingsearch commit. Bump deliberately after checking the data still normalises. */
export const DATA_COMMIT = '43e5036de9e68fa9c4fabaf4c760412a887adf05';
export const DATA_PROJECT_URL = 'https://github.com/navarog/wingsearch';

const FILES = {
    master: 'master.json',
    hummingbirds: 'hummingbirds.json',
    bonus: 'bonus.json',
    de: 'i18n/de.json',
} as const satisfies Record<keyof RawSources, string>;

/** Mirrors serving the pinned files with CORS; tried in order. */
export const MIRRORS = [
    (file: string) => `https://raw.githubusercontent.com/navarog/wingsearch/${DATA_COMMIT}/src/assets/data/${file}`,
    (file: string) => `https://cdn.jsdelivr.net/gh/navarog/wingsearch@${DATA_COMMIT}/src/assets/data/${file}`,
];

const CACHE_KEY = `wingspan_checker_${DATA_COMMIT.slice(0, 12)}`;
const CACHE_VERSION = 1;

type Fetch = typeof fetch;

async function fetchJson(file: string, fetchFn: Fetch): Promise<unknown> {
    let lastError: unknown;
    for (const url of MIRRORS) {
        try {
            const res = await fetchFn(url(file));
            if (!res.ok) throw new Error(`${res.status} ${url(file)}`);
            return await res.json();
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function downloadData(fetchFn: Fetch = fetch): Promise<CheckerData> {
    const keys = Object.keys(FILES) as (keyof RawSources)[];
    const raw = await Promise.all(keys.map(k => fetchJson(FILES[k], fetchFn)));
    const data = normalize(Object.fromEntries(keys.map((k, i) => [k, raw[i]])) as unknown as RawSources);
    if (data.birds.length === 0 || data.bonusCards.length === 0) throw new Error('Card data is empty');
    return data;
}

export function readCache(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): CheckerData | null {
    try {
        const raw = storage?.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { v: number; data: CheckerData };
        if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.data?.birds) || !Array.isArray(parsed.data?.bonusCards)) {
            return null;
        }
        return parsed.data;
    } catch {
        return null;
    }
}

export function writeCache(data: CheckerData, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage) {
    try {
        storage?.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, data }));
    } catch {
        /* storage full or unavailable – the checker just reloads next time */
    }
}

export type LoadState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; data: CheckerData; fromCache: boolean }
    | { status: 'error'; message: string };

export const checkerData = writable<LoadState>({ status: 'idle' });

let pending: Promise<void> | null = null;

/** Load once per session: cache first, otherwise download (and cache). */
export function loadCheckerData(fetchFn: Fetch = fetch): Promise<void> {
    if (pending) return pending;
    const cached = readCache();
    if (cached) {
        checkerData.set({ status: 'ready', data: cached, fromCache: true });
        return (pending = Promise.resolve());
    }
    checkerData.set({ status: 'loading' });
    pending = downloadData(fetchFn)
        .then(data => {
            writeCache(data);
            checkerData.set({ status: 'ready', data, fromCache: false });
        })
        .catch(e => {
            pending = null; // allow a retry
            checkerData.set({ status: 'error', message: e instanceof Error ? e.message : String(e) });
        });
    return pending;
}
