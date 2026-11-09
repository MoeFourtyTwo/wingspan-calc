<script lang="ts">
    import { onMount, tick } from "svelte";
    import { cubicOut, backOut } from "svelte/easing";
    import type { TransitionConfig } from "svelte/transition";
    import { language, t, type TranslationKey } from "../i18n";
    import { gameStore } from "../store";
    import Bird from "../ui/Bird.svelte";
    import Binoculars from "../ui/Binoculars.svelte";
    import { ms, swoop } from "../ui/motion";
    import BirdPanel from "./BirdPanel.svelte";
    import CardPanel from "./CardPanel.svelte";
    import { checkerPrefs, resolvePrefs, setsFromOptions } from "./prefs";
    import { SET_CHIPS, chipOf, inSets, toggleChip, type SetChip } from "./search";
    import { DATA_PROJECT_URL, checkerData, loadCheckerData } from "./source";
    import type { Bird as BirdT, BonusCard, Lang } from "./types";
    import "./checker.css";

    let { onclose }: { onclose: () => void } = $props();

    type Tab = "card" | "bird";
    interface View {
        tab: Tab;
        cardId: number | null;
        birdId: number | null;
    }

    let tab: Tab = $state("card");
    let cardId: number | null = $state(null);
    let birdId: number | null = $state(null);
    /** Where cross-links (card → bird → card …) came from, for "Back". */
    let trail: View[] = $state([]);
    let cardQuery = $state("");
    let cardBirdQuery = $state("");
    let birdQuery = $state("");
    let settingsOpen = $state(false);

    let settings = $derived(resolvePrefs($checkerPrefs, $language, $gameStore.options));
    let edition = $derived(settings.edition);
    let sets = $derived(settings.sets);

    let load = $derived($checkerData);
    let data = $derived(load.status === "ready" ? load.data : null);
    let birds = $derived(data ? data.birds.filter((b) => inSets(b.set, sets)) : []);
    let cards = $derived(data ? data.bonusCards.filter((c) => inSets(c.set, sets)) : []);
    let card = $derived(cardId === null ? null : (cards.find((c) => c.id === cardId) ?? null));
    let bird = $derived(birdId === null ? null : (birds.find((b) => b.id === birdId) ?? null));

    let backLabel = $derived(
        trail.length ? $t("back") : tab === "card" ? $t("chkBackToCards") : $t("chkBackToBirds"),
    );

    let sheetEl: HTMLDivElement | undefined = $state();
    let scroller: HTMLDivElement | undefined = $state();
    const listScroll: Record<Tab, number> = { card: 0, bird: 0 };
    const EDITIONS: Lang[] = ["de", "en"];

    function setLabel(set: string): string {
        const chip = chipOf(set);
        return chip === "promo" ? "Promo" : $t(`set_${chip}` as TranslationKey);
    }

    function chipLabel(chip: SetChip): string {
        return chip === "promo" ? $t("chkSetPromo") : $t(`set_${chip}` as TranslationKey);
    }

    // ---- navigation ------------------------------------------------------
    async function scrollTo(top: number) {
        await tick();
        scroller?.scrollTo({ top });
    }

    /** Scroll so the tabs stay at the top while the detail starts right below them. */
    function toDetail() {
        scrollTo(0);
    }

    function selectCard(c: BonusCard) {
        listScroll.card = scroller?.scrollTop ?? 0;
        trail = [];
        cardBirdQuery = "";
        cardId = c.id;
        toDetail();
    }

    function selectBird(b: BirdT) {
        listScroll.bird = scroller?.scrollTop ?? 0;
        trail = [];
        birdId = b.id;
        toDetail();
    }

    function crossToBird(b: BirdT) {
        trail = [...trail, { tab, cardId, birdId }];
        tab = "bird";
        birdId = b.id;
        toDetail();
    }

    function crossToCard(c: BonusCard) {
        trail = [...trail, { tab, cardId, birdId }];
        tab = "card";
        if (cardId !== c.id) cardBirdQuery = "";
        cardId = c.id;
        toDetail();
    }

    function back() {
        const prev = trail.at(-1);
        if (prev) {
            trail = trail.slice(0, -1);
            ({ tab, cardId, birdId } = prev);
            toDetail();
            return;
        }
        if (tab === "card") cardId = null;
        else birdId = null;
        scrollTo(listScroll[tab]);
    }

    function selectTab(next: Tab, focus = false) {
        if (next === tab) return;
        trail = [];
        tab = next;
        scrollTo(0);
        if (focus) tick().then(() => document.getElementById(`chk-tab-${next}`)?.focus());
    }

    function onTabKey(e: KeyboardEvent) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
            e.preventDefault();
            selectTab(e.key === "ArrowLeft" || e.key === "Home" ? "card" : "bird", true);
        }
    }

    // ---- settings --------------------------------------------------------
    function setEdition(lang: Lang) {
        checkerPrefs.update((p) => ({ ...p, edition: lang }));
    }

    function toggleSet(chip: SetChip) {
        checkerPrefs.update((p) => ({ ...p, sets: toggleChip(sets, chip) }));
    }

    // ---- lifecycle, focus, keyboard -------------------------------------
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return { destroy: () => node.remove() };
    }

    onMount(() => {
        const opener = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        sheetEl?.focus({ preventScroll: true });
        // First use: pre-select the expansions of the current game.
        if ($checkerPrefs.sets === null) {
            checkerPrefs.update((p) => ({ ...p, sets: setsFromOptions($gameStore.options) }));
        }
        loadCheckerData();
        return () => {
            document.body.style.overflow = prevOverflow;
            opener?.focus?.({ preventScroll: true });
        };
    });

    function retry() {
        loadCheckerData();
    }

    function focusables(): HTMLElement[] {
        if (!sheetEl) return [];
        return [
            ...sheetEl.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input, a[href], summary, [tabindex="0"]',
            ),
        ].filter((el) => el.offsetParent !== null || el === document.activeElement);
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onclose();
            return;
        }
        if (e.key === "Tab") {
            const els = focusables();
            if (els.length === 0) return;
            const first = els[0];
            const last = els[els.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === sheetEl)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    // ---- motion ----------------------------------------------------------
    function rise(_node: Element): TransitionConfig {
        return {
            duration: ms(420),
            easing: backOut,
            css: (t, u) => `transform: translateY(${u * 60}px) scale(${0.96 + 0.04 * t}); opacity: ${Math.min(1, t * 2.5)};`,
        };
    }

    function sink(_node: Element): TransitionConfig {
        return {
            duration: ms(200),
            easing: cubicOut,
            css: (t, u) => `transform: translateY(${u * 40}px); opacity: ${t};`,
        };
    }

    function fade(_node: Element, { duration = 220 }: { duration?: number } = {}): TransitionConfig {
        return { duration: ms(duration), css: (t) => `opacity: ${t};` };
    }
</script>

<div class="chk-root" use:portal>
    <div class="backdrop" in:fade out:fade={{ duration: 160 }} aria-hidden="true"></div>

    <div
        bind:this={sheetEl}
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chk-title"
        tabindex="-1"
        onkeydown={onKeydown}
        in:rise
        out:sink
    >
        <header class="top">
            <span class="logo" aria-hidden="true"><Binoculars size={26} /></span>
            <div class="titles">
                <h2 id="chk-title">{$t("chkTitle")}</h2>
                <p class="subtitle">{$t("chkSubtitle")}</p>
            </div>
            <button class="icon-btn close" onclick={onclose} aria-label={$t("chkClose")}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
        </header>

        <div class="scroller" bind:this={scroller}>
            {#if load.status === "ready"}
                <div class="sticky">
                    <div class="tabs" role="tablist" aria-label={$t("chkTabs")}>
                        <button
                            id="chk-tab-card"
                            role="tab"
                            aria-selected={tab === "card"}
                            aria-controls="chk-panel"
                            tabindex={tab === "card" ? 0 : -1}
                            class:active={tab === "card"}
                            onclick={() => selectTab("card")}
                            onkeydown={onTabKey}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" stroke-linecap="round" /></svg>
                            {$t("chkTabCard")}
                        </button>
                        <button
                            id="chk-tab-bird"
                            role="tab"
                            aria-selected={tab === "bird"}
                            aria-controls="chk-panel"
                            tabindex={tab === "bird" ? 0 : -1}
                            class:active={tab === "bird"}
                            onclick={() => selectTab("bird")}
                            onkeydown={onTabKey}
                        >
                            <Bird size={22} color={tab === "bird" ? "#2f7d6d" : "#8d8b80"} breast={tab === "bird" ? "#e9925a" : "#c9c4b4"} />
                            {$t("chkTabBird")}
                        </button>
                        <span class="underline" class:right={tab === "bird"} aria-hidden="true"></span>
                    </div>
                </div>

                <div class="settings" class:open={settingsOpen}>
                    <button
                        class="settings-toggle"
                        aria-expanded={settingsOpen}
                        aria-controls="chk-settings"
                        onclick={() => (settingsOpen = !settingsOpen)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></svg>
                        <span class="s-label">{$t("chkSettings")}</span>
                        <span class="s-summary">
                            {$t("chkSettingsSummary", { edition: $t(`chkEditionName_${edition}`), n: sets.length })}
                        </span>
                        <svg class="caret" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {#if settingsOpen}
                        <div id="chk-settings" class="settings-body" in:swoop={{ y: -10, duration: 280, scale: 0.98 }}>
                            <div class="field">
                                <span class="field-label" id="chk-edition-label">{$t("chkEdition")}</span>
                                <div class="seg" role="group" aria-labelledby="chk-edition-label">
                                    {#each EDITIONS as lang (lang)}
                                        <button class:on={edition === lang} aria-pressed={edition === lang} onclick={() => setEdition(lang)}>
                                            {$t(lang === "de" ? "chkEditionDe" : "chkEditionEn")}
                                        </button>
                                    {/each}
                                </div>
                                <p class="field-hint">{$t("chkEditionHint")}</p>
                            </div>
                            <div class="field">
                                <span class="field-label" id="chk-sets-label">{$t("chkSets")}</span>
                                <div class="chips" role="group" aria-labelledby="chk-sets-label">
                                    {#each SET_CHIPS as chip (chip)}
                                        <button
                                            class="chip set-{chip}"
                                            class:on={sets.includes(chip)}
                                            aria-pressed={sets.includes(chip)}
                                            onclick={() => toggleSet(chip)}
                                        >
                                            {#if sets.includes(chip)}
                                                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                            {/if}
                                            {chipLabel(chip)}
                                        </button>
                                    {/each}
                                </div>
                                <p class="field-hint">{$t("chkSetsHint")}</p>
                            </div>
                        </div>
                    {/if}
                </div>

                <div id="chk-panel" role="tabpanel" aria-labelledby="chk-tab-{tab}" class="panel">
                    {#if tab === "card"}
                        <CardPanel
                            {cards}
                            {birds}
                            {edition}
                            {card}
                            bind:query={cardQuery}
                            bind:birdQuery={cardBirdQuery}
                            {backLabel}
                            {setLabel}
                            onselect={selectCard}
                            onbird={crossToBird}
                            onback={back}
                        />
                    {:else}
                        <BirdPanel
                            {birds}
                            {cards}
                            {edition}
                            {bird}
                            bind:query={birdQuery}
                            {backLabel}
                            {setLabel}
                            onselect={selectBird}
                            oncard={crossToCard}
                            onback={back}
                        />
                    {/if}
                </div>
            {:else if load.status === "error"}
                <div class="state error" role="alert" in:swoop={{ y: 16, duration: 360 }}>
                    <div class="sad-bird"><Bird size={84} color="#8d8b80" breast="#c9c4b4" facing={-1} /></div>
                    <h3>{$t("chkErrorTitle")}</h3>
                    <p>{$t("chkErrorHint")}</p>
                    <p class="tech">{load.message}</p>
                    <button class="btn-primary retry" onclick={retry}>
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
                        {$t("chkRetry")}
                    </button>
                </div>
            {:else}
                <div class="state loading" role="status" in:fade>
                    <div class="sky" aria-hidden="true">
                        <span class="cloud c1"></span>
                        <span class="cloud c2"></span>
                        <span class="flyer"><Bird size={70} flapping /></span>
                    </div>
                    <h3>{$t("chkLoading")}</h3>
                    <p>{$t("chkLoadingHint")}</p>
                </div>
            {/if}

            <footer class="credits">
                <p>
                    {$t("chkAttribution")}
                    <a href={DATA_PROJECT_URL} target="_blank" rel="noopener noreferrer">{$t("chkAttributionLink")}</a>
                </p>
                <p>{$t("chkUnofficial")}</p>
                {#if load.status === "ready" && load.fromCache}
                    <p class="cached">{$t("chkOffline")}</p>
                {/if}
            </footer>
        </div>
    </div>
</div>

<style>
    .chk-root {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        justify-content: center;
    }

    .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(40, 32, 20, 0.45);
    }

    .sheet {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 600px;
        height: 100%;
        background-color: var(--paper);
        background-image:
            radial-gradient(ellipse at 15% 0%, rgba(255, 255, 255, 0.7), transparent 45%),
            repeating-linear-gradient(0deg, rgba(110, 80, 50, 0.035) 0 1px, transparent 1px 28px),
            repeating-linear-gradient(90deg, rgba(110, 80, 50, 0.025) 0 1px, transparent 1px 28px);
        box-shadow: var(--shadow-lg);
        outline: none;
    }

    @media (min-width: 640px) {
        .sheet {
            height: calc(100% - 24px);
            margin-top: 24px;
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
            overflow: hidden;
        }
    }

    .top {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
        padding: max(10px, env(safe-area-inset-top)) 10px 10px 16px;
        border-bottom: 2px dashed var(--line);
    }

    .logo {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        color: #fff;
        background: var(--forest);
        box-shadow: 0 3px 0 var(--forest-deep);
        --lens: rgba(255, 255, 255, 0.25);
        animation: peek 2.8s ease-in-out infinite;
    }

    @keyframes peek {
        0%,
        70%,
        100% {
            transform: rotate(0);
        }
        78% {
            transform: rotate(-10deg) translateX(-1px);
        }
        88% {
            transform: rotate(8deg) translateX(1px);
        }
    }

    .titles {
        min-width: 0;
    }

    h2 {
        font-size: 1.3rem;
        color: var(--forest-deep);
    }

    .subtitle {
        font-family: var(--font-hand);
        font-size: 1.1rem;
        line-height: 1;
        color: var(--twig);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .scroller {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        padding: 0 16px max(20px, env(safe-area-inset-bottom));
        -webkit-overflow-scrolling: touch;
    }

    /* ---- tabs ---- */
    .sticky {
        position: sticky;
        top: 0;
        z-index: 3;
        margin: 0 -16px;
        padding: 8px 16px 0;
        background: var(--paper);
        box-shadow: 0 8px 10px -10px rgba(60, 40, 20, 0.35);
    }

    .tabs {
        position: relative;
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .tabs button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 48px;
        padding: 6px 4px 10px;
        font-family: var(--font-display);
        font-size: 1rem;
        font-weight: 600;
        color: var(--ink-soft);
        border-radius: 12px 12px 0 0;
    }

    .tabs button.active {
        color: var(--forest-deep);
    }

    .tabs button:active {
        transform: scale(0.95);
    }

    .tabs button :global(.bird) {
        filter: none;
    }

    .underline {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 50%;
        height: 4px;
        border-radius: 4px;
        background: var(--forest);
        transform: translateX(0) scaleX(0.7);
        transition: transform 0.45s var(--spring);
    }

    .underline.right {
        transform: translateX(100%) scaleX(0.7);
    }

    /* ---- settings ---- */
    .settings {
        margin: 12px 0 14px;
        border-radius: var(--radius-md);
        border: 1.5px dashed var(--line);
        background: rgba(255, 250, 240, 0.6);
    }

    .settings-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 44px;
        padding: 6px 12px;
        text-align: left;
        color: var(--ink-soft);
        border-radius: var(--radius-md);
    }

    .s-label {
        flex: none;
        color: var(--ink);
    }

    @media (max-width: 400px) {
        .s-label {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
        }
    }

    .s-summary {
        flex: 1;
        min-width: 0;
        font-size: 0.85rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .caret {
        flex: none;
        transition: transform 0.3s var(--spring);
    }

    .open .caret {
        transform: rotate(180deg);
    }

    .settings-body {
        display: grid;
        gap: 14px;
        padding: 4px 12px 14px;
    }

    .field-label {
        display: block;
        margin-bottom: 6px;
        font-family: var(--font-display);
        font-weight: 600;
    }

    .field-hint {
        margin-top: 6px;
        font-size: 0.82rem;
        color: var(--ink-soft);
    }

    .seg {
        display: inline-grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        padding: 3px;
        border-radius: 999px;
        background: rgba(110, 80, 50, 0.1);
    }

    .seg button {
        min-height: 40px;
        padding: 4px 16px;
        border-radius: 999px;
        color: var(--ink-soft);
    }

    .seg button.on {
        background: var(--card);
        color: var(--forest-deep);
        box-shadow: 0 2px 0 rgba(110, 80, 50, 0.18);
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 44px;
        padding: 6px 14px;
        border-radius: 999px;
        border: 2px solid var(--line);
        background: var(--card);
        color: var(--ink-soft);
        font-size: 0.92rem;
    }

    .chip.on {
        border-color: var(--forest);
        background: rgba(47, 125, 109, 0.12);
        color: var(--forest-deep);
        animation: chip-pop 0.35s var(--spring);
    }

    .chip:active {
        transform: scale(0.92);
    }

    @keyframes chip-pop {
        50% {
            transform: scale(1.08);
        }
    }

    .panel {
        min-height: 40vh;
    }

    /* ---- loading / error ---- */
    .state {
        display: grid;
        justify-items: center;
        gap: 6px;
        padding: 40px 8px 30px;
        text-align: center;
    }

    .state h3 {
        font-size: 1.25rem;
        color: var(--forest-deep);
    }

    .state p {
        color: var(--ink-soft);
        max-width: 32ch;
    }

    .sky {
        position: relative;
        width: 220px;
        height: 120px;
        margin-bottom: 6px;
    }

    .flyer {
        position: absolute;
        left: 75px;
        top: 30px;
        animation: glide 1.6s ease-in-out infinite;
    }

    @keyframes glide {
        0%,
        100% {
            transform: translate(-30px, 6px) rotate(-4deg);
        }
        50% {
            transform: translate(30px, -10px) rotate(5deg);
        }
    }

    .cloud {
        position: absolute;
        height: 22px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 2px 0 rgba(110, 80, 50, 0.08);
        animation: drift 3.2s linear infinite;
    }

    .c1 {
        width: 70px;
        top: 10px;
        left: 140px;
    }

    .c2 {
        width: 50px;
        top: 86px;
        left: 10px;
        animation-delay: -1.6s;
    }

    @keyframes drift {
        from {
            transform: translateX(30px);
            opacity: 0;
        }
        20%,
        80% {
            opacity: 1;
        }
        to {
            transform: translateX(-60px);
            opacity: 0;
        }
    }

    .sad-bird {
        margin-bottom: 4px;
        animation: wobble 2.4s ease-in-out infinite;
    }

    .tech {
        font-size: 0.75rem;
        font-family: ui-monospace, monospace;
        opacity: 0.7;
        overflow-wrap: anywhere;
    }

    .retry {
        width: auto;
        margin-top: 12px;
    }

    /* ---- credits ---- */
    .credits {
        margin-top: 26px;
        padding-top: 12px;
        border-top: 2px dashed var(--line);
        font-size: 0.8rem;
        color: var(--ink-soft);
        text-align: center;
    }

    .credits a {
        color: var(--wetland-deep);
        font-weight: 700;
    }

    .cached {
        margin-top: 2px;
        opacity: 0.8;
    }

    @media (prefers-reduced-motion: reduce) {
        .flyer,
        .cloud,
        .logo,
        .sad-bird {
            animation: none;
        }
    }
</style>
