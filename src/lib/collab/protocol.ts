/**
 * Messages exchanged between the host phone and guest phones in a shared
 * game. The host is the single source of truth: guests send small edits for
 * the players they score, the host applies them and broadcasts the full game.
 *
 * Everything received from another device is untrusted and validated here.
 */
import { activeCategories, isPlacementCategory } from '../store';
import type { GameState, PlayerEdit } from '../store';
import { CATEGORIES, HABITATS, NECTAR_POINTS, ROUND_COUNT, ROUND_GOAL_POINTS, type Category } from '../rules/scoring';

export const PROTOCOL_VERSION = 1;

/** Guest → host */
export type GuestMessage =
    | { t: 'hello'; v: number; deviceId: string; label: string }
    | { t: 'claim'; playerIds: string[] }
    | { t: 'edit'; edit: PlayerEdit };

/** Host → guest */
export interface HostState {
    t: 'state';
    v: number;
    /** Increases with every broadcast; guests ignore older snapshots. */
    seq: number;
    game: GameState;
    /** playerId → deviceId of the phone scoring that player. */
    claims: Record<string, string>;
    /** deviceId → label of connected guest phones. */
    devices: Record<string, string>;
    /** Per player: categories entered from a guest phone. */
    filled: Record<string, string[]>;
}

export type HostMessage = HostState | { t: 'bye'; reason: 'ended' };

