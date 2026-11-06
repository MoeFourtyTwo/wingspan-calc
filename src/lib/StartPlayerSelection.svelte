<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { gameStore } from "./store";
    import { t } from "./i18n";
    import Egg from "./ui/Egg.svelte";
    import Bird from "./ui/Bird.svelte";
    import Burst from "./ui/Burst.svelte";
    import { pop, swoop, reducedMotion } from "./ui/motion";
    import { shade } from "./ui/color";

    const players = $gameStore.players;
    const n = players.length;
    const targetIndex = Math.max(
        0,
        players.findIndex((p) => p.id === $gameStore.startPlayerId),
    );
    const target = players[targetIndex];

    // ---------- Layout (percent of the square stage) ----------
    const RING = n <= 1 ? 0 : n <= 4 ? 20 : 22;
    const eggSize = n <= 4 ? 52 : 42;
    const eggPos = players.map((_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
        return { x: 50 + RING * Math.cos(a), y: 50 + RING * Math.sin(a) };
    });

    // Woven twigs for the nest, deterministic so it doesn't flicker.
    const twigs = Array.from({ length: 54 }, (_, k) => {
        const a = (k / 54) * Math.PI * 2 + (k % 3) * 0.05;
        const r = 37 + ((k * 7) % 10);
        const span = 0.32 + ((k * 13) % 7) * 0.03;
        const p = (ang: number, rad: number) =>
            `${(50 + rad * Math.cos(ang)).toFixed(2)} ${(50 + rad * Math.sin(ang)).toFixed(2)}`;
        return {
            d: `M${p(a - span, r)} Q${p(a, r + (k % 2 ? 4 : -4))} ${p(a + span, r + ((k * 5) % 3) - 1)}`,
            color: ["#8a6142", "#a47b52", "#6e4b31", "#b98d5f"][k % 4],
            w: 1.2 + (k % 3) * 0.5,
        };
    });

    // ---------- Animation state ----------
    let stage: HTMLDivElement | undefined = $state();
    let birdEl: HTMLDivElement | undefined = $state();
    let eggEls: HTMLElement[] = $state([]);
    let stageSize = $state(300);

    let birdAt = $state(-1); // -1 = off stage (top left)
    let facing: 1 | -1 = $state(1);
    let flapping = $state(false);
    let crouch = $state(false);
    let shaking = $state(false);
    let cracked = $state(false);
    let revealed = $state(false);
    let running = $state(false);

    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const anims = new Set<Animation>();

    const BIRD_W = 50;
    function birdXY(i: number, size = stageSize) {
        if (i < 0) return { x: -BIRD_W - 20, y: -70 };
        const p = eggPos[i];
        const x = (p.x / 100) * size - BIRD_W / 2;
        const y = (p.y / 100) * size - (eggSize * 1.25) / 2 - BIRD_W * 0.82;
        return { x, y };
    }

    let birdStyle = $derived((() => {
        const { x, y } = birdXY(birdAt, stageSize);
        // after hatching the parent bird hops aside to admire the chick
        const dx = revealed ? (eggPos[birdAt]?.x ?? 50) > 60 ? -eggSize * 0.95 : eggSize * 0.95 : 0;
        const dy = revealed ? eggSize * 0.75 : 0;
        return `transform: translate(${x + dx}px, ${y + dy}px)`;
    })());

    function sleep(duration: number) {
        return new Promise<void>((resolve) => {
            const id = setTimeout(() => {
                timers.delete(id);
                resolve();
            }, duration);
            timers.add(id);
        });
    }

    async function play(el: Element | undefined, keyframes: Keyframe[], opts: KeyframeAnimationOptions) {
        if (!el || cancelled) return;
        const anim = el.animate(keyframes, opts);
        anims.add(anim);
        try {
            await anim.finished;
        } catch {
            /* cancelled */
        } finally {
            anims.delete(anim);
        }
    }

    function wobbleEgg(i: number, strength = 1) {
        const a = 9 * strength;
        play(
            eggEls[i],
            [
                { transform: "rotate(0) scale(1)" },
                { transform: `rotate(${-a}deg) scale(1.04, 0.94)` },
                { transform: `rotate(${a * 0.7}deg)` },
                { transform: `rotate(${-a * 0.35}deg)` },
                { transform: "rotate(0) scale(1)" },
            ],
            { duration: 380, easing: "ease-out" },
        );
    }

    /** Hop the bird from its current spot to egg `to` along an arc. */
    async function hopTo(to: number, duration: number, arc: number) {
        const from = birdXY(birdAt);
        const dest = birdXY(to);
        facing = dest.x >= from.x - 1 ? 1 : -1;
        flapping = true;
        birdAt = to; // final inline style; the animation below overrides it while running
        const midX = (from.x + dest.x) / 2;
        const midY = Math.min(from.y, dest.y) - arc;
        await play(
            birdEl,
            [
                { transform: `translate(${from.x}px, ${from.y}px)` },
                { transform: `translate(${midX}px, ${midY}px)`, offset: 0.45 },
                { transform: `translate(${dest.x}px, ${dest.y}px)` },
            ],
            { duration, easing: "cubic-bezier(.45,.05,.35,1)" },
        );
        if (cancelled) return;
        flapping = false;
        wobbleEgg(to);
        // tiny landing squash
        play(
            birdEl?.firstElementChild ?? undefined,
            [{ transform: "scale(1.12, 0.84)" }, { transform: "scale(1)" }],
            { duration: 180, easing: "cubic-bezier(.34,1.56,.64,1)" },
        );
    }

    async function run() {
        running = true;
        await tick();
        stageSize = stage?.clientWidth || stageSize;

        // Hop sequence clockwise around the nest, ending on the chosen egg.
        const hops = n <= 1 ? 1 : Math.max(7, n + 3);
        const startIdx = (((targetIndex - (hops - 1)) % n) + n) % n;
        const path = Array.from({ length: hops }, (_, k) => (startIdx + k) % Math.max(1, n));

        await sleep(250);
        for (let k = 0; k < path.length && !cancelled; k++) {
            const last = k === path.length - 1;
            if (k === 0) {
                await hopTo(path[k], 560, 30);
            } else {
                if (last) {
                    // anticipation: crouch & glance before the final hop
                    crouch = true;
                    await sleep(260);
                    crouch = false;
                }
                const progress = k / (path.length - 1);
                const dur = 150 + progress * progress * 330 + (last ? 90 : 0);
                await hopTo(path[k], dur, last ? 46 : 18 + progress * 18);
            }
            if (!cancelled) await sleep(k === 0 ? 120 : 30 + (k / path.length) * 90);
        }
        if (cancelled) return;

        // The chosen egg trembles…
        await sleep(150);
        shaking = true;
        await sleep(560);
        if (cancelled) return;
        shaking = false;
        // …and cracks open.
        cracked = true;
        flapping = true;
        await play(
            birdEl,
            [
                { transform: birdStyle.replace("transform: ", "") },
                {
                    transform: `translate(${birdXY(targetIndex).x}px, ${birdXY(targetIndex).y - 36}px)`,
                },
                { transform: birdStyle.replace("transform: ", "") },
            ],
            { duration: 420, easing: "ease-out" },
        );
        flapping = false;
        await sleep(80);
        finish();
    }

    function finish() {
        cracked = true;
        shaking = false;
        flapping = false;
        crouch = false;
        birdAt = targetIndex;
        facing = (eggPos[targetIndex]?.x ?? 50) > 60 ? 1 : -1;
        revealed = true;
        running = false;
    }

    function skip() {
        cancelled = true;
        timers.forEach(clearTimeout);
        timers.clear();
        anims.forEach((a) => a.cancel());
        anims.clear();
        finish();
    }

    onMount(() => {
        if (n === 0) {
            gameStore.setPhase("SETUP");
            return;
        }
        if (reducedMotion()) {
            finish();
            return;
        }
        run();
    });

    onDestroy(() => {
        cancelled = true;
        timers.forEach(clearTimeout);
        anims.forEach((a) => a.cancel());
    });
