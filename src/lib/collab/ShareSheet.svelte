<script lang="ts">
    import { onMount } from "svelte";
    import { backOut, cubicOut } from "svelte/easing";
    import type { TransitionConfig } from "svelte/transition";
    import { renderSVG } from "uqr";
    import { gameStore } from "../store";
    import { t } from "../i18n";
    import Egg from "../ui/Egg.svelte";
    import Bird from "../ui/Bird.svelte";
    import { ms, pop, swoop } from "../ui/motion";
    import { hosting } from "./session";
    import { joinUrl } from "./protocol";
    import { endSharing, host, hostError, hostView } from "./ui";

    interface Props {
        onclose: () => void;
    }

    let { onclose }: Props = $props();

    let view = $derived($hostView);
    let room = $derived(view?.room ?? "");
    let url = $derived(room ? joinUrl(room) : "");
    // Our own generated SVG (never peer data), so {@html} is safe here.
    let qr = $derived(url ? renderSVG(url, { border: 2, blackColor: "#2b3a2f", whiteColor: "#ffffff" }) : "");
    let players = $derived($gameStore.players);
    let devices = $derived(
        Object.entries(view?.devices ?? {})
            .map(([id, d]) => ({ id, ...d, players: players.filter((p) => view?.claims[p.id] === id) }))
            .sort((a, b) => Number(b.online) - Number(a.online)),
    );

    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
    let copied = $state(false);
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
            copied = true;
            clearTimeout(copyTimer);
            copyTimer = setTimeout(() => (copied = false), 1800);
        } catch {
            window.prompt($t("shareCopy"), url);
        }
    }

    async function share() {
        try {
            await navigator.share({ title: $t("shareTitle"), text: $t("shareShareText"), url });
        } catch {
            /* cancelled */
        }
    }

    function stop() {
        if (confirm($t("shareStopConfirm"))) {
            endSharing();
            onclose();
        }
    }

    // ---- Motion ----------------------------------------------------------
    function rise(_node: Element): TransitionConfig {
        return { duration: ms(380), easing: backOut, css: (_t, u) => `transform: translateY(${u * 100}%);` };
    }
    function sink(_node: Element): TransitionConfig {
        return { duration: ms(220), easing: cubicOut, css: (_t, u) => `transform: translateY(${u * 100}%);` };
    }
    function fade(_node: Element, { duration = 220 }: { duration?: number } = {}): TransitionConfig {
        return { duration: ms(duration), css: (t) => `opacity: ${t};` };
    }

    // ---- Portal, focus, keyboard ----------------------------------------
    let dialogEl: HTMLDivElement | undefined = $state();
    const titleId = `share-title-${Math.random().toString(36).slice(2, 8)}`;

    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return { destroy: () => node.remove() };
    }

    onMount(() => {
        const opener = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialogEl?.focus({ preventScroll: true });
        return () => {
            clearTimeout(copyTimer);
            document.body.style.overflow = prevOverflow;
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        };
    });

    // Escape on the window: focus may have left the sheet (e.g. a list re-rendered).
    function onWindowKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && !e.defaultPrevented) {
            e.preventDefault();
            onclose();
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key !== "Tab" || !dialogEl) return;
        const els = [...dialogEl.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")];
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
    }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="sheet-root" use:portal>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape handled on the dialog) -->
    <div class="backdrop" onclick={onclose} in:fade out:fade={{ duration: 180 }}></div>

    <div
        bind:this={dialogEl}
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabindex="-1"
        onkeydown={onKeydown}
        in:rise
        out:sink
    >
        <div class="grabber" aria-hidden="true"></div>

        <header class="head">
            <span class="head-icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18.5h3" /></svg>
            </span>
            <h2 id={titleId}>{$t("shareTitle")}</h2>
            <button class="icon-btn close" onclick={onclose} aria-label={$t("shareClose")}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
        </header>

        {#if room}
            <div class="qr-nest" in:pop={{ duration: 420, start: 0.6 }}>
                <div class="qr" role="img" aria-label={$t("shareScan")}>{@html qr}</div>
                <p class="scan hand">{$t("shareScan")}</p>
            </div>

            <div class="code-block">
                <span class="code-label">{$t("shareCodeLabel")}</span>
                <span class="code" aria-label={[...room].join(" ")}>
                    {#each [...room] as ch, i}
                        <span class="ch" style="animation-delay: {80 + i * 50}ms">{ch}</span>
                    {/each}
                </span>
            </div>

            <div class="link-actions" class:single={!canShare}>
                <button class="btn-secondary" onclick={copy}>
                    {#if copied}
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        <span role="status">{$t("shareCopied")}</span>
                    {:else}
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>
                        {$t("shareCopy")}
                    {/if}
                </button>
                {#if canShare}
                    <button class="btn-secondary" onclick={share}>
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
                        {$t("shareShare")}
                    </button>
                {/if}
            </div>

            <section class="phones" aria-labelledby="{titleId}-phones">
                <h3 id="{titleId}-phones" class="label-hand">{$t("sharePhones")}</h3>
                {#if devices.length === 0}
                    <p class="no-phones">
                        <span class="waiting-bird" aria-hidden="true"><Bird size={34} flapping /></span>
                        {$t("shareNoPhones")}
                    </p>
                {:else}
                    <ul aria-live="polite">
                        {#each devices as d, i (d.id)}
                            <li class="phone" class:offline={!d.online} in:swoop={{ y: 12, delay: 30 * i, duration: 320 }}>
                                <div class="phone-top">
                                    <span class="dot" class:on={d.online} aria-hidden="true"></span>
                                    <span class="phone-label">{d.label}</span>
                                    <span class="visually-hidden">({d.online ? $t("shareOnline") : $t("shareOffline")})</span>
                                    {#if d.players.length > 0}
                                        <button
                                            class="release"
                                            onclick={() => $hosting?.release(d.id)}
                                            aria-label={$t("shareReleaseNamed", { name: d.label })}
                                        >{$t("shareRelease")}</button>
                                    {/if}
                                </div>
                                {#if d.players.length > 0}
                                    <ul class="claimed">
                                        {#each d.players as p (p.id)}
                                            <li class="claimed-chip"><Egg color={p.color} size={14} speckled={false} /> {p.name}</li>
                                        {/each}
                                    </ul>
                                {:else}
                                    <p class="nobody">{$t("shareNobody")}</p>
                                {/if}
                            </li>
                        {/each}
                    </ul>
                {/if}
            </section>

            <p class="privacy">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
                <span>{$t("sharePrivacy")}</span>
            </p>

            <button class="btn-ghost stop" onclick={stop}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                {$t("shareStop")}
            </button>
        {:else if $hostError}
            <div class="opening" role="alert">
                <p>{$t("shareError")}</p>
                <button class="btn-primary" onclick={host}>{$t("shareRetry")}</button>
            </div>
        {:else}
            <div class="opening" role="status">
                <span class="opening-bird" aria-hidden="true"><Bird size={56} flapping /></span>
                <p class="hand">{$t("shareOpening")}</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .sheet-root {
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
        border-top: 4px solid color-mix(in srgb, var(--forest) 70%, transparent);
        box-shadow: 0 -10px 30px -12px rgba(43, 40, 20, 0.45);
        padding: 6px 16px calc(14px + env(safe-area-inset-bottom));
        display: flex;
        flex-direction: column;
        gap: 12px;
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
    }

    .head {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .head-icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50% 50% 46% 54% / 55% 45% 55% 45%;
        color: var(--forest-deep);
        background: #e3f1ec;
        animation: wiggle 0.6s ease 0.2s;
    }

    .head h2 {
        flex: 1;
        min-width: 0;
        font-size: 1.35rem;
    }

    .close {
        flex-shrink: 0;
        margin-right: -6px;
    }

    /* ---------- QR ---------- */
    .qr-nest {
        align-self: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 12px 12px 6px;
        border-radius: 22px;
        background:
            repeating-linear-gradient(-20deg, rgba(94, 64, 41, 0.18) 0 3px, transparent 3px 9px),
            repeating-linear-gradient(25deg, rgba(138, 97, 66, 0.2) 0 2px, transparent 2px 11px),
            #c9a27a;
        box-shadow:
            inset 0 4px 10px rgba(60, 35, 15, 0.35),
            0 2px 0 rgba(110, 80, 50, 0.2);
    }

    .qr {
        width: min(62vw, 240px);
        aspect-ratio: 1;
        padding: 6px;
        border-radius: 14px;
        background: #fff;
        box-shadow: 0 2px 0 rgba(94, 64, 41, 0.35);
    }

    .qr :global(svg) {
        display: block;
        width: 100%;
        height: 100%;
    }

    .scan {
        font-size: 1.2rem;
        line-height: 1.2;
        color: #fffaf0;
        text-align: center;
        text-shadow: 0 1px 2px rgba(60, 35, 15, 0.6);
    }

    /* ---------- Code ---------- */
    .code-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .code-label {
        font-size: 0.8rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--ink-soft);
    }

    .code {
        display: flex;
        gap: 6px;
    }

    .ch {
        display: grid;
        place-items: center;
        width: 40px;
        height: 50px;
        border-radius: 12px;
        background: var(--paper);
        border: 2px solid var(--line);
        box-shadow: 0 3px 0 rgba(110, 80, 50, 0.18);
        font-family: var(--font-display);
        font-size: 1.75rem;
        font-weight: 600;
        color: var(--forest-deep);
        animation: drop 0.45s var(--spring) both;
    }

    .ch:nth-child(3) {
        margin-right: 8px;
    }

    @keyframes drop {
        from {
            transform: translateY(-14px) rotate(-8deg);
            opacity: 0;
        }
    }

    .link-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .link-actions.single {
        grid-template-columns: 1fr;
    }

    .link-actions button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 48px;
    }

    /* ---------- Phones ---------- */
    .phones ul {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    }

    .no-phones {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
        padding: 10px 12px;
        font-size: 0.92rem;
        color: var(--ink-soft);
        border: 2px dashed var(--line);
        border-radius: var(--radius-md);
    }

    .waiting-bird {
        flex-shrink: 0;
        animation: bob 1.6s ease-in-out infinite;
    }

    .phone {
        padding: 8px 10px 10px 12px;
        border-radius: var(--radius-md);
        background: #fff;
        border: 1.5px solid var(--line);
        box-shadow: var(--shadow-sm);
    }

    .phone.offline {
        opacity: 0.65;
    }

    .phone-top {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
    }

    .dot {
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #b9ad97;
    }

    .dot.on {
        background: #3fae6a;
        box-shadow: 0 0 0 4px rgba(63, 174, 106, 0.2);
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        50% {
            box-shadow: 0 0 0 7px rgba(63, 174, 106, 0.05);
        }
    }

    .phone-label {
        flex: 1;
        min-width: 0;
        font-weight: 800;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .release {
        flex-shrink: 0;
        min-height: 44px;
        padding: 4px 12px;
        margin: -4px -4px -4px 0;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--berry);
    }

    .release:hover {
        background: rgba(194, 85, 74, 0.1);
    }

    .claimed {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px !important;
        flex-direction: row !important;
    }

    .claimed-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 10px 2px 6px;
        border-radius: 999px;
        background: var(--paper);
        border: 1.5px solid var(--line);
        font-size: 0.88rem;
        font-weight: 700;
    }

    .nobody {
        margin-top: 2px;
        font-size: 0.85rem;
        color: var(--ink-soft);
    }

    .privacy {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 10px 12px;
        border-radius: var(--radius-md);
        background: rgba(47, 125, 109, 0.08);
        color: var(--forest-deep);
        font-size: 0.82rem;
        line-height: 1.4;
    }

    .privacy svg {
        flex-shrink: 0;
        margin-top: 1px;
    }

    .stop {
        align-self: center;
        min-height: 44px;
        color: var(--berry);
    }

    .opening {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 30px 8px 40px;
        text-align: center;
    }

    .opening .hand {
        font-size: 1.5rem;
        color: var(--ink-soft);
    }

    .opening-bird {
        animation: bob 1.4s ease-in-out infinite;
    }
</style>