/** Room codes: no 0/O/1/I/L so they are easy to read aloud and type. */
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function newRoomCode(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
    const bytes = random(ROOM_CODE_LENGTH);
    return Array.from(bytes, b => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

/** Normalise a typed code ("abc-def" → "ABCDEF"); null if it cannot be a room code. */
export function parseRoomCode(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const code = input.toUpperCase().replace(/[\s-]/g, '');
    if (code.length !== ROOM_CODE_LENGTH) return null;
    return [...code].every(c => ROOM_ALPHABET.includes(c)) ? code : null;
}

/** Join link that the QR code encodes, e.g. https://…/wingspan-calc/#join=ABCDEF */
export function joinUrl(code: string, base: string = location.origin + location.pathname): string {
    return `${base}#join=${code}`;
}

/** Room code from a location hash like "#join=ABCDEF". */
export function roomFromHash(hash: string): string | null {
    const m = /(?:^#|&)join=([^&]+)/.exec(hash);
    return m ? parseRoomCode(decodeURIComponent(m[1])) : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isInt = (v: unknown, min: number, max: number): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Validate a raw guest message's shape (not yet against the game). */
export function parseGuestMessage(raw: unknown): GuestMessage | null {
    if (!isObj(raw)) return null;
    switch (raw.t) {
        case 'hello':
            return typeof raw.v === 'number' && isId(raw.deviceId) && typeof raw.label === 'string'
                ? { t: 'hello', v: raw.v, deviceId: raw.deviceId, label: raw.label.trim().slice(0, 40) }
                : null;
        case 'claim':
            return Array.isArray(raw.playerIds) && raw.playerIds.length <= 7 && raw.playerIds.every(isId)
                ? { t: 'claim', playerIds: [...new Set(raw.playerIds as string[])] }
                : null;
        case 'edit': {
            const e = raw.edit;
            if (!isObj(e) || !isId(e.playerId)) return null;
            if (e.k === 'score' && typeof e.category === 'string' && typeof e.value === 'number' && Number.isFinite(e.value)) {
                return { t: 'edit', edit: { k: 'score', playerId: e.playerId, category: e.category as Category, value: e.value } };
            }
            if ((e.k === 'round' || e.k === 'nectar') && typeof e.index === 'number' && typeof e.rank === 'number') {
                return { t: 'edit', edit: { k: e.k, playerId: e.playerId, index: e.index, rank: e.rank } };
            }
            if (e.k === 'food' && typeof e.amount === 'number' && Number.isFinite(e.amount)) {
                return { t: 'edit', edit: { k: 'food', playerId: e.playerId, amount: e.amount } };
            }
            return null;
        }
        default:
            return null;
    }
}

export type EditRejection = 'unknown-player' | 'not-claimed' | 'bad-category' | 'bad-index' | 'bad-rank' | 'wrong-phase';

/**
 * Check an edit against the host's current game: the player exists and is
 * claimed by the sending device, the category is active and typed (not a
 * placement), and indices/ranks are in range. Returns null if allowed.
 */
export function checkEdit(edit: PlayerEdit, game: GameState, claims: Record<string, string>, deviceId: string): EditRejection | null {
    if (game.currentPhase !== 'SCORING' && game.currentPhase !== 'RESULT') return 'wrong-phase';
    if (!game.players.some(p => p.id === edit.playerId)) return 'unknown-player';
    if (claims[edit.playerId] !== deviceId) return 'not-claimed';
    switch (edit.k) {
        case 'score': {
            const cats = activeCategories(game.options) as string[];
            if (!(CATEGORIES as readonly string[]).includes(edit.category) || !cats.includes(edit.category)) return 'bad-category';
            if (isPlacementCategory(edit.category, game.options)) return 'bad-category';
            return null;
        }
        case 'round':
            if (game.options.roundGoalMode !== 'competitive') return 'bad-category';
            if (!isInt(edit.index, 0, ROUND_COUNT - 1)) return 'bad-index';
            return isInt(edit.rank, 0, ROUND_GOAL_POINTS[edit.index].length) ? null : 'bad-rank';
        case 'nectar':
            if (!game.options.oceania) return 'bad-category';
            if (!isInt(edit.index, 0, HABITATS.length - 1)) return 'bad-index';
            return isInt(edit.rank, 0, NECTAR_POINTS.length) ? null : 'bad-rank';
        case 'food':
            return null;
    }
}

/** Validate a host snapshot's envelope (the game itself is checked by restoreGame). */
export function parseHostMessage(raw: unknown): HostMessage | null {
    if (!isObj(raw)) return null;
    if (raw.t === 'bye') return { t: 'bye', reason: 'ended' };
    if (raw.t !== 'state' || typeof raw.seq !== 'number' || !isObj(raw.game)) return null;
    const strMap = (v: unknown): Record<string, string> =>
        isObj(v) ? Object.fromEntries(Object.entries(v).filter(([k, x]) => isId(k) && typeof x === 'string').map(([k, x]) => [k, String(x).slice(0, 64)])) : {};
    const filled = isObj(raw.filled)
        ? Object.fromEntries(
              Object.entries(raw.filled)
                  .filter(([k, x]) => isId(k) && Array.isArray(x))
                  .map(([k, x]) => [k, (x as unknown[]).filter((c): c is string => typeof c === 'string')]),
          )
        : {};
    return {
        t: 'state',
        v: typeof raw.v === 'number' ? raw.v : 0,
        seq: raw.seq,
        game: raw.game as unknown as GameState,
        claims: strMap(raw.claims),
        devices: strMap(raw.devices),
        filled,
    };
}

/** Apply a claim request: take free players, keep own, release the rest. */
export function applyClaim(claims: Record<string, string>, deviceId: string, playerIds: string[], validIds: string[]): Record<string, string> {
    const next: Record<string, string> = {};
    for (const [pid, owner] of Object.entries(claims)) {
        if (owner !== deviceId && validIds.includes(pid)) next[pid] = owner;
    }
    for (const pid of playerIds) {
        if (validIds.includes(pid) && !next[pid]) next[pid] = deviceId;
    }
    return next;
}

/** Release everything a device had claimed. */
export function releaseDevice(claims: Record<string, string>, deviceId: string): Record<string, string> {
    return Object.fromEntries(Object.entries(claims).filter(([, owner]) => owner !== deviceId));
}