</script>

<div class="selection">
    <h2 class="title" aria-live="polite">
        {#if revealed}
            <span in:pop={{ duration: 380 }}>{$t("firstSelected")}</span>
        {:else}
            {$t("hatching")}
        {/if}
    </h2>

    <div class="stage" bind:this={stage} bind:clientWidth={stageSize}>
        <svg class="nest" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
                <radialGradient id="cup" cx="50%" cy="45%" r="55%">
                    <stop offset="0" stop-color="#7a5536" />
                    <stop offset="0.7" stop-color="#5e4029" />
                    <stop offset="1" stop-color="#3f2a1a" />
                </radialGradient>
            </defs>
            <ellipse cx="50" cy="53" rx="48" ry="46" fill="rgba(60,40,20,.18)" />
            <circle cx="50" cy="50" r="46" fill="#9c7350" />
            <circle cx="50" cy="50" r="35" fill="url(#cup)" />
            {#each twigs as tw}
                <path d={tw.d} stroke={tw.color} stroke-width={tw.w} fill="none" stroke-linecap="round" />
            {/each}
            <path d="M8 30 q-6 -4 -7 -10 M93 72 q7 2 9 8 M70 6 q4 -5 10 -5" stroke="#8a6142" stroke-width="1.5" fill="none" stroke-linecap="round" />
            <path d="M92 26 q6 -2 8 -8 q-6 0 -8 8z" fill="#6aa84f" />
        </svg>

        {#each players as player, i (player.id)}
            {@const isTarget = i === targetIndex}
            <div
                class="egg-slot"
                style="left: {eggPos[i].x}%; top: {eggPos[i].y}%;"
                class:dim={revealed && !isTarget}
            >
                {#if isTarget && cracked}
                    <div class="hatched">
                        <span class="shell top">
                            <svg width={eggSize} height={eggSize * 0.7} viewBox="0 0 40 28" aria-hidden="true">
                                <path d="M2 28C2 18 9 2 20 2C31 2 38 18 38 28L33 23L28 28L23 22L18 28L13 22L8 28L5 24Z" fill={player.color} stroke={shade(player.color, -0.42)} stroke-width="1.5" />
                            </svg>
                        </span>
                        <span class="chick" in:pop={{ duration: 420, start: 0.2 }}>
                            <Bird color="#f6cf4a" breast="#fbe7a0" size={eggSize * 0.95} />
                        </span>
                        <span class="shell bottom">
                            <svg width={eggSize} height={eggSize * 0.62} viewBox="0 0 40 25" aria-hidden="true">
                                <path d="M2 6L5 2L8 6L13 0L18 6L23 0L28 6L33 1L38 6C38 17 30 23 20 23C10 23 2 17 2 6Z" fill={player.color} stroke={shade(player.color, -0.42)} stroke-width="1.5" />
                            </svg>
                        </span>
                        <Burst count={26} spread={130} />
                    </div>
                {:else}
                    <div class="egg-inner" class:shaking={isTarget && shaking} bind:this={eggEls[i]}>
                        <Egg
                            color={player.color}
                            size={eggSize}
                            initial={player.name.slice(0, 1).toUpperCase()}
                            label={player.name}
                        />
                    </div>
                {/if}
            </div>
        {/each}

        <div class="bird-pos" class:settled={revealed} bind:this={birdEl} style={birdStyle}>
            <div class="bird-body" class:crouch class:idle={!flapping && !crouch && birdAt >= 0}>
                <Bird size={BIRD_W} {facing} {flapping} />
            </div>
        </div>

        {#if running}
            <button class="skip-overlay" onclick={skip} aria-label={$t("skip")}></button>
        {/if}
    </div>

    <div class="reveal">
        {#if revealed && target}
            <div class="winner-name" in:pop={{ duration: 480, start: 0.4 }}>
                <Egg color={target.color} size={26} />
                <span class="name">{target.name}</span>
            </div>
            <p class="message" in:swoop={{ y: 14, delay: 120 }}>
                {$t("turnStartPre")}<b>{target.name}</b>{$t("turnStartPost")}
            </p>
            <div class="go" in:pop={{ delay: 320, duration: 520, start: 0.2 }}>
                <button class="btn-primary gold go-btn" onclick={() => gameStore.setPhase("DRAW")}>
                    {$t("letsGo")}
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h13M13 6l6 6-6 6" />
                    </svg>
                </button>
            </div>
        {:else}
            <button class="btn-ghost skip-btn" onclick={skip}>
                {$t("tapToSkip")}
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 6l7 6-7 6M13 6l7 6-7 6" />
                </svg>
            </button>
        {/if}
    </div>
</div>

<style>
    .selection {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding-top: 4px;
    }

    .title {
        font-size: 1.5rem;
        margin-bottom: 14px;
        min-height: 1.8rem;
        color: var(--forest-deep);
    }

    .title span {
        display: inline-block;
    }

    .stage {
        position: relative;
        width: min(330px, 100%);
        aspect-ratio: 1;
        margin: 6px auto 0;
    }

    .nest {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
    }

    .egg-slot {
        position: absolute;
        transform: translate(-50%, -50%);
        transition:
            opacity 0.4s ease,
            filter 0.4s ease;
        z-index: 2;
    }

    .egg-slot.dim {
        opacity: 0.7;
        filter: saturate(0.75);
    }

    .egg-inner {
        transform-origin: 50% 85%;
    }

    .egg-inner.shaking {
        animation: shake 0.09s linear infinite alternate;
    }

    @keyframes shake {
        from {
            transform: rotate(-7deg) translateX(-1px);
        }
        to {
            transform: rotate(7deg) translateX(1px);
        }
    }

    .hatched {
        position: relative;
        display: grid;
        justify-items: center;
        align-items: end;
        min-width: 60px;
        min-height: 66px;
    }

    .shell {
        position: absolute;
        left: 50%;
        line-height: 0;
    }

    .shell.top {
        top: 0;
        animation: shell-top 0.65s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
    }

    .shell.bottom {
        bottom: 0;
        z-index: 2;
        animation: shell-bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes shell-top {
        from {
            transform: translate(-50%, 0) rotate(0);
        }
        to {
            transform: translate(-60%, -46px) rotate(-35deg);
            opacity: 0;
        }
    }

    @keyframes shell-bottom {
        from {
            transform: translate(-50%, 0) rotate(0);
        }
        to {
            transform: translate(-30%, 10px) rotate(14deg);
        }
    }

    .chick {
        position: relative;
        z-index: 1;
        margin-bottom: 10px;
        animation: bob 1s ease-in-out 0.5s infinite;
    }

    .bird-pos {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 10;
        pointer-events: none;
        will-change: transform;
    }

    .bird-pos.settled {
        transition: transform 0.45s var(--spring);
    }

    .bird-body {
        transform-origin: 50% 100%;
        transition: transform 0.2s var(--spring);
    }

    .bird-body.crouch {
        transform: scale(1.1, 0.78) translateY(4px);
    }

    .bird-body.idle {
        animation: bob 0.9s ease-in-out infinite;
    }

    .skip-overlay {
        position: absolute;
        inset: -20px;
        z-index: 20;
        background: transparent;
        border-radius: 50%;
    }

    .reveal {
        width: 100%;
        min-height: 170px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        margin-top: 18px;
    }

    .winner-name {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 20px;
        background: var(--card);
        border: 2px solid var(--gold);
        border-radius: 999px;
        box-shadow: var(--shadow-md);
        max-width: 100%;
    }

    .name {
        font-family: var(--font-display);
        font-size: 2rem;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .message {
        font-family: var(--font-hand);
        font-size: 1.6rem;
        line-height: 1.1;
        color: var(--ink-soft);
    }

    .message b {
        color: var(--ink);
    }

    .go {
        width: 100%;
        margin-top: 6px;
    }

    .go-btn {
        font-size: 1.3rem;
        min-height: 58px;
    }

    .skip-btn {
        margin-top: 10px;
        font-family: var(--font-hand);
        font-size: 1.35rem;
    }
</style>
