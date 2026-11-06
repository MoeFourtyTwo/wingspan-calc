<script lang="ts">
    import { onDestroy, onMount, untrack } from "svelte";
    import { flip } from "svelte/animate";
    import { gameStore, activeCategories } from "./store";
    import { historyStore } from "./historyStore";
    import { rankPlayers, needsTieBreaker } from "./rules/scoring";
    import { t } from "./i18n";
    import Egg from "./ui/Egg.svelte";
    import Bird from "./ui/Bird.svelte";
    import Feather from "./ui/Feather.svelte";
    import Burst from "./ui/Burst.svelte";
    import TweenedNumber from "./ui/TweenedNumber.svelte";
    import { CATEGORY_COLORS } from "./ui/CategoryIcon.svelte";
    import { pop, swoop, ms, reducedMotion } from "./ui/motion";

    let players = $derived($gameStore.players);
    let categories = $derived(activeCategories($gameStore.options));
    let standings = $derived(rankPlayers(players));
    let rows = $derived(standings.map((s) => ({ ...s, player: players.find((p) => p.id === s.id)! })));
    let winners = $derived(rows.filter((r) => r.winner));
    let tie = $derived(needsTieBreaker(players));
    let topTotal = $derived(Math.max(...players.map((p) => p.total), 0));
    let tiedTop = $derived(tie ? players.filter((p) => p.total === topTotal) : []);
    let barMax = $derived(Math.max(
        1,
        ...players.map((p) => categories.reduce((acc, c) => acc + Math.max(0, p.scores[c] ?? 0), 0)),
    ));

    // ---------- Reveal sequence: last place first, winner last ----------
    let revealed = $state(new Set<string>());
    let revealDone = $state(false);
    let winnerShown = $state(false);
    let birdLanded = $state(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, delay: number) => timers.push(setTimeout(fn, delay));

    function startReveal() {
        const order = [...rankPlayers($gameStore.players)].reverse().map((s) => s.id);
        const step = Math.min(650, 2600 / Math.max(1, order.length));
        order.forEach((id, i) => {
            later(() => (revealed = new Set([...revealed, id])), 450 + i * step);
        });
        later(showWinner, 450 + order.length * step + 350);
    }

    function showWinner() {
        revealDone = true;
        winnerShown = true;
        later(() => (birdLanded = true), ms(750));
    }

    function skip() {
        timers.forEach(clearTimeout);
        timers.length = 0;
        revealed = new Set(players.map((p) => p.id));
        showWinner();
    }

    // ---------- History (upsert by game id; re-saved after tie-breaks) ----------
    let mounted = $state(false);
    let savedDate = "";

    function saveGame() {
        historyStore.saveGame({
            id: $gameStore.gameId,
            date: savedDate,
            startPlayerName: players.find((p) => p.id === $gameStore.startPlayerId)?.name || "Unknown",
            players: rows.map((r) => ({
                name: r.player.name,
                total: r.player.total,
                scores: r.player.scores,
                winner: r.winner,
                color: r.player.color,
            })),
        });
    }

    // Re-save whenever the standings change (e.g. leftover food entered).
    // saveGame reads and writes the history store, so it must run untracked.
    $effect(() => {
        if (!mounted) return;
        void rows;
        untrack(saveGame);
    });

    onMount(() => {
        savedDate = $historyStore.find((g) => g.id === $gameStore.gameId)?.date ?? new Date().toISOString();
        mounted = true;
        if (reducedMotion()) skip();
        else startReveal();
    });

    onDestroy(() => timers.forEach(clearTimeout));

    function playAgain() {
        if (confirm($t("confirmNewGame"))) gameStore.resetGame();
    }

    const medal = (rank: number) => (rank === 1 ? "#f2cf55" : rank === 2 ? "#cfd3d1" : rank === 3 ? "#d99b62" : "#efe6d2");
    const crown = [-64, -42, -21, 0, 21, 42, 64];
    const crownColors = ["#3b7fb6", "#2f7d6d", "#d9a72b", "#c2554a", "#d9a72b", "#2f7d6d", "#3b7fb6"];
</script>

