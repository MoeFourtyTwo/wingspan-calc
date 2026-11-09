/**
 * Shared game sessions: one host phone, any number of guest phones.
 *
 * The host owns the game. Guests claim the players they score, send edits
 * for them, and show the host's latest snapshot. Claims belong to a stable
 * device id, so a phone that locks, reloads or briefly drops out comes back
 * with its players.
 *
 * `createHostCore` / `createGuestCore` take their store and transport as
 * parameters so they can be tested without a network; the app wires them up
 * with {@link startHosting} and {@link joinGame}.
 */
import { get, writable, type Readable } from 'svelte/store';
import { gameStore, type GameState, type PlayerEdit } from '../store';
import {
    PROTOCOL_VERSION,
    applyClaim,
    checkEdit,
    newRoomCode,
    parseGuestMessage,
    parseHostMessage,
    releaseDevice,
    type HostState,
} from './protocol';
import { openTransport, type Transport, type TransportKind } from './transport';

/** The parts of the game store a session needs (lets tests use their own stores). */
export interface GameAccess {
    subscribe: Readable<GameState>['subscribe'];
    applyEdit(edit: PlayerEdit): void;
}
export interface MirrorAccess {
    subscribe: Readable<GameState>['subscribe'];
    enterMirror(onEdit: (edit: PlayerEdit) => void): void;
    applySnapshot(raw: unknown): void;
    leaveMirror(): void;
}

// ---------------------------------------------------------------- host

export interface HostView {
    room: string;
    /** deviceId → { label, online } */
    devices: Record<string, { label: string; online: boolean }>;
    claims: Record<string, string>;
    filled: Record<string, string[]>;
}

export function createHostCore(room: string, transport: Transport, game: GameAccess, { throttleMs = 60 } = {}) {
    let current: GameState;
    let claims: Record<string, string> = {};
    let filled: Record<string, string[]> = {};
    const devices: HostView['devices'] = {};
    const peerDevice = new Map<string, string>();
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const view = writable<HostView>({ room, devices: {}, claims: {}, filled: {} });
    const publish = () => view.set({ room, devices: { ...devices }, claims: { ...claims }, filled: { ...filled } });

    const snapshot = (): HostState => {
        const validIds = new Set(current.players.map(p => p.id));
        claims = Object.fromEntries(Object.entries(claims).filter(([pid]) => validIds.has(pid)));
        return {
            t: 'state',
            v: PROTOCOL_VERSION,
            seq: ++seq,
            game: current,
            claims,
            devices: Object.fromEntries(Object.entries(devices).filter(([, d]) => d.online).map(([id, d]) => [id, d.label])),
            filled,
        };
    };

    const broadcast = () => {
        if (timer) return;
        timer = setTimeout(() => {
            timer = null;
            transport.send(snapshot());
        }, throttleMs);
    };

    const unsubscribe = game.subscribe(state => {
        const newGame = current && current.gameId !== state.gameId;
        current = state;
        if (newGame) {
            claims = {};
            filled = {};
        }
        publish();
        broadcast();
    });

    transport.onPeerJoin(peer => transport.send(snapshot(), peer));
    transport.onPeerLeave(peer => {
        const device = peerDevice.get(peer);
        peerDevice.delete(peer);
        if (device && devices[device] && ![...peerDevice.values()].includes(device)) {
            devices[device] = { ...devices[device], online: false };
            publish();
            broadcast();
        }
    });
    transport.onMessage((raw, peer) => {
        const msg = parseGuestMessage(raw);
        if (!msg) return;
        if (msg.t === 'hello') {
            peerDevice.set(peer, msg.deviceId);
            devices[msg.deviceId] = { label: msg.label || 'Handy', online: true };
            publish();
            transport.send(snapshot(), peer);
            return;
        }
        const device = peerDevice.get(peer);
        if (!device) return; // must say hello first
        if (msg.t === 'claim') {
            claims = applyClaim(claims, device, msg.playerIds, current.players.map(p => p.id));
        } else if (msg.t === 'edit') {
            if (checkEdit(msg.edit, current, claims, device)) {
                transport.send(snapshot(), peer); // undo the guest's optimistic change
                return;
            }
            game.applyEdit(msg.edit);
            if (msg.edit.k === 'score') {
                const list = filled[msg.edit.playerId] ?? [];
                if (!list.includes(msg.edit.category)) filled = { ...filled, [msg.edit.playerId]: [...list, msg.edit.category] };
            }
        }
        publish();
        broadcast();
    });

    return {
        view: { subscribe: view.subscribe } as Readable<HostView>,
        /** Release a device's players (e.g. the host took over scoring them). */
        release(deviceId: string) {
            claims = releaseDevice(claims, deviceId);
            publish();
            broadcast();
        },
        stop() {
            if (timer) clearTimeout(timer);
            transport.send({ t: 'bye', reason: 'ended' });
            unsubscribe();
            transport.leave();
        },
    };
}

// ---------------------------------------------------------------- guest

export type GuestStatus = 'connecting' | 'connected' | 'ended';

export interface GuestView {
    room: string;
    status: GuestStatus;
    deviceId: string;
    claims: Record<string, string>;
    devices: Record<string, string>;
    filled: Record<string, string[]>;
}

