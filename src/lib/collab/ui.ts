/**
 * App-level wiring of shared games: the share sheet, derived views of the
 * host/guest cores, joining from the URL hash and the phone's label.
 */
import { derived, get, writable, type Readable } from 'svelte/store';
import { roomFromHash } from './protocol';
import {
    hosting,
    joinGame,
    joined,
    leaveGame,
    shouldResumeHosting,
    startHosting,
    stopHosting,
    type GuestView,
    type HostView,
} from './session';

/** Whether the host's share sheet (QR code, connected phones) is open. */
export const shareOpen = writable(false);
/** Set when opening the room failed (e.g. offline, relays unreachable). */
export const hostError = writable(false);

/** The running host session's view, or null when not hosting. */
export const hostView: Readable<HostView | null> = derived(
    hosting,
    ($h, set) => {
        if (!$h) return set(null);
        return $h.view.subscribe(set);
    },
    null as HostView | null,
);

/** The joined game's guest view, or null when not a guest. */
export const guestView: Readable<GuestView | null> = derived(
    joined,
    ($g, set) => {
        if (!$g) return set(null);
        return $g.view.subscribe(set);
    },
    null as GuestView | null,
);

/** Number of guest phones currently online. */
export const onlinePhones = derived(hostView, $v => (($v ? Object.values($v.devices) : []).filter(d => d.online).length));

let starting: Promise<unknown> | null = null;

/** Open this game for other phones (idempotent). */
export function host() {
    if (get(hosting) || starting) return;
    hostError.set(false);
    starting = startHosting()
        .catch(err => {
            console.warn('Could not open the room', err);
            hostError.set(true);
        })
        .finally(() => (starting = null));
}

export function openShare() {
    shareOpen.set(true);
    host();
}

export function endSharing() {
    stopHosting();
    shareOpen.set(false);
}

// ---------------------------------------------------------------- guest

const LABEL_KEY = 'wingspan_device_label';

/** The name the user gave this phone, or '' to name it after its players. */
export function customLabel(): string {
    try {
        return localStorage.getItem(LABEL_KEY) ?? '';
    } catch {
        return '';
    }
}

export function setCustomLabel(label: string) {
    try {
        if (label.trim()) localStorage.setItem(LABEL_KEY, label.trim().slice(0, 40));
        else localStorage.removeItem(LABEL_KEY);
    } catch {
        /* ignore */
    }
}

const setHash = (hash: string) => history.replaceState(history.state, '', location.pathname + location.search + hash);

/** Join a game; keeps `#join=CODE` in the URL so a reload rejoins. */
export function joinRoom(code: string, label: string) {
    if (get(hosting)) stopHosting();
    shareOpen.set(false);
    if (roomFromHash(location.hash) !== code) setHash(`#join=${code}`);
    return joinGame(code, label).catch(err => console.warn('Could not join', err));
}

/** Leave the shared game and go back to this phone's own game. */
export function leaveRoom() {
    leaveGame();
    setHash('');
}

/** On app start: join from the link, or reopen a room this phone hosted before a reload. */
export function initCollab(defaultLabel: () => string) {
    const fromHash = () => {
        const code = roomFromHash(location.hash);
        const current = get(joined);
        if (!code || (current && get(current.view).room === code)) return false;
        void joinRoom(code, customLabel() || defaultLabel());
        return true;
    };
    if (!fromHash() && shouldResumeHosting()) host();
    addEventListener('hashchange', fromHash);
    return () => removeEventListener('hashchange', fromHash);
}
