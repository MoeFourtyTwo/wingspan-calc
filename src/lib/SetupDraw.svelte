<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { get } from "svelte/store";
    import { gameStore } from "./store";
    import { t, language, type TranslationKey } from "./i18n";
    import type { CardSet } from "./data/types";
    import { drawSetup, redrawGoal, type SetupDraw, type SetupError } from "./setup/setupDraw";
    import { GOAL_SETS, setupPrefs as prefs, type SetupPrefs } from "./setup/setupPrefs";
    import { flipGoal, fromRecord, goalText as renderGoal, toRecord, toggleSet, withGameOptions } from "./setup/setupRecord";
    import Bird from "./ui/Bird.svelte";
    import Burst from "./ui/Burst.svelte";
    import Feather from "./ui/Feather.svelte";
    import { slide } from "svelte/transition";
    import { pop, swoop, reducedMotion, ms } from "./ui/motion";

    const SET_COLORS: Record<CardSet, string> = {
        core: "var(--forest)",
        european: "var(--wetland)",
        oceania: "var(--nectar)",
        asia: "var(--berry)",
        americas: "var(--hummingbird)",
    };
    const ERROR_KEYS: Record<SetupError, TranslationKey> = {
        "not-enough-goals": "setupErr_notEnoughGoals",
    };

    let players = $derived($gameStore.players);

    let draw: SetupDraw | null = $state.raw(null);
    let error: SetupError | null = $state(null);
    /** Bumped on every full (re)draw: re-mounts the board so it can be dealt again. */
    let generation = $state(0);
    let dealing = $state(false);
    /** The table settings fold away so the deal itself stays in view. */
    let controlsOpen = $state(false);
    let bursts = $state(0);
    let tableEl: HTMLDivElement | undefined = $state();

    // ---------- Animation bookkeeping ----------
    const anims = new Set<Animation>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const busy = new Set<number>();

    function track(anim: Animation) {
        anims.add(anim);
        anim.finished.catch(() => {}).finally(() => anims.delete(anim));
        return anim;
    }

    async function play(el: Element | null | undefined, keyframes: Keyframe[], opts: KeyframeAnimationOptions) {
        if (!el) return;
        try {
            await track(el.animate(keyframes, opts)).finished;
        } catch {
            /* cancelled */
        }
    }

    function later(fn: () => void, delay: number) {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, delay);
        timers.add(id);
    }

    function stopAll() {
        timers.forEach(clearTimeout);
        timers.clear();
        anims.forEach((a) => a.cancel());
        anims.clear();
        busy.clear();
    }

    // ---------- Drawing ----------
    function save() {
        gameStore.setSetup(draw ? toRecord(draw) : null);
    }

    function drawAll() {
        stopAll();
        const r = drawSetup(get(prefs).sets);
        draw = r.ok ? r.draw : null;
        error = r.ok ? null : r.error;
        if (error) controlsOpen = true;
        save();
        generation++;
        if (r.ok && !reducedMotion()) deal();
        else dealing = false;
    }

    /** Change prefs and re-deal if the goal pool changed. */
    function changePrefs(fn: (p: SetupPrefs) => SetupPrefs) {
        const before = get(prefs);
        const after = fn(before);
        prefs.set(after);
        if (after.sets.join() !== before.sets.join()) drawAll();
    }

    // ---------- The big deal ----------
    async function deal() {
        dealing = true;
        await tick();
        if (!tableEl) return;

        const goalEls = [...tableEl.querySelectorAll<HTMLElement>(".goal-flip")];
        const slotEls = [...tableEl.querySelectorAll<HTMLElement>(".slot")];
        let end = 0;

        // 1) Goal tiles slam onto the round slots, flipping face-up on the way down.
        goalEls.forEach((el, i) => {
            const delay = 120 + i * 190;
            const duration = 460;
            const tilt = i % 2 ? 9 : -9;
            track(
                el.animate(
                    [
                        { transform: `translateY(-90px) scale(1.7) rotateX(25deg) rotateY(180deg) rotateZ(${tilt}deg)`, opacity: 0, easing: "cubic-bezier(.55,0,.85,.4)" },
                        { opacity: 1, offset: 0.2 },
                        { transform: "translateY(0) scale(0.92, 0.88) rotateX(0) rotateY(0) rotateZ(0)", offset: 0.72, easing: "cubic-bezier(.34,1.8,.64,1)" },
                        { transform: "none", opacity: 1 },
                    ],
                    { duration, delay, fill: "backwards" },
                ),
            );
            // the slot takes the hit
            const slot = slotEls[i];
            if (slot) {
                track(
                    slot.animate(
                        [{ transform: "none" }, { transform: "scale(1.06, 0.94) translateY(2px)" }, { transform: "none" }],
                        { duration: 240, delay: delay + duration * 0.72, easing: "ease-out" },
                    ),
                );
            }
            end = Math.max(end, delay + duration);
        });

        later(() => {
            dealing = false;
            bursts++;
        }, end);
    }

    function skip() {
        anims.forEach((a) => a.finish());
        anims.clear();
        timers.forEach(clearTimeout);
        timers.clear();
        dealing = false;
    }

    function goalEl(i: number) {
        return tableEl?.querySelector<HTMLElement>(`.goal-flip[data-round="${i}"]`);
    }

    async function redraw(i: number) {
        if (!draw || busy.has(i) || dealing) return;
        const next = redrawGoal(draw, i, get(prefs).sets);
        const el = goalEl(i);
        if (next === draw) {
            play(el, [{ transform: "rotate(-6deg)" }, { transform: "rotate(5deg)" }, { transform: "none" }], { duration: 300 });
            return;
        }
        busy.add(i);
        if (!reducedMotion()) {
            await play(
                el,
                [{ transform: "none" }, { transform: "rotate(240deg) scale(0.35)", opacity: 0.2 }],
                { duration: 220, easing: "cubic-bezier(.55,0,.9,.4)" },
            );
        }
        draw = next;
        save();
        if (!reducedMotion()) {
            await play(
                el,
                [
                    { transform: "rotate(-200deg) scale(0.35)", opacity: 0.2 },
                    { transform: "rotate(12deg) scale(1.08)", opacity: 1, offset: 0.7 },
                    { transform: "none", opacity: 1 },
                ],
                { duration: 420, easing: "cubic-bezier(.2,.8,.3,1)" },
            );
        }
        busy.delete(i);
    }

    async function flip(i: number) {
        if (!draw || busy.has(i) || dealing) return;
        busy.add(i);
        const el = goalEl(i);
        if (!reducedMotion()) {
            await play(el, [{ transform: "none" }, { transform: "rotateY(90deg) scale(1.08)" }], {
                duration: 150,
                easing: "ease-in",
            });
        }
        draw = flipGoal(draw, i);
        save();
        if (!reducedMotion()) {
            await play(
                el,
                [{ transform: "rotateY(-90deg) scale(1.08)" }, { transform: "rotateY(12deg)", offset: 0.65 }, { transform: "none" }],
                { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" },
            );
        }
        busy.delete(i);
    }

    function goalText(i: number) {
        const g = draw?.goals[i];
        return g ? renderGoal(g, $language) : "";
    }

    // ---------- Navigation ----------
    function skipHelper() {
        stopAll();
        gameStore.setSetup(null);
        gameStore.setPhase("SCORING");
    }

    function done() {
        stopAll();
        save();
        gameStore.setPhase("SCORING");
    }

    onMount(() => {
        if (players.length === 0) {
            gameStore.setPhase("SETUP");
            return;
        }
        const restored = fromRecord($gameStore.setup);
        if (restored) {
            draw = restored;
            return;
        }
        prefs.update((p) => ({ ...p, sets: withGameOptions(p.sets, $gameStore.options) }));
        drawAll();
    });

    onDestroy(stopAll);
</script>

<div class="draw-screen">
    <header class="intro">
        <h2>{$t("setupHelper")}</h2>
        <p class="tagline">{$t("setupIntro")}</p>
    </header>

    <!-- What is on the table -->
    <section class="card controls" in:swoop={{ y: 16 }}>
        <button class="controls-toggle" aria-expanded={controlsOpen} aria-controls="setup-controls" onclick={() => (controlsOpen = !controlsOpen)}>
            <span class="toggle-text">
                <span class="controls-title">{$t("setupTable")}</span>
                <span class="summary">
                    {#each $prefs.sets as set (set)}
                        <span class="sum-set" style="--set: {SET_COLORS[set]}">{$t(`set_${set}` as TranslationKey)}</span>
                    {/each}
                </span>
            </span>
            <svg class="chev" class:open={controlsOpen} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>

        {#if controlsOpen}
        <div id="setup-controls" class="controls-body" transition:slide={{ duration: ms(260) }}>
        <span class="label">{$t("setupSets")}</span>
        <div class="chips" role="group" aria-label={$t("setupSets")}>
            {#each GOAL_SETS as set}
                {@const on = $prefs.sets.includes(set)}
                <button
                    class="chip"
                    class:on
                    style="--set: {SET_COLORS[set]}"
                    aria-pressed={on}
                    onclick={() => changePrefs((p) => ({ ...p, sets: toggleSet(p.sets, set) }))}
                >
                    <span class="dot" aria-hidden="true">
                        {#if on}
                            <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 8.5l3 3 7-7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        {/if}
                    </span>
                    {$t(`set_${set}` as TranslationKey)}
                </button>
            {/each}
        </div>

        </div>
        {/if}
    </section>

    {#if error}
        <div class="card error" role="alert" in:pop={{ duration: 320 }}>
            <span class="sad"><Bird size={44} color="#8a9ba8" breast="#c9b9a6" /></span>
            <p>{$t(ERROR_KEYS[error])}</p>
        </div>
    {:else if draw}
        {@const current = draw}
        <div class="table" bind:this={tableEl}>
            {#key generation}
                <!-- Round goals -->
                <section class="goals">
                    <h3 class="section-title">{$t("round_goals")}</h3>
                    <div class="goal-board">
                        {#each current.goals as goal, i}
                            <div class="slot">
                                <span class="round-badge" aria-hidden="true">R{i + 1}</span>
                                <div class="goal-flip" data-round={i}>
                                    <div class="face front" style="--set: {SET_COLORS[goal.tile.set]}">
                                        <span class="visually-hidden">{$t("round")} {i + 1}:</span>
                                        <span class="goal-text">{goalText(i)}</span>
                                        <span class="goal-actions">
                                            <button class="mini" onclick={() => redraw(i)} aria-label={$t("setupRedraw", { n: i + 1 })} title={$t("setupRedraw", { n: i + 1 })}>
                                                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></svg>
                                            </button>
                                            <button class="mini" onclick={() => flip(i)} aria-label={$t("setupFlip", { n: i + 1 })} title={$t("setupFlip", { n: i + 1 })}>
                                                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13l-3-3M20 15H7l3 3" /></svg>
                                            </button>
                                        </span>
                                    </div>
                                    <div class="face back" aria-hidden="true">
                                        <Feather color="#fffaf0" size={40} />
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>

                <!-- Deck -->
                <div class="deck-row">
                    <button class="btn-secondary shuffle" onclick={drawAll} disabled={dealing}>
                        <span class="deck" class:dealing aria-hidden="true">
                            <span class="deck-card c3"></span>
                            <span class="deck-card c2"></span>
                            <span class="deck-card c1"><Feather color="#fffaf0" size={22} /></span>
                        </span>
                        {dealing ? $t("setupDealing") : $t("setupShuffle")}
                    </button>
                    {#key bursts}
                        {#if bursts > 0}
                            <Burst count={26} spread={150} eggRatio={0.15} />
                        {/if}
                    {/key}
                </div>

            {/key}

            {#if dealing}
                <button class="skip-overlay" onclick={skip} aria-label={$t("tapToSkip")}>
                    <span class="skip-pill">
                        {$t("tapToSkip")}
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6l7 6-7 6M13 6l7 6-7 6" /></svg>
                    </span>
                </button>
            {/if}
        </div>
    {/if}

    <div class="actions">
        <button class="btn-ghost skip-btn" onclick={skipHelper}>{$t("skip")}</button>
        <button class="btn-primary gold done-btn" onclick={done} disabled={!draw}>
            {$t("setupDone")}
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
        </button>
    </div>
</div>

<style>
    .draw-screen {
        display: flex;
        flex-direction: column;
    }

    .intro {
        text-align: center;
        margin-bottom: 10px;
    }

    .intro h2 {
        font-size: 1.5rem;
        color: var(--forest-deep);
    }

    .tagline {
        font-family: var(--font-hand);
        font-size: 1.3rem;
        line-height: 1.1;
        color: var(--ink-soft);
    }

    /* ---------- Controls ---------- */
    .controls {
        padding: 12px 14px;
        margin-bottom: 14px;
    }

    .controls-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        text-align: left;
        border-radius: 10px;
    }

    .toggle-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .controls-title {
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 1.1rem;
    }

    .summary {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .sum-set {
        padding: 0 8px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 800;
        line-height: 1.7;
        color: #fff;
        background: var(--set);
    }

    .chev {
        flex-shrink: 0;
        color: var(--ink-soft);
        transition: transform 0.3s var(--spring);
    }

    .chev.open {
        transform: rotate(180deg);
    }

    .controls-body {
        padding-top: 4px;
    }

    .label {
        display: block;
        margin: 8px 0 6px;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-soft);
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 4px 12px 4px 6px;
        border-radius: 999px;
        background: var(--paper);
        border: 1.5px solid var(--line);
        font-size: 0.88rem;
        color: var(--ink-soft);
    }

    .chip .dot {
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid var(--set);
        background: transparent;
        transition: background-color 0.2s, transform 0.3s var(--spring);
    }

    .chip.on {
        background: #fff;
        border-color: var(--set);
        color: var(--ink);
        box-shadow: 0 2px 0 var(--set);
    }

    .chip.on .dot {
        background: var(--set);
        transform: rotate(-8deg) scale(1.08);
    }

    .chip:hover {
        transform: translateY(-2px) rotate(-1.5deg);
    }

    .chip:active {
        transform: scale(0.92);
    }

    .error {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #fbeee9;
        border-color: #e8b3a8;
    }

    .error p {
        font-weight: 700;
        font-size: 0.92rem;
        line-height: 1.35;
    }

    .sad {
        flex-shrink: 0;
        animation: wobble 1.6s ease-in-out infinite;
        transform-origin: 50% 100%;
    }

    /* ---------- Table ---------- */
    .table {
        position: relative;
    }

    .goal-board {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 10px;
        padding: 14px 10px 10px;
        border-radius: var(--radius-md);
        background:
            repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 8px, transparent 8px 16px),
            linear-gradient(160deg, #3f8f7c, #2a6f60);
        box-shadow:
            inset 0 3px 8px rgba(10, 40, 30, 0.35),
            var(--shadow-sm);
        perspective: 700px;
        margin-bottom: 14px;
    }

    .slot {
        position: relative;
        min-width: 0;
        min-height: 104px;
        border-radius: 14px;
        background: rgba(10, 40, 30, 0.25);
        box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.25);
    }

    .round-badge {
        position: absolute;
        top: -9px;
        left: -4px;
        z-index: 3;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--gold);
        color: #3a2e12;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 0.85rem;
        box-shadow: 0 2px 0 var(--grassland-deep);
    }

    .goal-flip {
        position: relative;
        height: 100%;
        transform-style: preserve-3d;
        will-change: transform;
    }

    .face {
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        border-radius: 14px;
    }

    .face.back {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        transform: rotateY(180deg);
        background:
            repeating-linear-gradient(-30deg, rgba(255, 255, 255, 0.08) 0 5px, transparent 5px 11px),
            linear-gradient(150deg, #a47b52, #6e4b31);
        border: 2px solid #fffaf0;
        box-shadow: var(--shadow-sm);
    }

    .goal-flip .face.front {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 104px;
        padding: 14px 8px 6px 10px;
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 250, 240, 0.95)),
            var(--card);
        border: 2px solid #fffaf0;
        border-bottom: 4px solid var(--set);
        box-shadow: 0 3px 0 rgba(10, 40, 30, 0.35);
    }

    .goal-text {
        flex: 1;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 0.92rem;
        line-height: 1.2;
        overflow-wrap: anywhere;
        hyphens: auto;
    }

    .goal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 4px;
    }

    .mini {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: var(--forest-deep);
        background: #e3f1ec;
        box-shadow: 0 2px 0 rgba(31, 90, 78, 0.35);
    }

    .mini:hover:not(:disabled) {
        transform: translateY(-1px) rotate(-12deg);
    }

    .mini:active:not(:disabled) {
        transform: scale(0.85);
    }

    /* ---------- Deck ---------- */
    .deck-row {
        position: relative;
        display: flex;
        justify-content: center;
        margin: 4px 0 14px;
    }

    .shuffle {
        gap: 12px;
        padding-left: 10px;
    }

    .shuffle:disabled {
        opacity: 1;
        cursor: progress;
    }

    .deck {
        position: relative;
        width: 26px;
        height: 34px;
    }

    .deck-card {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        border-radius: 5px;
        border: 1.5px solid #fffaf0;
        background: linear-gradient(150deg, #a47b52, #6e4b31);
        box-shadow: 0 1px 2px rgba(60, 40, 20, 0.35);
    }

    .deck-card :global(svg) {
        height: 22px;
    }

    .c2 {
        transform: rotate(-8deg) translate(-2px, 1px);
    }

    .c3 {
        transform: rotate(9deg) translate(2px, 2px);
    }

    .shuffle:hover:not(:disabled) .c2 {
        transform: rotate(-16deg) translate(-5px, 0);
    }

    .shuffle:hover:not(:disabled) .c3 {
        transform: rotate(18deg) translate(5px, 1px);
    }

    .deck-card {
        transition: transform 0.3s var(--spring);
    }

    .deck.dealing .c1 {
        animation: deck-jiggle 0.14s linear infinite alternate;
    }

    @keyframes deck-jiggle {
        from {
            transform: translate(0, 0) rotate(-2deg);
        }
        to {
            transform: translate(1px, -2px) rotate(3deg);
        }
    }

    /* ---------- Skip overlay ---------- */
    .skip-overlay {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 8px;
        background: transparent;
        border-radius: var(--radius-md);
    }

    .skip-pill {
        position: sticky;
        bottom: 90px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 14px;
        border-radius: 999px;
        background: rgba(43, 58, 47, 0.78);
        color: #fffaf0;
        font-family: var(--font-hand);
        font-size: 1.25rem;
        box-shadow: var(--shadow-md);
        animation: bob 1s ease-in-out infinite;
    }

    /* ---------- Actions ---------- */
    .actions {
        position: sticky;
        bottom: 12px;
        z-index: 50;
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
        padding-top: 8px;
    }

    .skip-btn {
        min-height: 52px;
        padding: 6px 12px;
        font-size: 0.95rem;
        background: rgba(245, 236, 215, 0.92);
        box-shadow: 0 0 0 1.5px var(--line);
    }

    .done-btn {
        min-height: 54px;
        font-size: 1.02rem;
        padding: 10px 12px;
        gap: 6px;
        white-space: nowrap;
    }

    @media (max-width: 389px) {
        .done-btn {
            font-size: 0.98rem;
        }

        .done-btn :global(svg) {
            display: none;
        }
    }

</style>
