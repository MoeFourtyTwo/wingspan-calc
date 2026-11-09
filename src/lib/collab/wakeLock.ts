/**
 * Keep the screen on during a shared game. A locked phone pauses the page and
 * drops its connection; it reconnects when woken, but staying awake avoids the
 * gap altogether. Uses the Screen Wake Lock API where available (Chrome on
 * Android, Safari 16.4+); elsewhere this is a no-op.
 */

interface WakeLockSentinelLike {
    released: boolean;
    release(): Promise<void>;
}
interface WakeLockLike {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export function createWakeLock(nav: { wakeLock?: WakeLockLike } = navigator as never, doc: Document = document) {
    let wanted = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async () => {
        if (!wanted || !nav.wakeLock || doc.visibilityState !== 'visible') return;
        if (sentinel && !sentinel.released) return;
        try {
            sentinel = await nav.wakeLock.request('screen');
            if (!wanted) await release();
        } catch {
            /* refused (battery saver, permissions) – the app still works */
        }
    };
    const release = async () => {
        const s = sentinel;
        sentinel = null;
        try {
            if (s && !s.released) await s.release();
        } catch {
            /* ignore */
        }
    };
    // The browser drops the lock when the page is hidden; take it again on return.
    const onVisible = () => void acquire();
    doc.addEventListener('visibilitychange', onVisible);

    return {
        supported: !!nav.wakeLock,
        set(active: boolean) {
            wanted = active;
            void (active ? acquire() : release());
        },
        isHeld: () => !!sentinel && !sentinel.released,
        destroy() {
            wanted = false;
            doc.removeEventListener('visibilitychange', onVisible);
            void release();
        },
    };
}
