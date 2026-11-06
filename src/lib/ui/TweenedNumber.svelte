<script lang="ts">
    import { tweened } from "svelte/motion";
    import { cubicOut } from "svelte/easing";
    import { ms } from "./motion";

    export let value = 0;
    export let duration = 450;
    export let delay = 0;
    /** Count up from 0 when first shown. */
    export let fromZero = false;

    const n = tweened(fromZero ? 0 : value, { duration: ms(duration), easing: cubicOut });
    $: n.set(value, { delay: ms(delay) });

    let prev = value;
    let bumpKey = 0;
    $: if (value !== prev) {
        prev = value;
        bumpKey++;
    }
</script>

{#key bumpKey}
    <span class="num" class:bump={bumpKey > 0}>{Math.round($n)}</span>
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
