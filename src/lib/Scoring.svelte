<script lang="ts">
    import {
        gameStore,
        activeCategories,
        isPlacementCategory as isPlacement,
        validateAllRoundGoals,
        validateAllNectar,
    } from "./store";
    import { CASUAL_ROUND_GOAL_MAX, ROUND_COUNT, SIGNED_CATEGORIES, type Category } from "./rules/scoring";
    import { t, type TranslationKey } from "./i18n";
    import { tick } from "svelte";
    import RoundGoalGrid from "./RoundGoalGrid.svelte";
    import NectarGoalGrid from "./NectarGoalGrid.svelte";
    import Egg from "./ui/Egg.svelte";
    import Bird from "./ui/Bird.svelte";
    import Feather from "./ui/Feather.svelte";
    import CategoryIcon, { CATEGORY_COLORS } from "./ui/CategoryIcon.svelte";
    import TweenedNumber from "./ui/TweenedNumber.svelte";
    import { swoop, pop } from "./ui/motion";

    const CASUAL_MAX = CASUAL_ROUND_GOAL_MAX * ROUND_COUNT;

    let activePlayerId: string | null = null;
    let inputElements: Record<string, HTMLInputElement> = {};

    $: players = $gameStore.players;
    $: options = $gameStore.options;
    $: currentCategoryIndex = $gameStore.currentScoringCategoryIndex;
    $: categories = activeCategories(options);
    $: currentCategory = categories[currentCategoryIndex];
    $: isLastCategory = currentCategoryIndex === categories.length - 1;
    $: isPlacementCategory = isPlacement(currentCategory, options);
    $: signed = SIGNED_CATEGORIES.includes(currentCategory);
    $: maxValue = currentCategory === "round_goals" && !isPlacementCategory ? CASUAL_MAX : undefined;
    $: hintKey = (
        currentCategory === "round_goals" && !isPlacementCategory
            ? "hint_round_goals_casual"
            : `hint_${currentCategory}`
    ) as TranslationKey;

    // Direction-aware header/content swoop.
    let previousCategoryIndex = -1;
    let dir = 1;
    $: if (currentCategoryIndex !== previousCategoryIndex) {
        dir = currentCategoryIndex >= previousCategoryIndex ? 1 : -1;
        previousCategoryIndex = currentCategoryIndex;
        onCategoryChange();
    }

    function onCategoryChange() {
        if (isPlacementCategory) {
            if (!players.some((p) => p.id === activePlayerId)) activePlayerId = players[0]?.id ?? null;
            return;
        }
        tick().then(() => {
            const first = inputElements[players[0]?.id];
            first?.focus({ preventScroll: true });
            first?.select();
        });
    }

    function clamp(val: number): number {
        if (!Number.isFinite(val)) return 0;
        if (!signed) val = Math.max(0, val);
        if (maxValue !== undefined) val = Math.min(maxValue, val);
        return Math.trunc(val);
    }

    function setScore(playerId: string, val: number) {
        gameStore.updateScore(playerId, currentCategory, clamp(val));
    }

    function step(playerId: string, delta: number) {
        const p = players.find((pl) => pl.id === playerId);
        if (!p) return;
        setScore(playerId, (p.scores[currentCategory] ?? 0) + delta);
        bounce(playerId);
    }

    function toggleSign(playerId: string) {
        const p = players.find((pl) => pl.id === playerId);
        if (!p) return;
        setScore(playerId, -(p.scores[currentCategory] ?? 0));
        bounce(playerId);
    }

    function bounce(playerId: string) {
        inputElements[playerId]?.animate(
            [{ transform: "scale(1)" }, { transform: "scale(1.22) rotate(-3deg)" }, { transform: "scale(1)" }],
            { duration: 260, easing: "cubic-bezier(.34,1.56,.64,1)" },
        );
    }

    $: isCurrentCategoryValid = (() => {
        if (currentCategory === "round_goals" && isPlacementCategory) return validateAllRoundGoals(players);
        if (currentCategory === "nectar") return validateAllNectar(players);
        return true;
    })();

    function focusNextInput(currentPlayerId: string) {
        const ids = players.map((p) => p.id);
        const next = ids[ids.indexOf(currentPlayerId) + 1];
        if (next) {
            inputElements[next]?.focus();
            inputElements[next]?.select();
        } else if (isCurrentCategoryValid) {
            gameStore.nextCategory();
        }
    }

    function handleKeydown(e: KeyboardEvent, playerId: string) {
        const blocked = signed ? ["e", "E", "+"] : ["e", "E", "+", "-"];
        if (blocked.includes(e.key)) e.preventDefault();
        if (e.key === "Enter") {
            e.preventDefault();
            focusNextInput(playerId);
        }
    }

    function handleReset() {
        if (currentCategory === "round_goals") gameStore.resetAllRoundPlacements();
        else if (currentCategory === "nectar") gameStore.resetAllNectarPlacements();
    }

    const pct = (i: number, n: number) => (n <= 1 ? 50 : 6 + (i / (n - 1)) * 88);
    $: activePlayer = players.find((p) => p.id === activePlayerId);
    const color = (c: Category) => CATEGORY_COLORS[c];
