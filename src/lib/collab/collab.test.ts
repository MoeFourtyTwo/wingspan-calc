import { describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { createGameStore, type GameState } from '../store';
import {
    ROOM_ALPHABET,
    ROOM_CODE_LENGTH,
    applyClaim,
    checkEdit,
    joinUrl,
    newRoomCode,
    parseGuestMessage,
    parseHostMessage,
    parseRoomCode,
    releaseDevice,
    roomFromHash,
} from './protocol';
import { createGuestCore, createHostCore } from './session';
import type { Transport } from './transport';

// ---------------------------------------------------------------- in-memory network

function hub() {
    const peers = new Map<string, { onMsg: (m: unknown, from: string) => void; onJoin: (p: string) => void; onLeave: (p: string) => void }>();
    let n = 0;
    const deliver = (fn: () => void) => queueMicrotask(fn);
    return {
        connect(): Transport {
            const id = `peer${++n}`;
            const me = { onMsg: (_m: unknown, _f: string) => {}, onJoin: (_p: string) => {}, onLeave: (_p: string) => {} };
            const others = () => [...peers.entries()].filter(([pid]) => pid !== id);
            peers.set(id, me);
            deliver(() => {
                for (const [pid, p] of others()) {
                    p.onJoin(id);
                    me.onJoin(pid);
                }
            });
            return {
                selfId: id,
                send: (m, target) => {
                    const copy = JSON.parse(JSON.stringify(m));
                    for (const [pid, p] of others()) if (!target || target === pid) deliver(() => p.onMsg(copy, id));
                },
                onMessage: h => (me.onMsg = h),
                onPeerJoin: h => (me.onJoin = h),
                onPeerLeave: h => (me.onLeave = h),
                leave: () => {
                    peers.delete(id);
                    for (const [, p] of peers) deliver(() => p.onLeave(id));
                },
            };
        },
    };
}

const settle = () => new Promise(r => setTimeout(r, 10));

function setupHostGame() {
    const host = createGameStore({ persist: false });
    host.addPlayer('Robin', '#f00');
    host.addPlayer('Patricia', '#0f0');
    host.addPlayer('Moritz', '#00f');
    host.addPlayer('Mama', '#ff0');
    host.setPhase('SCORING');
    const ids = get(host).players.map(p => p.id);
    return { host, ids };
}

async function scenario() {
    const net = hub();
    const { host, ids } = setupHostGame();
    const hostCore = createHostCore('ROOM42', net.connect(), host, { throttleMs: 0 });
    const g1Store = createGameStore({ persist: false });
    const g2Store = createGameStore({ persist: false });
    const g1 = createGuestCore('ROOM42', net.connect(), g1Store, 'device-1', 'Patricias Handy');
    const g2 = createGuestCore('ROOM42', net.connect(), g2Store, 'device-2', 'Moritz Handy');
    await settle();
    return { net, host, ids, hostCore, g1, g2, g1Store, g2Store };
}

// ---------------------------------------------------------------- protocol

describe('room codes and links', () => {
    test('codes use the unambiguous alphabet', () => {
        for (let i = 0; i < 200; i++) {
            const c = newRoomCode();
            expect(c).toHaveLength(ROOM_CODE_LENGTH);
            expect([...c].every(ch => ROOM_ALPHABET.includes(ch))).toBe(true);
        }
        expect(ROOM_ALPHABET).not.toMatch(/[01OIL]/);
    });

    test('typed codes are normalised; invalid ones rejected', () => {
        expect(parseRoomCode(' abc-def ')).toBe('ABCDEF');
        expect(parseRoomCode('ABC')).toBeNull();
        expect(parseRoomCode('ABCDE0')).toBeNull();
        expect(parseRoomCode(42)).toBeNull();
    });

    test('join link round-trip', () => {
        const url = joinUrl('ABCDEF', 'https://x.github.io/wingspan-calc/');
        expect(url).toBe('https://x.github.io/wingspan-calc/#join=ABCDEF');
        expect(roomFromHash('#join=ABCDEF')).toBe('ABCDEF');
        expect(roomFromHash('#join=abcdef')).toBe('ABCDEF');
        expect(roomFromHash('#other')).toBeNull();
        expect(roomFromHash('#join=<script>')).toBeNull();
    });
});

describe('message validation (untrusted input)', () => {
    test.each([null, 'x', [], { t: 'nope' }, { t: 'hello' }, { t: 'claim', playerIds: 'a' }, { t: 'edit', edit: { k: 'score', playerId: 'a' } }, { t: 'edit', edit: { k: 'score', playerId: 'a', category: 'birds', value: Infinity } }])(
        'rejects %j',
        raw => expect(parseGuestMessage(raw)).toBeNull(),
    );

    test('accepts and trims valid messages', () => {
        expect(parseGuestMessage({ t: 'hello', v: 1, deviceId: 'd', label: '  Handy  ' })).toEqual({ t: 'hello', v: 1, deviceId: 'd', label: 'Handy' });
        expect(parseGuestMessage({ t: 'claim', playerIds: ['a', 'a', 'b'] })).toEqual({ t: 'claim', playerIds: ['a', 'b'] });
        expect(parseGuestMessage({ t: 'claim', playerIds: Array(8).fill('x') })).toBeNull();
    });

    test('host messages', () => {
        expect(parseHostMessage({ t: 'bye' })).toEqual({ t: 'bye', reason: 'ended' });
        expect(parseHostMessage({ t: 'state', seq: 1 })).toBeNull();
        const m = parseHostMessage({ t: 'state', seq: 3, game: {}, claims: { a: 'd1', b: 5 }, filled: { a: ['birds', 3] } });
        expect(m).toMatchObject({ t: 'state', seq: 3, claims: { a: 'd1' }, filled: { a: ['birds'] } });
    });
});

describe('checkEdit', () => {
    const { host, ids } = setupHostGame();
    const game = (): GameState => get(host);
    const claims = { [ids[0]]: 'd1' };

    test('allowed edit', () => {
        expect(checkEdit({ k: 'score', playerId: ids[0], category: 'birds', value: 30 }, game(), claims, 'd1')).toBeNull();
        expect(checkEdit({ k: 'round', playerId: ids[0], index: 3, rank: 3 }, game(), claims, 'd1')).toBeNull();
        expect(checkEdit({ k: 'food', playerId: ids[0], amount: 2 }, game(), claims, 'd1')).toBeNull();
    });

    test.each([
        [{ k: 'score', playerId: 'ghost', category: 'birds', value: 1 }, 'unknown-player'],
        [{ k: 'score', playerId: 'P1', category: 'birds', value: 1 }, 'not-claimed'],
        [{ k: 'score', playerId: 'P0', category: 'nectar', value: 9 }, 'bad-category'],
        [{ k: 'score', playerId: 'P0', category: 'round_goals', value: 9 }, 'bad-category'],
        [{ k: 'score', playerId: 'P0', category: 'hummingbirds', value: 9 }, 'bad-category'],
        [{ k: 'score', playerId: 'P0', category: '__proto__', value: 9 }, 'bad-category'],
        [{ k: 'round', playerId: 'P0', index: 4, rank: 1 }, 'bad-index'],
        [{ k: 'round', playerId: 'P0', index: 0, rank: 4 }, 'bad-rank'],
        [{ k: 'round', playerId: 'P0', index: 0.5, rank: 1 }, 'bad-index'],
        [{ k: 'nectar', playerId: 'P0', index: 0, rank: 3 }, 'bad-rank'],
    ] as const)('%j → %s', (raw, reason) => {
        const edit = { ...raw, playerId: raw.playerId === 'P0' ? ids[0] : raw.playerId === 'P1' ? ids[1] : raw.playerId } as never;
        expect(checkEdit(edit, game(), claims, 'd1')).toBe(reason);
    });

    test('only during scoring or on the result screen', () => {
        expect(checkEdit({ k: 'score', playerId: ids[0], category: 'birds', value: 1 }, { ...game(), currentPhase: 'SETUP' }, claims, 'd1')).toBe('wrong-phase');
    });
});

describe('claims', () => {
    test('first come first served, re-claiming replaces own choice', () => {
        let c = applyClaim({}, 'd1', ['a', 'b'], ['a', 'b', 'c']);
        c = applyClaim(c, 'd2', ['b', 'c', 'zzz'], ['a', 'b', 'c']);
        expect(c).toEqual({ a: 'd1', b: 'd1', c: 'd2' });
        c = applyClaim(c, 'd1', ['a'], ['a', 'b', 'c']);
        expect(c).toEqual({ a: 'd1', c: 'd2' });
        expect(releaseDevice(c, 'd2')).toEqual({ a: 'd1' });
    });
});

// ---------------------------------------------------------------- sessions

describe('shared game session', () => {
    test('guests mirror the host game and see each other', async () => {
        const { g1, g1Store, host, hostCore } = await scenario();
        expect(get(g1.view).status).toBe('connected');
        expect(get(g1Store).players.map(p => p.name)).toEqual(['Robin', 'Patricia', 'Moritz', 'Mama']);
        expect(get(g1Store).gameId).toBe(get(host).gameId);
        expect(Object.values(get(hostCore.view).devices).map(d => d.label).sort()).toEqual(['Moritz Handy', 'Patricias Handy']);
    });

    test('two phones split four players and enter scores', async () => {
        const { g1, g2, g1Store, g2Store, host, ids, hostCore } = await scenario();
        g1.claim([ids[0], ids[1]]);
        g2.claim([ids[1], ids[2], ids[3]]); // Patricia is taken already
        await settle();
        expect(get(hostCore.view).claims).toEqual({ [ids[0]]: 'device-1', [ids[1]]: 'device-1', [ids[2]]: 'device-2', [ids[3]]: 'device-2' });

        g1Store.updateScore(ids[0], 'birds', 41);
        g1Store.updateScore(ids[1], 'eggs', 9);
        g2Store.updateScore(ids[3], 'birds', 33);
        g2Store.updateRoundPlacement(ids[2], 0, 1);
        await settle();

        const p = get(host).players;
        expect(p[0].scores.birds).toBe(41);
        expect(p[1].scores.eggs).toBe(9);
        expect(p[3].scores.birds).toBe(33);
        expect(p[2].scores.round_goals).toBe(4);
        // every phone sees the same game
        expect(get(g2Store).players[0].scores.birds).toBe(41);
        expect(get(g1Store).players[2].scores.round_goals).toBe(4);
        expect(get(hostCore.view).filled).toEqual({ [ids[0]]: ['birds'], [ids[1]]: ['eggs'], [ids[3]]: ['birds'] });
    });

    test('edits for players another phone scores are rejected', async () => {
        const { g1, g2, g2Store, host, ids } = await scenario();
        g1.claim([ids[0]]);
        await settle();
        g2Store.updateScore(ids[0], 'birds', 99); // optimistic locally …
        await settle();
        expect(get(host).players[0].scores.birds).toBe(0); // … but the host refuses
        expect(get(g2Store).players[0].scores.birds).toBe(0); // and the next snapshot corrects the guest
    });

    test('guests cannot change the game flow', async () => {
        const { g1Store, host } = await scenario();
        g1Store.setPhase('RESULT');
        g1Store.addPlayer('Hacker', '#000');
        g1Store.resetGame();
        await settle();
        expect(get(host).currentPhase).toBe('SCORING');
        expect(get(g1Store).players).toHaveLength(4);
    });

    test('host changes reach every phone', async () => {
        const { g1Store, g2Store, host, ids } = await scenario();
        host.updateScore(ids[2], 'tucked', 7);
        host.setPhase('RESULT');
        await settle();
        for (const s of [g1Store, g2Store]) {
            expect(get(s).players[2].scores.tucked).toBe(7);
            expect(get(s).currentPhase).toBe('RESULT');
        }
    });

    test('a phone that reconnects keeps its players', async () => {
        const { net, g1, ids, hostCore, host } = await scenario();
        g1.claim([ids[0]]);
        await settle();
        g1.leave();
        await settle();
        expect(get(hostCore.view).devices['device-1'].online).toBe(false);
        expect(get(hostCore.view).claims[ids[0]]).toBe('device-1');

        const again = createGameStore({ persist: false });
        createGuestCore('ROOM42', net.connect(), again, 'device-1', 'Patricias Handy');
        await settle();
        expect(get(hostCore.view).devices['device-1'].online).toBe(true);
        again.updateScore(ids[0], 'food', 3);
        await settle();
        expect(get(host).players[0].scores.food).toBe(3);
    });

    test('after a host reload the phones claim their players again', async () => {
        const { net, g1, ids, hostCore, host } = await scenario();
        g1.claim([ids[0], ids[1]]);
        await settle();
        hostCore.stop();
        await settle();
        const reloaded = createHostCore('ROOM42', net.connect(), host, { throttleMs: 0 });
        await settle();
        expect(get(reloaded.view).claims).toEqual({ [ids[0]]: 'device-1', [ids[1]]: 'device-1' });
        expect(get(g1.view).status).toBe('connected');
    });

    test('a guest can rename its phone', async () => {
        const { g1, hostCore } = await scenario();
        g1.setLabel('Handy von Patricia & Mama');
        await settle();
        expect(get(hostCore.view).devices['device-1'].label).toBe('Handy von Patricia & Mama');
    });

    test('a new game on the host clears the claims', async () => {
        const { g1, ids, host, hostCore } = await scenario();
        g1.claim([ids[0]]);
        await settle();
        host.resetGame();
        await settle();
        expect(get(hostCore.view).claims).toEqual({});
    });

    test('guests see when the host ends the session', async () => {
        const { g1, g2, hostCore } = await scenario();
        hostCore.stop();
        await settle();
        expect(get(g1.view).status).toBe('ended');
        expect(get(g2.view).status).toBe('ended');
    });

    test('leaving restores the guest phone’s own game', async () => {
        const { g1, g1Store } = await scenario();
        g1.leave();
        expect(get(g1Store).players).toEqual([]);
        expect(g1Store.isMirror()).toBe(false);
    });

    test('messages from unknown devices are ignored', async () => {
        const net = hub();
        const { host, ids } = setupHostGame();
        createHostCore('R', net.connect(), host, { throttleMs: 0 });
        const rogue = net.connect();
        await settle();
        rogue.send({ t: 'claim', playerIds: [ids[0]] });
        rogue.send({ t: 'edit', edit: { k: 'score', playerId: ids[0], category: 'birds', value: 5 } });
        await settle();
        expect(get(host).players[0].scores.birds).toBe(0);
    });
});
