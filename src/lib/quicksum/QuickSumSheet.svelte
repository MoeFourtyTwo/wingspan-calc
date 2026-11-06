<script lang="ts">
    import { onMount, tick, untrack } from "svelte";
    import { flip } from "svelte/animate";
    import { backOut, cubicOut } from "svelte/easing";
    import type { TransitionConfig } from "svelte/transition";
    import type { Category } from "../rules/scoring";
    import { t, type TranslationKey } from "../i18n";
    import Egg from "../ui/Egg.svelte";
    import CategoryIcon, { CATEGORY_COLORS } from "../ui/CategoryIcon.svelte";
    import TweenedNumber from "../ui/TweenedNumber.svelte";
    import { ms, poof, reducedMotion, swoop } from "../ui/motion";
    import {
        addTerm,
        canUndo,
        chipsFor,
        clearTally,
        count,
        createTally,
        removeTerm,
        sum,
        undo,
        unitFor,
        type Tally,
    } from "./tally";

    interface Props {
        player: { id: string; name: string; color: string };
        /** The player's current value in this category; seeds the tally. */
        initial: number;
        category: Category;
        /** Name of the player after this one, if any ("Apply & next"). */
        nextName?: string;
        onapply: (total: number, goNext: boolean) => void;
        oncancel: () => void;
    }

    let { player, initial, category, nextName, onapply, oncancel }: Props = $props();

    let tally: Tally = $state(untrack(() => createTally(initial)));
    // Re-seed when the sheet moves on to the next player.
    let seededFor = untrack(() => player.id);
    $effect.pre(() => {
        if (player.id !== seededFor) {
            seededFor = player.id;
            tally = createTally(untrack(() => initial));
            lastChip = null;
            untrack(() => tick().then(() => dialogEl?.focus({ preventScroll: true })));
        }
    });

    let chips = $derived(chipsFor(category));
    let cols = $derived(chips.length <= 6 ? chips.length : 5);
    let total = $derived(sum(tally));
    let n = $derived(count(tally));
    let countLabel = $derived(
        $t(`qsUnit_${unitFor(category)}${n === 1 ? "_one" : ""}` as TranslationKey, { n }),
    );
    let accent = $derived(CATEGORY_COLORS[category]);
    let hasSeed = $derived(tally.terms.some((x) => x.seed));

    let dialogEl: HTMLDivElement | undefined = $state();
    let exprEl: HTMLDivElement | undefined = $state();
    const titleId = `qs-title-${Math.random().toString(36).slice(2, 8)}`;

    const fmt = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));

    // ---- Actions ---------------------------------------------------------
    let lastChip: DOMRect | null = null;

    function add(value: number, el?: HTMLElement) {
        lastChip = el?.getBoundingClientRect() ?? null;
        tally = addTerm(tally, value);
        if (el && !reducedMotion()) {
            el.animate(
                [
                    { transform: "scale(1)" },
                    { transform: "scale(0.82) rotate(-4deg)", offset: 0.35 },
                    { transform: "scale(1.08) rotate(2deg)", offset: 0.7 },
                    { transform: "scale(1)" },
                ],
                { duration: 300, easing: "ease-out" },
            );
        }
        tick().then(() => exprEl?.scrollTo({ top: exprEl.scrollHeight, behavior: reducedMotion() ? "auto" : "smooth" }));
    }

    function remove(id: number) {
        lastChip = null;
        tally = removeTerm(tally, id);
    }

    function doUndo() {
        lastChip = null;
        tally = undo(tally);
    }

    function doClear() {
        lastChip = null;
        tally = clearTally(tally);
    }

    // ---- Motion ----------------------------------------------------------
    /** New terms fly from the tapped chip into their place in the expression. */
    function flyIn(node: Element): TransitionConfig {
        const from = lastChip;
        if (!from) return pop(node);
        const to = node.getBoundingClientRect();
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        return {
            duration: ms(380),
            easing: backOut,
            css: (t, u) =>
                `transform: translate(${u * dx}px, ${u * dy}px) scale(${1.5 - 0.5 * t}) rotate(${u * -12}deg);` +
                `opacity: ${Math.min(1, 0.4 + t)};`,
        };
    }

    function pop(_node: Element): TransitionConfig {
        return {
            duration: ms(260),
            easing: backOut,
            css: (t) => `transform: scale(${0.4 + 0.6 * t}); opacity: ${t};`,
        };
    }

    /** Bottom sheet slides up with a little springy overshoot. */
    function rise(_node: Element): TransitionConfig {
        return {
            duration: ms(380),
            easing: backOut,
            css: (_t, u) => `transform: translateY(${u * 100}%);`,
        };
    }

    function sink(_node: Element): TransitionConfig {
        return {
            duration: ms(220),
            easing: cubicOut,
            css: (_t, u) => `transform: translateY(${u * 100}%);`,
        };
    }

    function fade(_node: Element, { duration = 220 }: { duration?: number } = {}): TransitionConfig {
        return { duration: ms(duration), css: (t) => `opacity: ${t};` };
    }

    // ---- Portal, focus, keyboard ----------------------------------------
    /** Render at <body> level so ancestor transforms can't break `position: fixed`. */
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return { destroy: () => node.remove() };
    }

    onMount(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialogEl?.focus({ preventScroll: true });
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    });

    function focusables(): HTMLElement[] {
        if (!dialogEl) return [];
        return [...dialogEl.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            oncancel();
            return;
        }
        if (e.key === "Tab") {
            // Focus trap.
            const els = focusables();
            if (els.length === 0) return;
            const first = els[0];
            const last = els[els.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === dialogEl)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Backspace") {
            e.preventDefault();
            doUndo();
        } else if (e.key === "Enter" && e.target === dialogEl) {
            e.preventDefault();
            onapply(total, false);
        } else if (/^\d$/.test(e.key)) {
            // Keyboard shortcut for the chips; "0" doubles as 10 when there is no 0 chip.
            let v = Number(e.key);
            if (v === 0 && !chips.includes(0) && chips.includes(10)) v = 10;
            if (chips.includes(v)) {
                e.preventDefault();
                const chipEl = dialogEl?.querySelector<HTMLElement>(`[data-chip="${v}"]`) ?? undefined;
                add(v, chipEl);
            }
        }
    }