<div class="result">
    <div class="topbar">
        <button class="btn-ghost" onclick={() => gameStore.backToScoring()}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>
            {$t("adjustScores")}
        </button>
        {#if !revealDone}
            <button class="btn-ghost skip" onclick={skip}>{$t("skip")}</button>
        {/if}
    </div>

    <!-- Winner stage -->
    <section class="winner-stage" aria-live="polite">
        {#if winnerShown && winners.length > 0}
            <div class="winner-card" in:pop={{ duration: 520, start: 0.3 }}>
                <div class="crown" aria-hidden="true">
                    {#each crown as angle, i}
                        <span class="crown-feather" style="--a: {angle}deg; animation-delay: {80 + i * 45}ms">
                            <Feather color={crownColors[i]} size={i === 3 ? 46 : 38} />
                        </span>
                    {/each}
                </div>
                <span class="perch" class:landed={birdLanded} aria-hidden="true">
                    <Bird size={44} flapping={!birdLanded} facing={-1} />
                </span>
                <p class="winner-label hand">
                    {winners.length > 1 ? $t("sharedVictory") : $t("winner")}
                </p>
                <div class="winner-names">
                    {#each winners as w (w.id)}
                        <div class="winner-row">
                            <Egg color={w.player.color} size={28} />
                            <span class="winner-name">{w.player.name}</span>
                        </div>
                    {/each}
                </div>
                <div class="winner-score">
                    <TweenedNumber value={winners[0].total} fromZero duration={900} />
                    {$t("pts")}
                </div>
                <Burst count={30} spread={170} y="40%" />
            </div>
        {:else}
            <div class="mystery">
                <span class="mystery-egg"><Egg color="#efe3c8" size={58} initial="?" /></span>
                <p class="hand drumroll">{$t("revealing")}</p>
            </div>
        {/if}
    </section>

    <!-- Tie-breaker -->
    {#if revealDone && tie}
        <section class="card tie" in:swoop={{ y: 20, delay: 300 }}>
            <h3 class="section-title">
                <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="20" r="6" fill="#c2554a" /><circle cx="21" cy="21" r="5" fill="#c2554a" /><circle cx="17" cy="13" r="4.5" fill="#c2554a" /></svg>
                {$t("tieBreakerTitle")}
            </h3>
            <p class="tie-hint">{$t("tieBreakerHint")}</p>
            <div class="tie-list">
                {#each tiedTop as p (p.id)}
                    <div class="tie-row">
                        <Egg color={p.color} size={24} />
                        <span class="tie-name">{p.name}</span>
                        <div class="stepper">
                            <button
                                class="step"
                                disabled={p.leftoverFood <= 0}
                                onclick={() => gameStore.setLeftoverFood(p.id, p.leftoverFood - 1)}
                                aria-label="{$t('foodTokens')} − ({p.name})">−</button
                            >
                            <input
                                type="number"
                                inputmode="numeric"
                                min="0"
                                value={p.leftoverFood}
                                aria-label="{$t('foodTokens')}: {p.name}"
                                oninput={(e) => gameStore.setLeftoverFood(p.id, Number(e.currentTarget.value))}
                                onfocus={(e) => e.currentTarget.select()}
                            />
                            <button
                                class="step"
                                onclick={() => gameStore.setLeftoverFood(p.id, p.leftoverFood + 1)}
                                aria-label="{$t('foodTokens')} + ({p.name})">+</button
                            >
                        </div>
                    </div>
                {/each}
            </div>
            {#if winners.length > 1}
                <p class="tie-status">{$t("stillTied")}</p>
            {:else if winners[0]}
                {#key winners[0].id}
                    <p class="tie-status win" in:pop={{ duration: 320 }}>
                        🏆 {winners[0].player.name}
                    </p>
                {/key}
            {/if}
        </section>
    {/if}

    <!-- Leaderboard -->
    <section class="leaderboard">
        <h3 class="section-title">{$t("leaderboard")}</h3>
        <ol>
            {#each rows as row, i (row.id)}
                <li animate:flip={{ duration: ms(350) }}>
                    {#if revealed.has(row.id)}
                        <div
                            class="entry"
                            class:is-winner={row.winner && winnerShown}
                            in:swoop={{ y: 26, x: i % 2 ? 18 : -18, rotate: i % 2 ? 3 : -3, duration: 420 }}
                        >
                            <span class="rank" style="--medal: {medal(row.rank)}">{row.rank}.</span>
                            <Egg color={row.player.color} size={26} />
                            <div class="entry-main">
                                <div class="entry-top">
                                    <span class="name">{row.player.name}</span>
                                    {#if tie && row.total === topTotal}
                                        <span class="food-badge" title={$t("foodTokens")}>
                                            <svg width="12" height="12" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="18" r="10" fill="#c2554a" /></svg>
                                            {row.player.leftoverFood}
                                        </span>
                                    {/if}
                                </div>
                                <div class="bar" aria-hidden="true">
                                    {#each categories as cat, ci}
                                        {@const v = Math.max(0, row.player.scores[cat] ?? 0)}
                                        {#if v > 0}
                                            <span
                                                class="seg"
                                                style="width: {(v / barMax) * 100}%; background: {CATEGORY_COLORS[cat]}; animation-delay: {150 + ci * 70}ms"
                                                title="{$t(cat)}: {row.player.scores[cat]}"
                                            ></span>
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                            <span class="score"><TweenedNumber value={row.total} fromZero duration={800} delay={120} /></span>
                        </div>
                    {:else}
                        <div class="entry placeholder" aria-hidden="true">
                            <span class="rank" style="--medal: #efe6d2">?</span>
                            <span class="ph-egg"><Egg color="#e7dcc3" size={26} speckled={false} /></span>
                            <div class="entry-main"><span class="ph-line"></span></div>
                        </div>
                    {/if}
                </li>
            {/each}
        </ol>

        {#if revealDone}
            <ul class="legend" in:swoop={{ y: 10, delay: 200 }}>
                {#each categories as cat}
                    <li><span class="dot" style="background: {CATEGORY_COLORS[cat]}"></span>{$t(cat)}</li>
                {/each}
            </ul>
        {/if}
    </section>

    {#if revealDone}
        <div class="actions" in:swoop={{ y: 24, delay: 350 }}>
            <button class="btn-primary" onclick={() => gameStore.setPhase("STATS")}>
                {$t("viewStats")}
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </button>
            <button class="btn-secondary new-game" onclick={playAgain}>{$t("newGame")}</button>
        </div>
    {/if}

    {#if !revealDone}
        <button class="skip-overlay" onclick={skip} aria-label={$t("tapToSkip")}></button>
    {/if}
</div>

<style>
    .result {
        position: relative;
        display: flex;
        flex-direction: column;
    }

    .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: -4px -6px 4px;
        position: relative;
        z-index: 25;
    }

    .skip {
        font-family: var(--font-hand);
        font-size: 1.3rem;
    }

    .skip-overlay {
        position: absolute;
        inset: 44px 0 0;
        z-index: 20;
        background: transparent;
        cursor: pointer;
    }

    /* ---------- Winner ---------- */
    .winner-stage {
        min-height: 250px;
        display: grid;
        place-items: center;
        margin-bottom: 8px;
    }

    .mystery {
        display: grid;
        justify-items: center;
        gap: 8px;
    }

    .mystery-egg {
        display: block;
        transform-origin: 50% 90%;
        animation: wobble 0.9s ease-in-out infinite;
    }

    .drumroll {
        font-size: 1.8rem;
        color: var(--ink-soft);
    }

    .winner-card {
        position: relative;
        width: 100%;
        margin-top: 64px;
        padding: 18px 16px 16px;
        text-align: center;
        background: radial-gradient(circle at 50% 0%, #fff6d8, var(--card) 70%);
        border: 2.5px solid var(--gold);
        border-radius: var(--radius-lg);
        box-shadow:
            0 4px 0 #c99a1e,
            0 18px 30px -16px rgba(120, 90, 10, 0.55);
    }

    .crown {
        position: absolute;
        left: 50%;
        top: 6px;
        width: 0;
        height: 0;
    }

    .crown-feather {
        position: absolute;
        left: 0;
        bottom: 0;
        transform-origin: 50% 100%;
        transform: translateX(-50%) rotate(var(--a)) translateY(-6px);
        animation: fan 0.5s var(--spring) backwards;
    }

    @keyframes fan {
        from {
            transform: translateX(-50%) rotate(0deg) translateY(10px) scale(0.2);
            opacity: 0;
        }
    }

    .perch {
        position: absolute;
        right: 14px;
        top: -34px;
        z-index: 3;
        animation: land 0.75s cubic-bezier(0.25, 0.8, 0.35, 1) backwards;
    }

    .perch.landed {
        animation: bob 1.2s ease-in-out infinite;
    }

    @keyframes land {
        from {
            transform: translate(140px, -160px) rotate(-20deg);
        }
        70% {
            transform: translate(-6px, 4px) rotate(4deg);
        }
        to {
            transform: translate(0, 0);
        }
    }

    .winner-label {
        font-size: 1.7rem;
        color: var(--grassland-deep);
        line-height: 1;
    }

    .winner-names {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin: 6px 0 8px;
    }

    .winner-row {
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 100%;
    }

    .winner-name {
        font-family: var(--font-display);
        font-size: 2.1rem;
        font-weight: 700;
        line-height: 1.1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .winner-score {
        display: inline-block;
        font-family: var(--font-display);
        font-size: 1.4rem;
        font-weight: 600;
        color: #3a2e12;
        background: var(--gold);
        padding: 2px 16px;
        border-radius: 999px;
        box-shadow: 0 3px 0 #b88a12;
    }

    /* ---------- Tie-breaker ---------- */
    .tie {
        border: 2px dashed var(--berry);
    }

    .tie-hint {
        font-size: 0.9rem;
        color: var(--ink-soft);
        margin: -4px 0 10px;
    }

    .tie-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .tie-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .tie-name {
        flex: 1;
        min-width: 0;
        font-weight: 800;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .stepper {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .step {
        width: 36px;
        height: 40px;
        border-radius: 12px;
        background: var(--paper);
        border: 1.5px solid var(--line);
        font-size: 1.3rem;
        line-height: 1;
    }

    .step:active:not(:disabled) {
        transform: scale(0.85);
    }

    .step:disabled {
        opacity: 0.35;
    }

    .stepper input {
        width: 54px;
        height: 42px;
        text-align: center;
        font-family: var(--font-display);
        font-size: 1.25rem;
        border: 2px solid var(--line);
        border-radius: 12px;
        background: #fff;
        appearance: textfield;
        -moz-appearance: textfield;
    }

    .stepper input::-webkit-outer-spin-button,
    .stepper input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .tie-status {
        margin-top: 12px;
        text-align: center;
        font-family: var(--font-hand);
        font-size: 1.5rem;
        line-height: 1.1;
        color: var(--berry);
    }

    .tie-status.win {
        color: var(--forest-deep);
    }

    /* ---------- Leaderboard ---------- */
    .leaderboard {
        margin: 6px 0 12px;
    }

    ol {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .entry {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 62px;
        padding: 10px 14px 10px 10px;
        background: var(--card);
        border: 1.5px solid var(--line);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        transition:
            border-color 0.3s,
            box-shadow 0.3s;
    }

    .entry.is-winner {
        border-color: var(--gold);
        box-shadow:
            0 3px 0 #e1bd52,
            var(--shadow-sm);
    }

    .placeholder {
        background: transparent;
        border: 2px dashed var(--line);
        box-shadow: none;
    }

    .ph-egg {
        display: block;
        transform-origin: 50% 90%;
        animation: wobble 1.2s ease-in-out infinite;
    }

    .ph-line {
        display: block;
        height: 10px;
        width: 60%;
        border-radius: 999px;
        background: rgba(110, 80, 50, 0.12);
    }

    .rank {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--medal);
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 0.95rem;
        color: #3a2e12;
        box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.12);
    }

    .entry-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .entry-top {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .name {
        font-weight: 800;
        font-size: 1.05rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .food-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.8rem;
        font-weight: 800;
        color: var(--berry);
    }

    .bar {
        display: flex;
        height: 9px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(110, 80, 50, 0.08);
    }

    .seg {
        display: block;
        height: 100%;
        transform-origin: 0 50%;
        animation: grow 0.45s var(--snap) backwards;
    }

    .seg + .seg {
        box-shadow: inset 1.5px 0 0 rgba(255, 255, 255, 0.6);
    }

    @keyframes grow {
        from {
            transform: scaleX(0);
        }
    }

    .score {
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 700;
        min-width: 2.2em;
        text-align: right;
    }

    .legend {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        margin-top: 10px;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--ink-soft);
    }

    .legend li {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 8px;
    }

    .new-game {
        width: 100%;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 1.05rem;
    }
</style>