</script>

<div class="scoring">
    <div class="topbar">
        <button class="btn-ghost" on:click={() => gameStore.prevCategory()}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>
            {$t("back")}
        </button>
        <span class="step-count hand">{currentCategoryIndex + 1} / {categories.length}</span>
    </div>

    <!-- Progress: a branch that fills with feathers, a bird hops along -->
    <div
        class="branch"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={categories.length}
        aria-valuenow={currentCategoryIndex + 1}
        aria-label={$t("progressLabel", { i: currentCategoryIndex + 1, n: categories.length })}
    >
        <svg class="twig" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 12 Q25 8 50 12 T100 11" stroke="#8a6142" stroke-width="2.6" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        {#each categories as cat, i (cat)}
            <span class="node" style="left: {pct(i, categories.length)}%">
                {#if i < currentCategoryIndex}
                    <span class="feather-node" in:pop={{ duration: 380 }} style="--r: {i % 2 ? 24 : -24}deg">
                        <Feather color={color(cat)} size={26} />
                    </span>
                {:else if i === currentCategoryIndex}
                    <span class="bud current" style="--c: {color(cat)}"></span>
                {:else}
                    <span class="bud"></span>
                {/if}
            </span>
        {/each}
        <span class="branch-bird" style="left: {pct(currentCategoryIndex, categories.length)}%">
            {#key currentCategoryIndex}
                <span class="hop"><Bird size={34} facing={dir === 1 ? 1 : -1} /></span>
            {/key}
        </span>
    </div>

    {#key currentCategory}
        <div class="category-header" in:swoop={{ x: 70 * dir, y: -10, rotate: 6 * dir, duration: 420 }}>
            <span class="cat-badge" style="--c: {color(currentCategory)}">
                <CategoryIcon category={currentCategory} size={34} />
            </span>
            <div>
                <h2>{$t(currentCategory)}</h2>
                <p class="hint">{$t(hintKey)}</p>
            </div>
        </div>

        <div class="inputs" in:swoop={{ x: 50 * dir, y: 0, duration: 380, delay: 40 }}>
            {#if isPlacementCategory}
                <div class="card selector">
                    <div class="selector-header">
                        <span class="label-hand">{$t("selectPlayerPlace")}</span>
                        <button class="icon-btn reset" on:click={handleReset} aria-label={$t("resetGrid")} title={$t("resetGrid")}>
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" /></svg>
                        </button>
                    </div>
                    <div class="avatars" role="radiogroup" aria-label={$t("selectPlayerPlace")}>
                        {#each players as player, i (player.id)}
                            <button
                                class="avatar"
                                class:selected={activePlayerId === player.id}
                                role="radio"
                                aria-checked={activePlayerId === player.id}
                                on:click={() => (activePlayerId = player.id)}
                                in:swoop={{ y: 14, delay: 40 * i, duration: 320 }}
                            >
                                <span class="avatar-egg"><Egg color={player.color} size={26} /></span>
                                <span class="avatar-name">{player.name}</span>
                                <span class="avatar-pts">
                                    +<TweenedNumber value={player.scores[currentCategory] ?? 0} />
                                </span>
                            </button>
                        {/each}
                    </div>
                </div>

                <p class="instruction">
                    {#if activePlayer}
                        {$t("tapGrid")} <strong style="--c: {activePlayer.color}">{activePlayer.name}</strong>
                    {:else}
                        {$t("selectAbove")}
                    {/if}
                </p>
                {#if currentCategory === "round_goals"}
                    <RoundGoalGrid activePlayerId={activePlayerId} />
                {:else if currentCategory === "nectar"}
                    <NectarGoalGrid activePlayerId={activePlayerId} />
                {/if}
                {#if !isCurrentCategoryValid}
                    <p class="invalid" role="alert" in:pop={{ duration: 260, start: 0.8 }}>{$t("invalidRows")}</p>
                {/if}
            {:else}
                {#each players as player, i (player.id)}
                    {@const value = player.scores[currentCategory] ?? 0}
                    <div class="player-card" in:swoop={{ y: 16, delay: 50 * i + 60, duration: 340 }}>
                        <span class="egg-holder"><Egg color={player.color} size={30} /></span>
                        <div class="who">
                            <span class="player-name">{player.name}</span>
                            <span class="running">Σ <TweenedNumber value={player.total} /> {$t("pts")}</span>
                        </div>
                        <div class="stepper">
                            {#if signed}
                                <button
                                    class="step sign"
                                    on:click={() => toggleSign(player.id)}
                                    aria-label={$t("toggleSign", { name: player.name })}
                                >±</button>
                            {/if}
                            <button
                                class="step"
                                on:click={() => step(player.id, -1)}
                                disabled={!signed && value <= 0}
                                aria-label={$t("minusOne", { name: player.name })}
                            >−</button>
                            <input
                                bind:this={inputElements[player.id]}
                                class:negative={value < 0}
                                type="number"
                                inputmode={signed ? "text" : "numeric"}
                                enterkeyhint="next"
                                min={signed ? undefined : 0}
                                max={maxValue}
                                aria-label={$t("pointsFor", { name: player.name })}
                                {value}
                                on:input={(e) => {
                                    const raw = e.currentTarget.value;
                                    if (raw === "" || raw === "-") return;
                                    setScore(player.id, Number(raw));
                                }}
                                on:change={(e) => {
                                    setScore(player.id, Number(e.currentTarget.value) || 0);
                                    e.currentTarget.value = String(player.scores[currentCategory] ?? 0);
                                }}
                                on:keydown={(e) => handleKeydown(e, player.id)}
                                on:focus={(e) => e.currentTarget.select()}
                                placeholder="0"
                            />
                            <button
                                class="step"
                                on:click={() => step(player.id, 1)}
                                disabled={maxValue !== undefined && value >= maxValue}
                                aria-label={$t("plusOne", { name: player.name })}
                            >+</button>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {/key}

    <div class="actions">
        <button class="btn-primary next-btn" class:gold={isLastCategory} on:click={() => gameStore.nextCategory()} disabled={!isCurrentCategoryValid}>
            {isLastCategory ? $t("finishScoring") : $t("next")}
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
        </button>
    </div>
</div>

<style>
    .scoring {
        display: flex;
        flex-direction: column;
    }

    .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: -4px -6px 0;
    }

    .step-count {
        font-size: 1.4rem;
        color: var(--twig);
        padding-right: 6px;
    }

    /* ---------- Branch progress ---------- */
    .branch {
        position: relative;
        height: 64px;
        margin: 0 4px 6px;
    }

    .twig {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 10px;
        width: 100%;
        height: 20px;
    }

    .node {
        position: absolute;
        bottom: 21px;
        transform: translate(-50%, 50%);
        display: grid;
        place-items: center;
    }

    .bud {
        display: block;
        width: 12px;
        height: 12px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #b7c9a0;
        border: 2px solid #6e8f55;
    }

    .bud.current {
        width: 16px;
        height: 16px;
        background: var(--c);
        border-color: rgba(0, 0, 0, 0.25);
    }

    .feather-node {
        display: block;
        transform: rotate(var(--r)) translateY(-6px);
        transform-origin: 50% 100%;
    }

    .branch-bird {
        position: absolute;
        bottom: 26px;
        transform: translateX(-50%);
        transition: left 0.45s var(--spring);
        z-index: 2;
    }

    .hop {
        display: block;
        animation: hop 0.45s cubic-bezier(0.3, 0.7, 0.4, 1);
    }

    @keyframes hop {
        0% {
            transform: translateY(0) scale(1.05, 0.9);
        }
        45% {
            transform: translateY(-14px) rotate(-6deg);
        }
        100% {
            transform: translateY(0);
        }
    }

    /* ---------- Category header ---------- */
    .category-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 4px 0 16px;
    }

    .cat-badge {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 56px;
        height: 56px;
        border-radius: 50% 50% 46% 54% / 55% 45% 55% 45%;
        background: color-mix(in srgb, var(--c) 22%, #fffaf0);
        border: 2px solid color-mix(in srgb, var(--c) 60%, transparent);
        box-shadow: 0 3px 0 color-mix(in srgb, var(--c) 45%, transparent);
    }

    .category-header h2 {
        font-size: 1.6rem;
    }

    .hint {
        font-family: var(--font-hand);
        font-size: 1.25rem;
        line-height: 1.1;
        color: var(--ink-soft);
    }

    .inputs {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 16px;
    }

    /* ---------- Number cards ---------- */
    .player-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 10px 10px 12px;
        background: var(--card);
        border: 1.5px solid var(--line);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
    }

    .egg-holder {
        transform-origin: 50% 90%;
    }

    .player-card:focus-within .egg-holder {
        animation: wobble 0.5s ease;
    }

    .player-card:focus-within {
        border-color: var(--forest);
    }

    .who {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .player-name {
        font-weight: 800;
        font-size: 1.05rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .running {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--ink-soft);
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
        color: var(--ink);
    }

    .step.sign {
        font-size: 1.1rem;
        color: var(--hummingbird);
    }

    .step:active:not(:disabled) {
        transform: scale(0.85);
    }

    .step:disabled {
        opacity: 0.35;
    }

    .stepper input {
        width: 58px;
        height: 44px;
        text-align: center;
        font-family: var(--font-display);
        font-size: 1.35rem;
        font-weight: 600;
        border: 2px solid var(--line);
        border-radius: 12px;
        background: #fff;
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .stepper input::-webkit-outer-spin-button,
    .stepper input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .stepper input:focus {
        outline: none;
        border-color: var(--forest);
        box-shadow: 0 0 0 4px rgba(47, 125, 109, 0.18);
    }

    .stepper input.negative {
        color: var(--berry);
    }

    /* ---------- Placement ---------- */
    .selector {
        padding: 12px;
        margin-bottom: 0;
    }

    .selector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
    }

    .avatars {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 6px 2px 4px;
        scrollbar-width: thin;
    }

    .avatar {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 64px;
        padding: 6px 6px 4px;
        border-radius: 14px;
        border: 2px solid transparent;
    }

    .avatar:hover .avatar-egg {
        animation: wobble 0.45s ease;
    }

    .avatar.selected {
        border-color: var(--forest);
        background: #e3f1ec;
        transform: translateY(-3px);
        box-shadow: 0 3px 0 var(--forest);
    }

    .avatar-egg {
        display: block;
        transform-origin: 50% 90%;
    }

    .avatar-name {
        font-size: 0.8rem;
        font-weight: 800;
        max-width: 72px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .avatar-pts {
        font-family: var(--font-display);
        font-size: 0.8rem;
        color: var(--forest-deep);
    }

    .instruction {
        text-align: center;
        font-size: 0.95rem;
        color: var(--ink-soft);
    }

    .instruction strong {
        color: var(--ink);
        border-bottom: 3px solid var(--c);
    }

    .invalid {
        text-align: center;
        font-weight: 700;
        color: var(--berry);
        font-size: 0.9rem;
    }

    .actions {
        position: sticky;
        bottom: 12px;
        margin-top: auto;
        padding-top: 8px;
        z-index: 5;
    }
</style>