</script>

<div class="qs-root" use:portal>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape handled on the dialog) -->
    <div class="backdrop" onclick={oncancel} in:fade out:fade={{ duration: 180 }}></div>

    <div
        bind:this={dialogEl}
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabindex="-1"
        onkeydown={onKeydown}
        style="--accent: {accent}"
        in:rise
        out:sink
    >
        <div class="grabber" aria-hidden="true"></div>

        {#key player.id}
            <header class="head" in:swoop={{ x: 60, y: 0, rotate: 3, duration: 360 }}>
                <span class="egg"><Egg color={player.color} size={28} /></span>
                <div class="titles">
                    <h2 id={titleId}>
                        <span class="visually-hidden">{$t("quickSumFor", { category: $t(category), name: player.name })}</span>
                        <span aria-hidden="true">{player.name}</span>
                    </h2>
                    <span class="cat" aria-hidden="true">
                        <CategoryIcon {category} size={18} />
                        {$t(category)} · {$t("quickSum")}
                    </span>
                </div>
                <button class="icon-btn close" onclick={oncancel} aria-label={$t("qsCancel")}>
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </header>
        {/key}

        <div class="board">
            <div class="expr" bind:this={exprEl} role="group" aria-label={$t("qsTerms")}>
                {#each tally.terms as term, i (term.id)}
                    <button
                        class="term"
                        class:seed={term.seed}
                        class:neg={term.value < 0}
                        onclick={() => remove(term.id)}
                        aria-label={$t("qsRemoveTerm", { n: fmt(term.value) })}
                        title={term.seed ? $t("qsSeedHint") : undefined}
                        in:flyIn
                        out:poof={{ duration: 160 }}
                        animate:flip={{ duration: ms(240), easing: cubicOut }}
                    >
                        {#if i > 0}<span class="op" aria-hidden="true">{term.value < 0 ? "−" : "+"}</span>{/if}
                        <span class="val">{i === 0 ? fmt(term.value) : Math.abs(term.value)}</span>
                        {#if term.seed}<span class="seed-tag" aria-hidden="true">{$t("qsSeed")}</span>{/if}
                    </button>
                {:else}
                    <span class="empty hand" in:fade={{ duration: 200 }}>{$t("qsEmpty")}</span>
                {/each}
            </div>
            <div class="sum" aria-live="polite">
                <span class="eq" aria-hidden="true">=</span>
                <span class="visually-hidden">{$t("qsSum")}:</span>
                <span class="sum-num" class:neg={total < 0}><TweenedNumber value={total} duration={320} /></span>
            </div>
        </div>

        <div class="tools">
            <span class="count hand" aria-live="polite">{countLabel}</span>
            <button class="tool" onclick={doUndo} disabled={!canUndo(tally)}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
                {$t("qsUndo")}
            </button>
            <button class="tool" onclick={doClear} disabled={tally.terms.length === 0}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                {$t("qsClear")}
            </button>
        </div>
        {#if hasSeed}
            <p class="seed-hint">{$t("qsSeedHint")}</p>
        {/if}

        <div class="chips" style="--cols: {cols}">
            {#each chips as v, i (v)}
                <button
                    class="chip"
                    class:neg={v < 0}
                    class:zero={v === 0}
                    data-chip={v}
                    onclick={(e) => add(v, e.currentTarget)}
                    aria-label={$t("qsAdd", { n: fmt(v) })}
                    in:swoop={{ y: 18, delay: 120 + 18 * i, duration: 320 }}
                >{v > 0 && chips.some((c) => c < 0) ? `+${v}` : fmt(v)}</button>
            {/each}
        </div>

        <div class="actions" class:has-next={!!nextName}>
            {#if nextName}
                <button class="btn-primary next" onclick={() => onapply(total, true)}>
                    <span class="next-label">{$t("qsApplyNext", { name: nextName })}</span>
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
                </button>
            {/if}
            <button class="btn-secondary" onclick={oncancel}>{$t("qsCancel")}</button>
            <button class={nextName ? "btn-secondary apply" : "btn-primary apply"} onclick={() => onapply(total, false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                {$t("qsApply")}
            </button>
        </div>
    </div>
</div>

<style>
    .qs-root {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
    }

    .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(43, 58, 47, 0.42);
        backdrop-filter: blur(2px);
    }

    .sheet {
        position: relative;
        width: 100%;
        max-width: 600px;
        max-height: calc(100dvh - 24px);
        overflow-y: auto;
        overscroll-behavior: contain;
        background: var(--card);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        border-top: 4px solid color-mix(in srgb, var(--accent) 70%, transparent);
        box-shadow: 0 -10px 30px -12px rgba(43, 40, 20, 0.45);
        padding: 6px 16px calc(14px + env(safe-area-inset-bottom));
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .sheet:focus {
        outline: none;
    }

    .grabber {
        align-self: center;
        width: 44px;
        height: 5px;
        border-radius: 999px;
        background: var(--line);
        margin-bottom: 2px;
    }

    /* ---------- Header ---------- */
    .head {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .egg {
        display: block;
        transform-origin: 50% 90%;
        animation: wobble 0.6s ease 0.2s;
    }

    .titles {
        flex: 1;
        min-width: 0;
    }

    .titles h2 {
        font-size: 1.35rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cat {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--ink-soft);
    }

    .close {
        flex-shrink: 0;
        margin-right: -6px;
    }

    /* ---------- Expression board ---------- */
    .board {
        display: flex;
        align-items: stretch;
        gap: 8px;
        padding: 8px 10px;
        border-radius: var(--radius-md);
        background:
            repeating-linear-gradient(0deg, rgba(110, 80, 50, 0.06) 0 1px, transparent 1px 22px),
            var(--paper);
        border: 1.5px solid var(--line);
        min-height: 84px;
    }

    .expr {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        align-items: center;
        gap: 4px 2px;
        max-height: 120px;
        overflow-y: auto;
        scrollbar-width: thin;
    }

    .term {
        position: relative;
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
        min-height: 36px;
        padding: 2px 6px;
        border-radius: 10px;
        font-family: var(--font-display);
        font-size: 1.45rem;
        font-weight: 600;
        line-height: 1.2;
        color: var(--ink);
    }

    .term:hover {
        background: rgba(194, 85, 74, 0.1);
        text-decoration: line-through;
        text-decoration-color: var(--berry);
    }

    .term:active {
        transform: scale(0.85);
    }

    .term .op {
        color: var(--ink-soft);
        font-size: 1.15rem;
        padding: 0 3px;
    }

    .term.neg .val {
        color: var(--berry);
    }

    .term.seed {
        border: 2px dashed color-mix(in srgb, var(--accent) 60%, transparent);
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        align-items: center;
    }

    .seed-tag {
        margin-left: 3px;
        font-family: var(--font-body);
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-soft);
        white-space: nowrap;
    }

    .empty {
        font-size: 1.3rem;
        color: var(--ink-soft);
        line-height: 1.2;
        padding: 6px 2px;
    }

    .sum {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 4px;
        padding-left: 10px;
        border-left: 2px dashed var(--line);
        font-family: var(--font-display);
        font-weight: 600;
    }

    .eq {
        font-size: 1.4rem;
        color: var(--ink-soft);
    }

    .sum-num {
        min-width: 2ch;
        text-align: right;
        font-size: 2.4rem;
        line-height: 1;
        color: var(--forest-deep);
    }

    .sum-num.neg {
        color: var(--berry);
    }

    /* ---------- Tools ---------- */
    .tools {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .count {
        flex: 1;
        font-size: 1.35rem;
        color: var(--ink-soft);
        line-height: 1;
    }

    .tool {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 44px;
        padding: 6px 12px;
        border-radius: 999px;
        color: var(--ink-soft);
        font-size: 0.92rem;
    }

    .tool:hover:not(:disabled) {
        background: rgba(110, 80, 50, 0.08);
        color: var(--ink);
    }

    .tool:active:not(:disabled) {
        transform: scale(0.9);
    }

    .tool:disabled {
        opacity: 0.35;
    }

    .seed-hint {
        margin-top: -6px;
        font-size: 0.8rem;
        color: var(--ink-soft);
        line-height: 1.3;
    }

    /* ---------- Chips ---------- */
    .chips {
        display: grid;
        grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
        gap: 8px;
    }

    .chip {
        min-height: 56px;
        border-radius: 18px;
        background: #fff;
        border: 2px solid color-mix(in srgb, var(--accent) 45%, var(--line));
        box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 40%, rgba(110, 80, 50, 0.25));
        font-family: var(--font-display);
        font-size: 1.6rem;
        font-weight: 600;
        color: var(--ink);
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
    }

    .chip:hover {
        background: color-mix(in srgb, var(--accent) 10%, #fff);
    }

    .chip:active {
        transform: translateY(3px);
        box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 40%, rgba(110, 80, 50, 0.25));
        transition-duration: 0.06s;
    }

    .chip.zero {
        color: var(--ink-soft);
    }

    .chip.neg {
        color: var(--berry);
        background: #fff6f3;
        border-color: rgba(194, 85, 74, 0.35);
    }

    /* ---------- Actions ---------- */
    .actions {
        display: grid;
        grid-template-columns: 1fr 1.6fr;
        gap: 8px;
        margin-top: 4px;
    }

    .actions .btn-secondary {
        min-height: 52px;
        font-size: 1rem;
    }

    .actions.has-next .apply {
        grid-column: 2;
    }

    .actions .next {
        grid-column: 1 / -1;
        margin-bottom: 4px;
    }

    .actions .next {
        font-size: 1.08rem;
    }

    .next-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
