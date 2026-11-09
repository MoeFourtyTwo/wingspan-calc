<script lang="ts">
    import { tick } from "svelte";
    import { slide } from "svelte/transition";
    import { gameStore, activeCategories, isPlacementCategory, type Player } from "../store";
    import { CASUAL_ROUND_GOAL_MAX, ROUND_COUNT, SIGNED_CATEGORIES, type Category } from "../rules/scoring";
    import { t } from "../i18n";
    import RoundGoalGrid from "../RoundGoalGrid.svelte";
    import NectarGoalGrid from "../NectarGoalGrid.svelte";
    import QuickSumSheet from "../quicksum/QuickSumSheet.svelte";
    import Egg from "../ui/Egg.svelte";
    import CategoryIcon, { CATEGORY_COLORS } from "../ui/CategoryIcon.svelte";
    import TweenedNumber from "../ui/TweenedNumber.svelte";
    import { ms, pop, swoop } from "../ui/motion";
    import GuestPicker from "./GuestPicker.svelte";
    import type { GuestView } from "./session";

    interface Props {
        view: GuestView;
        onclaim: (playerIds: string[]) => void;
    }

    let { view, onclaim }: Props = $props();

    let players = $derived($gameStore.players);
    let options = $derived($gameStore.options);
    let categories = $derived(activeCategories(options));
    let typed = $derived(categories.filter((c) => !isPlacementCategory(c, options)));
    let atTable = $derived(categories[$gameStore.currentScoringCategoryIndex]);
    let mine = $derived(players.filter((p) => view.claims[p.id] === view.deviceId));
    let pickerOpen = $state(false);
    let showPicker = $derived(pickerOpen || mine.length === 0);

    const maxFor = (c: Category) =>
        c === "round_goals" && !isPlacementCategory(c, options) ? CASUAL_ROUND_GOAL_MAX * ROUND_COUNT : undefined;
    const isSigned = (c: Category) => SIGNED_CATEGORIES.includes(c);
    const key = (pid: string, c: Category) => `${pid}:${c}`;

    function clamp(c: Category, val: number): number {
        if (!Number.isFinite(val)) return 0;
        if (!isSigned(c)) val = Math.max(0, val);
        const max = maxFor(c);
        if (max !== undefined) val = Math.min(max, val);
        return Math.trunc(val);
    }

    /**
     * Values this phone sent a moment ago. A host snapshot that was already on
     * its way can briefly show an older value; quick taps on −/+ build on what
     * was sent, not on that echo.
     */
    const recent = new Map<string, { v: number; at: number }>();

    function current(p: Player, c: Category): number {
        const r = recent.get(key(p.id, c));
        return r && Date.now() - r.at < 1500 ? r.v : (p.scores[c] ?? 0);
    }

    function setScore(p: Player, c: Category, val: number) {
        const v = clamp(c, val);
        recent.set(key(p.id, c), { v, at: Date.now() });
        gameStore.updateScore(p.id, c, v);
    }

    let inputs: Record<string, HTMLInputElement> = $state({});

    function bounce(k: string) {
        inputs[k]?.animate(
            [{ transform: "scale(1)" }, { transform: "scale(1.22) rotate(-3deg)" }, { transform: "scale(1)" }],
            { duration: ms(260), easing: "cubic-bezier(.34,1.56,.64,1)" },
        );
    }

    function step(p: Player, c: Category, delta: number) {
        setScore(p, c, current(p, c) + delta);
        bounce(key(p.id, c));
    }

    function toggleSign(p: Player, c: Category) {
        setScore(p, c, -current(p, c));
        bounce(key(p.id, c));
    }

    /** Keep the field in sync with the game, but never under the user's fingers. */
    function syncValue(node: HTMLInputElement, value: number) {
        const set = (v: number) => {
            if (document.activeElement !== node) node.value = String(v);
        };
        set(value);
        return { update: set };
    }

    function focusNext(k: string) {
        const order = typed.flatMap((c) => mine.map((p) => key(p.id, c)));
        const next = inputs[order[order.indexOf(k) + 1]];
        if (next) {
            next.focus();
            next.select();
        } else {
            inputs[k]?.blur();
        }
    }

    function onKeydown(e: KeyboardEvent, c: Category, k: string) {
        const blocked = isSigned(c) ? ["e", "E", "+"] : ["e", "E", "+", "-"];
        if (blocked.includes(e.key)) e.preventDefault();
        if (e.key === "Enter") {
            e.preventDefault();
            focusNext(k);
        }
    }

    // ---- Quick sum ----
    let qs: { playerId: string; category: Category } | null = $state(null);
    let qsButtons: Record<string, HTMLButtonElement> = $state({});
    let qsPlayer = $derived(qs ? mine.find((p) => p.id === qs!.playerId) : undefined);
    let qsNext = $derived(qs ? mine[mine.findIndex((p) => p.id === qs!.playerId) + 1] : undefined);

    function closeQuickSum(focusKey = qs ? key(qs.playerId, qs.category) : null) {
        qs = null;
        if (focusKey) tick().then(() => qsButtons[focusKey]?.focus({ preventScroll: true }));
    }

    function applyQuickSum(total: number, goNext: boolean) {
        if (!qs || !qsPlayer) return;
        setScore(qsPlayer, qs.category, total);
        bounce(key(qsPlayer.id, qs.category));
        if (goNext && qsNext) qs = { playerId: qsNext.id, category: qs.category };
        else closeQuickSum();
    }

    // ---- Placement grids: which of my players is placing ----
    let roundPick: string | null = $state(null);
    let nectarPick: string | null = $state(null);
    const pickFrom = (id: string | null) => (mine.some((p) => p.id === id) ? id : (mine[0]?.id ?? null));
    let roundActive = $derived(pickFrom(roundPick));
    let nectarActive = $derived(pickFrom(nectarPick));
    let roundActivePlayer = $derived(mine.find((p) => p.id === roundActive));
    let nectarActivePlayer = $derived(mine.find((p) => p.id === nectarActive));

    const fmtCat = (c: Category) => $t(c);

    // ---- Follow the table: when the host moves on, scroll to that category ----
    let sections: Record<string, HTMLElement> = $state({});
    let lastAtTable: Category | undefined;
    $effect(() => {
        const c = atTable;
        if (!c || c === lastAtTable) return;
        const first = lastAtTable === undefined;
        lastAtTable = c;
        if (first || qs) return; // don't jump on open or while the quick-sum pad is up
        const typing = document.activeElement instanceof HTMLInputElement;
        if (typing) return;
        tick().then(() =>
            sections[c]?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }),
        );
    });
