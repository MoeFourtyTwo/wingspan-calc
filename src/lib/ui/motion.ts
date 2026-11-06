import { backOut, cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/** True if the user asked the OS for less motion. */
export function reducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/** Duration helper: collapses to 0 when reduced motion is requested. */
export const ms = (duration: number): number => (reducedMotion() ? 0 : duration);

export const wait = (duration: number) => new Promise<void>(resolve => setTimeout(resolve, ms(duration)));

interface SwoopParams {
    delay?: number;
    duration?: number;
    x?: number;
    y?: number;
    rotate?: number;
    scale?: number;
    easing?: (t: number) => number;
}

/** A bird-like swoop: slide in from an offset with a little tilt and springy overshoot. */
export function swoop(
    _node: Element,
    { delay = 0, duration = 380, x = 0, y = 24, rotate = 0, scale = 0.94, easing = backOut }: SwoopParams = {},
): TransitionConfig {
    return {
        delay: ms(delay),
        duration: ms(duration),
        easing,
        css: (t, u) =>
            `transform: translate(${u * x}px, ${u * y}px) rotate(${u * rotate}deg) scale(${scale + (1 - scale) * t});` +
            `opacity: ${Math.min(1, t * 2)};`,
    };
}

/** Springy scale-in. */
export function pop(
    _node: Element,
    { delay = 0, duration = 360, start = 0.3, easing = backOut }: { delay?: number; duration?: number; start?: number; easing?: (t: number) => number } = {},
): TransitionConfig {
    return {
        delay: ms(delay),
        duration: ms(duration),
        easing,
        css: t => `transform: scale(${start + (1 - start) * t}); opacity: ${Math.min(1, t * 3)};`,
    };
}

/** Quick shrink-and-fade used when removing things. */
export function poof(_node: Element, { duration = 200 }: { duration?: number } = {}): TransitionConfig {
    return {
        duration: ms(duration),
        easing: cubicOut,
        css: t => `transform: scale(${0.6 + 0.4 * t}) rotate(${(1 - t) * -8}deg); opacity: ${t};`,
    };
}
