/**
 * How phones talk to each other. Two implementations behind one interface:
 *
 * - `trystero`: real phones. Direct WebRTC connections; public Nostr relays
 *   are only used to introduce the peers (signalling, encrypted with the room
 *   code). Loaded on demand so the normal app does not ship it.
 * - `local`: tabs of the same browser via BroadcastChannel. Used for tests and
 *   development (`?transport=local`); never leaves the device.
 */
export interface Transport {
    readonly selfId: string;
    /** Send to everyone, or only to `target`. */
    send(message: unknown, target?: string): void;
    onMessage(handler: (message: unknown, peerId: string) => void): void;
    onPeerJoin(handler: (peerId: string) => void): void;
    onPeerLeave(handler: (peerId: string) => void): void;
    leave(): void;
}

export type TransportKind = 'trystero' | 'local';

const APP_ID = 'wingspan-calc.moefourtytwo.github.io';
const ACTION = 'wsc'; // one action carries every message; the payload says what it is

export function transportKind(search: string = location.search): TransportKind {
    return new URLSearchParams(search).get('transport') === 'local' ? 'local' : 'trystero';
}

export async function openTransport(room: string, kind: TransportKind = transportKind()): Promise<Transport> {
    return kind === 'local' ? localTransport(room) : trysteroTransport(room);
}

async function trysteroTransport(room: string): Promise<Transport> {
    const { joinRoom, selfId } = await import('trystero');
    const r = joinRoom({ appId: APP_ID, password: room }, room);
    const action = r.makeAction(ACTION);
    return {
        selfId,
        send: (message, target) => {
            void action.send(message as never, target ? { target } : undefined).catch(() => {});
        },
        onMessage: handler => {
            action.onMessage = (data, ctx) => handler(data, ctx.peerId);
        },
        onPeerJoin: handler => {
            r.onPeerJoin = handler;
        },
        onPeerLeave: handler => {
            r.onPeerLeave = handler;
        },
        leave: () => void r.leave(),
    };
}

/** Same-browser transport for tests: every tab on the channel is a peer. */
export function localTransport(room: string): Transport {
    const selfId = crypto.randomUUID().slice(0, 12);
    const channel = new BroadcastChannel(`wsc-room-${room}`);
    const peers = new Set<string>();
    let onMsg: (m: unknown, peer: string) => void = () => {};
    let onJoin: (peer: string) => void = () => {};
    let onLeave: (peer: string) => void = () => {};

    type Frame = { from: string; to?: string; kind: 'hi' | 'hi-back' | 'bye' | 'msg'; body?: unknown };
    const post = (f: Omit<Frame, 'from'>) => channel.postMessage({ ...f, from: selfId });

    const join = (peer: string) => {
        if (peers.has(peer)) return;
        peers.add(peer);
        onJoin(peer);
    };

    channel.onmessage = (ev: MessageEvent<Frame>) => {
        const f = ev.data;
        if (!f || f.from === selfId || (f.to && f.to !== selfId)) return;
        if (f.kind === 'hi') {
            post({ kind: 'hi-back', to: f.from });
            join(f.from);
        } else if (f.kind === 'hi-back') {
            join(f.from);
        } else if (f.kind === 'bye') {
            if (peers.delete(f.from)) onLeave(f.from);
        } else if (peers.has(f.from)) {
            onMsg(f.body, f.from);
        }
    };
    const bye = () => post({ kind: 'bye' });
    addEventListener('pagehide', bye);
    // Announce after handlers had a chance to be registered.
    setTimeout(() => post({ kind: 'hi' }), 0);

    return {
        selfId,
        send: (body, to) => post({ kind: 'msg', to, body }),
        onMessage: h => (onMsg = h),
        onPeerJoin: h => {
            onJoin = h;
            peers.forEach(h);
        },
        onPeerLeave: h => (onLeave = h),
        leave: () => {
            bye();
            removeEventListener('pagehide', bye);
            channel.close();
        },
    };
}
