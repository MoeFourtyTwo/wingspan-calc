import { describe, expect, test } from 'vitest';
import { createWakeLock } from './wakeLock';

function fakes() {
    const doc = new EventTarget() as EventTarget & { visibilityState: string };
    doc.visibilityState = 'visible';
    let requests = 0;
    const held: { released: boolean; release(): Promise<void> }[] = [];
    const nav = {
        wakeLock: {
            request: async () => {
                requests++;
                const s = { released: false, release: async () => void (s.released = true) };
                held.push(s);
                return s;
            },
        },
    };
    const hide = () => {
        doc.visibilityState = 'hidden';
        held.forEach(s => (s.released = true)); // browsers drop the lock when hidden
        doc.dispatchEvent(new Event('visibilitychange'));
    };
    const show = () => {
        doc.visibilityState = 'visible';
        doc.dispatchEvent(new Event('visibilitychange'));
    };
    return { doc: doc as unknown as Document, nav, hide, show, requests: () => requests };
}

const tick = () => new Promise(r => setTimeout(r, 0));

describe('wake lock', () => {
    test('held while active, released when inactive', async () => {
        const f = fakes();
        const w = createWakeLock(f.nav, f.doc);
        expect(w.supported).toBe(true);
        w.set(true);
        await tick();
        expect(w.isHeld()).toBe(true);
        w.set(false);
        await tick();
        expect(w.isHeld()).toBe(false);
    });

    test('taken again when the page becomes visible', async () => {
        const f = fakes();
        const w = createWakeLock(f.nav, f.doc);
        w.set(true);
        await tick();
        f.hide();
        await tick();
        expect(w.isHeld()).toBe(false);
        f.show();
        await tick();
        expect(w.isHeld()).toBe(true);
        expect(f.requests()).toBe(2);
    });

    test('not taken again after the game ended', async () => {
        const f = fakes();
        const w = createWakeLock(f.nav, f.doc);
        w.set(true);
        await tick();
        w.set(false);
        f.hide();
        f.show();
        await tick();
        expect(w.isHeld()).toBe(false);
        expect(f.requests()).toBe(1);
        w.destroy();
    });

    test('no-op without browser support or when refused', async () => {
        const f = fakes();
        const none = createWakeLock({}, f.doc);
        expect(none.supported).toBe(false);
        none.set(true);
        await tick();
        expect(none.isHeld()).toBe(false);
        const refused = createWakeLock({ wakeLock: { request: () => Promise.reject(new Error('NotAllowed')) } }, f.doc);
        refused.set(true);
        await tick();
        expect(refused.isHeld()).toBe(false);
    });
});
