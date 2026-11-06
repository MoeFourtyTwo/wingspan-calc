<script lang="ts">
    import { untrack } from "svelte";
    import { Tween } from "svelte/motion";
    import { cubicOut } from "svelte/easing";
    import { ms } from "./motion";

    
    interface Props {
        value?: number;
        duration?: number;
        delay?: number;
        /** Count up from 0 when first shown. */
        fromZero?: boolean;
    }

    let {
        value = 0,
        duration = 450,
        delay = 0,
        fromZero = false
    }: Props = $props();

    const n = untrack(() => new Tween(fromZero ? 0 : value, { duration: ms(duration), easing: cubicOut }));
    $effect.pre(() => {
        n.set(value, { delay: ms(untrack(() => delay)) });
    });

    // Re-keyed on every change so the "pop" animation replays.
    let prev = untrack(() => value);
    let bumpKey = $state(0);
    $effect.pre(() => {
        if (value !== prev) {
            prev = value;
            untrack(() => bumpKey++);
        }
    });
</script>

{#key bumpKey}
    <span class="num" class:bump={bumpKey > 0}>{Math.round(n.current)}</span>
{/key}

<style>
    .num {
        display: inline-block;
        font-variant-numeric: tabular-nums;
    }

    .bump {
        animation: bump 0.36s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes bump {
        0% {
            transform: scale(1);
        }
        35% {
            transform: scale(1.35) rotate(-4deg);
        }
        100% {
            transform: scale(1);
        }
    }
</style>