</script>

<div class="guest-scoring">
    <header class="intro" in:swoop={{ y: 14, duration: 360 }}>
        <h2>{$t("guestYourScoring")}</h2>
        <p class="hint">{$t("guestYourHint")}</p>
        {#if atTable}
            <span class="at-table">
                <CategoryIcon category={atTable} size={18} />
                {$t("guestAtTable", { category: fmtCat(atTable) })}
            </span>
        {/if}
    </header>

    <section class="picker-wrap">
        {#if mine.length > 0}
            <button class="picker-toggle" aria-expanded={showPicker} onclick={() => (pickerOpen = !pickerOpen)}>
                <span class="mini-eggs" aria-hidden="true">
                    {#each mine as p (p.id)}<Egg color={p.color} size={16} speckled={false} />{/each}
                </span>
                {$t("guestChangePlayers")}
                <svg class="chev" class:open={showPicker} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
        {:else}
            <h3 class="label-hand">{$t("guestWho")}</h3>
        {/if}
        {#if showPicker}
            <div class="picker-body" transition:slide|local={{ duration: ms(220) }}>
                <GuestPicker {players} claims={view.claims} devices={view.devices} myId={view.deviceId} onchange={onclaim} />
            </div>
        {/if}
    </section>

    {#if mine.length === 0}
        <div class="empty" in:pop={{ duration: 360, start: 0.7 }}>
            <span class="empty-egg" aria-hidden="true">
                <svg viewBox="0 0 120 40" width="110" height="36">
                    <ellipse cx="60" cy="26" rx="52" ry="12" fill="#8a6142" />
                    <ellipse cx="60" cy="22" rx="40" ry="8" fill="#5e4029" />
                </svg>
            </span>
            <p class="hand">{$t("guestNoneClaimed")}</p>
        </div>
    {:else}
        <!-- My players at a glance -->
        <section class="totals" aria-label={$t("guestYourScoring")}>
            {#each mine as p, pi (p.id)}
                {@const done = typed.filter((c) => view.filled[p.id]?.includes(c)).length}
                <div class="total-chip" style="--pc: {p.color}" in:swoop={{ y: 12, delay: 50 * pi, duration: 320 }}>
                    <Egg color={p.color} size={26} />
                    <span class="pwho">
                        <span class="pname">{p.name}</span>
                        <span class="progress">{$t("guestProgress", { i: done, n: typed.length })}</span>
                    </span>
                    <span class="ptotal" aria-label="{p.total} {$t('pts')}">
                        <span class="sigma" aria-hidden="true">Σ</span>
                        <TweenedNumber value={p.total} />
                    </span>
                </div>
            {/each}
        </section>

        <!-- Same order as on the host: one section per category -->
        {#each categories as c, ci (c)}
            {@const placement = isPlacementCategory(c, options)}
            {@const enteredCount = mine.filter((p) => view.filled[p.id]?.includes(c)).length}
            <section
                class="cat-section"
                class:now={c === atTable}
                style="--c: {CATEGORY_COLORS[c]}"
                bind:this={sections[c]}
                in:swoop={{ y: 18, delay: 40 * ci + 60, duration: 340 }}
            >
                <h3 class="section-title">
                    <span class="cat-icon"><CategoryIcon category={c} size={22} /></span>
                    <span class="section-name">{$t(c)}</span>
                    {#if c === atTable}
                        <span class="now-badge">{$t("guestNow")}</span>
                    {:else if !placement && enteredCount === mine.length}
                        <span class="tick" title={$t("hostFilled")} in:pop={{ duration: 320 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                            <span class="visually-hidden">{$t("hostFilled")}</span>
                        </span>
                    {/if}
                </h3>

                {#if c === "round_goals" && placement}
                    {#if mine.length > 1}
                        <div class="avatars" role="radiogroup" aria-label={$t("selectPlayerPlace")}>
                            {#each mine as p (p.id)}
                                <button class="avatar" class:selected={roundActive === p.id} role="radio" aria-checked={roundActive === p.id} onclick={() => (roundPick = p.id)}>
                                    <Egg color={p.color} size={20} speckled={false} />
                                    <span>{p.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                    {#if roundActivePlayer}
                        <p class="instruction">{$t("tapGrid")} <strong style="--c: {roundActivePlayer.color}">{roundActivePlayer.name}</strong></p>
                    {/if}
                    <RoundGoalGrid activePlayerId={roundActive} />
                {:else if c === "nectar"}
                    {#if mine.length > 1}
                        <div class="avatars" role="radiogroup" aria-label={$t("selectPlayerPlace")}>
                            {#each mine as p (p.id)}
                                <button class="avatar" class:selected={nectarActive === p.id} role="radio" aria-checked={nectarActive === p.id} onclick={() => (nectarPick = p.id)}>
                                    <Egg color={p.color} size={20} speckled={false} />
                                    <span>{p.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                    {#if nectarActivePlayer}
                        <p class="instruction">{$t("tapGrid")} <strong style="--c: {nectarActivePlayer.color}">{nectarActivePlayer.name}</strong></p>
                    {/if}
                    <NectarGoalGrid activePlayerId={nectarActive} />
                {:else}
                    <ul class="rows">
                        {#each mine as p (p.id)}
                            {@const k = key(p.id, c)}
                            {@const value = p.scores[c] ?? 0}
                            {@const entered = !!view.filled[p.id]?.includes(c)}
                            {@const signed = isSigned(c)}
                            {@const max = maxFor(c)}
                            <li class="row" class:entered>
                                <span class="cat">
                                    <Egg color={p.color} size={22} speckled={false} />
                                    <span class="cat-name">{p.name}</span>
                                    {#if entered}
                                        <span class="tick" title={$t("hostFilled")} in:pop={{ duration: 320 }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                            <span class="visually-hidden">{$t("hostFilled")}</span>
                                        </span>
                                    {/if}
                                </span>
                                <span class="stepper">
                                    {#if signed}
                                        <button class="step sign" onclick={() => toggleSign(p, c)} aria-label={$t("toggleSign", { name: p.name })}>±</button>
                                    {/if}
                                    <button
                                        class="step"
                                        onclick={() => step(p, c, -1)}
                                        disabled={!signed && value <= 0}
                                        aria-label="{$t(c)}: {$t('minusOne', { name: p.name })}"
                                    >−</button>
                                    <input
                                        bind:this={inputs[k]}
                                        use:syncValue={value}
                                        class:negative={value < 0}
                                        type="number"
                                        inputmode={signed ? "text" : "numeric"}
                                        enterkeyhint="next"
                                        min={signed ? undefined : 0}
                                        {max}
                                        aria-label="{$t(c)}: {$t('pointsFor', { name: p.name })}"
                                        oninput={(e) => {
                                            const raw = e.currentTarget.value;
                                            if (raw === "" || raw === "-") return;
                                            setScore(p, c, Number(raw));
                                        }}
                                        onchange={(e) => setScore(p, c, Number(e.currentTarget.value) || 0)}
                                        onblur={(e) => (e.currentTarget.value = String(current(p, c)))}
                                        onkeydown={(e) => onKeydown(e, c, k)}
                                        onfocus={(e) => e.currentTarget.select()}
                                        placeholder="0"
                                    />
                                    <button
                                        class="step"
                                        onclick={() => step(p, c, 1)}
                                        disabled={max !== undefined && value >= max}
                                        aria-label="{$t(c)}: {$t('plusOne', { name: p.name })}"
                                    >+</button>
                                    <button
                                        bind:this={qsButtons[k]}
                                        class="step quick-sum"
                                        onclick={() => (qs = { playerId: p.id, category: c })}
                                        aria-label={$t("quickSumFor", { category: $t(c), name: p.name })}
                                        aria-haspopup="dialog"
                                        title={$t("quickSum")}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="4" y="2.5" width="16" height="19" rx="3.5" />
                                            <rect x="7.5" y="5.5" width="9" height="4" rx="1" />
                                            <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17.5h.01M12 17.5h.01M16 13.5v4" stroke-width="2.8" />
                                        </svg>
                                    </button>
                                </span>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </section>
        {/each}
    {/if}
</div>

{#if qs && qsPlayer}
    {#key qs.category}
        <QuickSumSheet
            player={qsPlayer}
            initial={current(qsPlayer, qs.category)}
            category={qs.category}
            nextName={qsNext?.name}
            onapply={applyQuickSum}
            oncancel={() => closeQuickSum()}
        />
    {/key}
{/if}

<style>
    .guest-scoring {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .intro h2 {
        font-size: 1.6rem;
    }

    .hint {
        font-family: var(--font-hand);
        font-size: 1.25rem;
        line-height: 1.1;
        color: var(--ink-soft);
    }

    .at-table {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding: 3px 12px 3px 8px;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--ink-soft);
        background: rgba(110, 80, 50, 0.07);
    }

    /* ---------- Picker ---------- */
    .picker-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 6px 12px;
        border-radius: 999px;
        color: var(--ink-soft);
        background: var(--card);
        border: 1.5px solid var(--line);
    }

    .mini-eggs {
        display: inline-flex;
        gap: 1px;
    }

    .chev {
        transition: transform 0.3s var(--spring);
    }

    .chev.open {
        transform: rotate(180deg);
    }

    .picker-wrap .label-hand {
        margin-bottom: 8px;
    }

    .picker-body {
        padding-top: 10px;
    }

    .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 18px 14px;
        border: 2px dashed var(--line);
        border-radius: var(--radius-md);
        text-align: center;
    }

    .empty .hand {
        font-size: 1.4rem;
        color: var(--ink-soft);
    }

    /* ---------- My players at a glance ---------- */
    .totals {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .total-chip {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: var(--card);
        border: 1.5px solid var(--line);
        border-left: 5px solid var(--pc);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
    }

    /* ---------- One section per category (same order as the host) ---------- */
    .cat-section {
        background: var(--card);
        border: 1.5px solid var(--line);
        border-top: 5px solid var(--c);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
        padding: 10px 10px 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        scroll-margin-top: 12px;
        transition: box-shadow 0.25s ease, transform 0.25s ease;
    }

    .cat-section.now {
        box-shadow:
            0 0 0 3px color-mix(in srgb, var(--c) 45%, transparent),
            var(--shadow-md);
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 1.15rem;
    }

    .section-name {
        flex: 1;
        min-width: 0;
    }

    .now-badge {
        flex-shrink: 0;
        padding: 2px 10px;
        border-radius: 999px;
        font-family: var(--font-hand);
        font-size: 1rem;
        color: var(--ink);
        background: color-mix(in srgb, var(--c) 22%, #fffaf0);
        animation: nudge-badge 1.6s ease-in-out infinite;
    }

    @keyframes nudge-badge {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-2px);
        }
    }

    .pwho {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .pname {
        font-size: 1.25rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .progress {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--ink-soft);
    }

    .ptotal {
        display: flex;
        align-items: baseline;
        gap: 3px;
        font-family: var(--font-display);
        font-size: 1.9rem;
        font-weight: 600;
        line-height: 1;
        color: var(--forest-deep);
    }

    .sigma {
        font-size: 1rem;
        color: var(--ink-soft);
    }

    .rows {
        list-style: none;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        padding: 7px 2px;
        border-bottom: 1px solid rgba(110, 80, 50, 0.1);
    }

    .row:last-child {
        border-bottom: none;
    }

    .cat {
        flex: 1 1 90px;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .cat-icon {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 46% 54% / 55% 45% 55% 45%;
        background: color-mix(in srgb, var(--c) 18%, #fffaf0);
    }

    .cat-name {
        min-width: 0;
        font-weight: 800;
        font-size: 0.92rem;
        line-height: 1.15;
        hyphens: auto;
        overflow-wrap: break-word;
    }

    .tick {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        color: #fff;
        background: var(--forest);
    }

    .stepper {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
    }

    .step {
        width: 34px;
        height: 44px;
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

    .step.quick-sum {
        width: 44px;
        margin-left: 2px;
        color: color-mix(in srgb, var(--c) 70%, var(--ink));
        background: color-mix(in srgb, var(--c) 14%, var(--card));
        border-color: color-mix(in srgb, var(--c) 45%, transparent);
        box-shadow: 0 2px 0 color-mix(in srgb, var(--c) 35%, transparent);
    }

    .stepper input {
        width: 50px;
        height: 44px;
        text-align: center;
        font-family: var(--font-display);
        font-size: 1.3rem;
        font-weight: 600;
        border: 2px solid var(--line);
        border-radius: 12px;
        background: #fff;
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .row.entered .stepper input {
        border-color: color-mix(in srgb, var(--forest) 40%, var(--line));
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
    .avatars {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .avatar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        padding: 4px 14px 4px 10px;
        border-radius: 999px;
        border: 2px solid var(--line);
        background: #fff;
        font-size: 0.92rem;
    }

    .avatar.selected {
        border-color: var(--forest);
        background: #e3f1ec;
        box-shadow: 0 3px 0 var(--forest);
        transform: translateY(-2px);
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
</style>
