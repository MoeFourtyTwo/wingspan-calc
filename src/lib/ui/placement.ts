import { crossfade } from 'svelte/transition';
import { backOut } from 'svelte/easing';
import { ms, pop } from './motion';

/** Eggs hop between grid cells: shared crossfade for placement grids. */
export const [sendEgg, receiveEgg] = crossfade({
    duration: () => ms(380),
    easing: backOut,
    fallback: (node) => pop(node, { duration: 300, start: 0.2 }),
});