export function createGuestCore(room: string, transport: Transport, game: MirrorAccess, deviceId: string, label: string) {
    let hostPeer: string | null = null;
    let lastSeq = -1;
    const view = writable<GuestView>({ room, status: 'connecting', deviceId, claims: {}, devices: {}, filled: {} });
    const hello = () => ({ t: 'hello', v: PROTOCOL_VERSION, deviceId, label });

    game.enterMirror(edit => {
        if (hostPeer) transport.send({ t: 'edit', edit }, hostPeer);
    });

    transport.onPeerJoin(peer => transport.send(hello(), peer));
    transport.onPeerLeave(peer => {
        if (peer === hostPeer) {
            hostPeer = null;
            view.update(v => (v.status === 'ended' ? v : { ...v, status: 'connecting' }));
        }
    });
    transport.onMessage((raw, peer) => {
        const msg = parseHostMessage(raw);
        if (!msg) return;
        if (msg.t === 'bye') {
            if (peer === hostPeer) view.update(v => ({ ...v, status: 'ended' }));
            return;
        }
        // A different (e.g. reloaded) host starts its own sequence.
        if (peer === hostPeer && msg.seq <= lastSeq) return;
        let claims = msg.claims;
        if (peer !== hostPeer) {
            transport.send(hello(), peer);
            // A reloaded host forgot who scores whom: claim our players again.
            const ids = new Set(Array.isArray(msg.game?.players) ? msg.game.players.map(p => p?.id) : []);
            const mine = Object.entries(get(view).claims)
                .filter(([pid, d]) => d === deviceId && ids.has(pid) && !claims[pid])
                .map(([pid]) => pid);
            if (mine.length > 0 && !Object.values(claims).includes(deviceId)) {
                transport.send({ t: 'claim', playerIds: mine }, peer);
                claims = { ...claims, ...Object.fromEntries(mine.map(pid => [pid, deviceId])) };
            }
        }
        hostPeer = peer;
        lastSeq = msg.seq;
        game.applySnapshot(msg.game);
        view.update(v => ({ ...v, status: 'connected', claims, devices: msg.devices, filled: msg.filled }));
    });

    return {
        view: { subscribe: view.subscribe } as Readable<GuestView>,
        /** The players this phone scores (replaces the previous choice). */
        claim(playerIds: string[]) {
            if (hostPeer) transport.send({ t: 'claim', playerIds }, hostPeer);
            // optimistic: show the choice right away; the host's snapshot confirms it
            view.update(v => {
                const claims = Object.fromEntries(Object.entries(v.claims).filter(([, d]) => d !== deviceId));
                for (const id of playerIds) if (!claims[id]) claims[id] = deviceId;
                return { ...v, claims };
            });
        },
        /** Rename this phone (shown in the host's list of connected phones). */
        setLabel(next: string) {
            const trimmed = next.trim().slice(0, 40);
            if (!trimmed || trimmed === label) return;
            label = trimmed;
            if (hostPeer) transport.send(hello(), hostPeer);
        },
        leave() {
            game.leaveMirror();
            transport.leave();
        },
    };
}

// ---------------------------------------------------------------- app wiring

const DEVICE_KEY = 'wingspan_device_id';
const HOST_KEY = 'wingspan_host_room';

export function deviceId(): string {
    try {
        let id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch {
        return crypto.randomUUID();
    }
}

type Host = ReturnType<typeof createHostCore>;
type Guest = ReturnType<typeof createGuestCore>;

/** The running host session on this phone, if any. */
export const hosting = writable<Host | null>(null);
/** The game this phone has joined as a guest, if any. */
export const joined = writable<Guest | null>(null);

/**
 * Open the current game for other phones. Reuses the room of this game after
 * a reload so connected phones find the host again.
 */
export async function startHosting(kind?: TransportKind): Promise<Host> {
    const existing = get(hosting);
    if (existing) return existing;
    const gameId = get(gameStore).gameId;
    let room = newRoomCode();
    try {
        const saved = JSON.parse(localStorage.getItem(HOST_KEY) ?? 'null') as { gameId: string; room: string } | null;
        if (saved?.gameId === gameId) room = saved.room;
        localStorage.setItem(HOST_KEY, JSON.stringify({ gameId, room }));
    } catch {
        /* ignore */
    }
    const host = createHostCore(room, await openTransport(room, kind), gameStore);
    hosting.set(host);
    return host;
}

export function stopHosting() {
    get(hosting)?.stop();
    hosting.set(null);
    try {
        localStorage.removeItem(HOST_KEY);
    } catch {
        /* ignore */
    }
}

/** Was this game shared before a reload? Then reopen it automatically. */
export function shouldResumeHosting(): boolean {
    try {
        const saved = JSON.parse(localStorage.getItem(HOST_KEY) ?? 'null') as { gameId: string } | null;
        return saved?.gameId === get(gameStore).gameId;
    } catch {
        return false;
    }
}

export async function joinGame(room: string, label: string, kind?: TransportKind): Promise<Guest> {
    get(joined)?.leave();
    const guest = createGuestCore(room, await openTransport(room, kind), gameStore, deviceId(), label);
    joined.set(guest);
    return guest;
}

export function leaveGame() {
    get(joined)?.leave();
    joined.set(null);
}
