<script lang="ts">
    import Egg from "./Egg.svelte";
    import Feather from "./Feather.svelte";
    import { untrack } from "svelte";
    import { reducedMotion } from "./motion";

    
    
    interface Props {
        /** Burst origin inside the (positioned) parent. */
        x?: string;
        y?: string;
        count?: number;
        spread?: number;
        duration?: number;
        colors?: string[];
        /** Fraction of particles that are eggs (rest are feathers). */
        eggRatio?: number;
    }

    let {
        x = "50%",
        y = "50%",
        count = 22,
        spread = 140,
        duration = 1300,
        colors = ["#2f7d6d", "#d9a72b", "#3b7fb6", "#c2554a", "#d8578a"],
        eggRatio = 0.3
    }: Props = $props();

    // Particles are generated once per burst; later prop changes are ignored.
    const particles = untrack(() => reducedMotion()
        ? []
        : Array.from({ length: count }, (_, i) => {
              const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
              const dist = spread * (0.45 + Math.random() * 0.6);
              return {
                  egg: Math.random() < eggRatio,
                  color: colors[i % colors.length],
                  dx: Math.cos(angle) * dist,
                  dy: Math.sin(angle) * dist * 0.85 - spread * 0.35,
                  rot: (Math.random() - 0.5) * 720,
                  delay: Math.random() * 120,
                  size: 24 + Math.random() * 20,
                  dur: duration * (0.75 + Math.random() * 0.5),
              };
          }));
</script>

<div class="burst" style="left: {x}; top: {y}" aria-hidden="true">
    {#each particles as p}
        <span
            class="particle"
            style="--dx: {p.dx}px; --dy: {p.dy}px; --rot: {p.rot}deg; animation-delay: {p.delay}ms; animation-duration: {p.dur}ms"
        >
            {#if p.egg}
                <Egg color={p.color} size={p.size * 0.55} speckled={false} />
            {:else}
                <Feather color={p.color} size={p.size} />
            {/if}
        </span>
    {/each}
</div>

<style>
    .burst {
        position: absolute;
        width: 0;
        height: 0;
        pointer-events: none;
        z-index: 30;
    }

    .particle {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        animation-name: burst;
        animation-timing-function: cubic-bezier(0.15, 0.7, 0.3, 1);
        animation-fill-mode: forwards;
    }

    @keyframes burst {
        0% {
            transform: translate(-50%, -50%) scale(0.2) rotate(0);
            opacity: 0;
        }
        8% {
            opacity: 1;
        }
        35% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1)
                rotate(calc(var(--rot) * 0.4));
        }
        75% {
            opacity: 1;
        }
        100% {
            transform: translate(calc(-50% + var(--dx) * 1.2), calc(-50% + var(--dy) + 150px)) scale(0.9)
                rotate(var(--rot));
            opacity: 0;
        }
    }
</style>
