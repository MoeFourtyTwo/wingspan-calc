<script lang="ts">
    import { gameStore, type Phase } from "./lib/store";
    import { t } from "./lib/i18n";
    import Setup from "./lib/Setup.svelte";
    import Scoring from "./lib/Scoring.svelte";
    import Result from "./lib/Result.svelte";
    import Stats from "./lib/Stats.svelte";
    import StartPlayerSelection from "./lib/StartPlayerSelection.svelte";
    import SetupDraw from "./lib/SetupDraw.svelte";
    import LanguageToggle from "./lib/LanguageToggle.svelte";
    import Bird from "./lib/ui/Bird.svelte";
    import Feather from "./lib/ui/Feather.svelte";
    import Binoculars from "./lib/ui/Binoculars.svelte";
    import Checker from "./lib/checker/Checker.svelte";
    import { swoop } from "./lib/ui/motion";

    const ORDER: Phase[] = ["SETUP", "SELECTION", "DRAW", "SCORING", "RESULT", "STATS"];

    let phase = $derived($gameStore.currentPhase);

    // Direction-aware page swoop: forward flies in from the right, back from the left.
    // Plain variable on purpose: only `phase` should trigger the effect.
    let lastPhase: Phase = $gameStore.currentPhase;
    let dir = $state(1);
    $effect.pre(() => {
        if (phase !== lastPhase) {
            dir = ORDER.indexOf(phase) >= ORDER.indexOf(lastPhase) ? 1 : -1;
            lastPhase = phase;
            window.scrollTo({ top: 0 });
        }
    });

    // Bonus card checker: an overlay on top of whatever phase is showing.
    let checkerOpen = $state(false);

    let hop = $state(false);
    function birdHop() {
        hop = false;
        requestAnimationFrame(() => (hop = true));
    }
</script>

<div class="decor" aria-hidden="true">
    <span class="f f1"><Feather color="#2f7d6d" size={90} /></span>
    <span class="f f2"><Feather color="#d9a72b" size={70} /></span>
    <span class="f f3"><Feather color="#3b7fb6" size={80} /></span>
</div>

<main>
    <header class="app-header">
        <button
            class="logo"
            class:hop
            onclick={birdHop}
            onanimationend={() => (hop = false)}
            aria-label={$t("appTitle")}
        >
            <Bird size={46} />
            <svg class="twig" viewBox="0 0 80 14" aria-hidden="true">
                <path d="M2 8 Q40 2 78 7" stroke="#8a6142" stroke-width="3" fill="none" stroke-linecap="round" />
                <path d="M58 6 q6 -6 12 -4 q-5 4 -12 4z" fill="#2f7d6d" />
                <path d="M16 7 q-4 5 -10 5 q3 -5 10 -5z" fill="#6aa84f" />
            </svg>
        </button>
        <div class="titles">
            <h1>{$t("appTitle")}</h1>
            <p class="tagline">{$t("appTagline")}</p>
        </div>
        <div class="tools">
            <button
                class="checker-btn"
                class:active={checkerOpen}
                onclick={() => (checkerOpen = true)}
                aria-label={$t("chkOpen")}
                aria-haspopup="dialog"
                title={$t("chkOpen")}
            >
                <Binoculars size={22} />
            </button>
            <LanguageToggle />
        </div>
    </header>

    <div class="content">
        {#key phase}
            <div
                class="page"
                in:swoop={{ x: 48 * dir, y: 6, rotate: 1.5 * dir, duration: 420 }}
            >
                {#if phase === "SETUP"}
                    <Setup />
                {:else if phase === "SELECTION"}
                    <StartPlayerSelection />
                {:else if phase === "DRAW"}
                    <SetupDraw />
                {:else if phase === "SCORING"}
                    <Scoring />
                {:else if phase === "RESULT"}
                    <Result />
                {:else if phase === "STATS"}
                    <Stats />
                {/if}
            </div>
        {/key}
    </div>
</main>

{#if checkerOpen}
    <Checker onclose={() => (checkerOpen = false)} />
{/if}

<style>
    main {
        flex: 1;
        display: flex;
        flex-direction: column;
        /* Bursts & swoops never cause a horizontal scrollbar */
        overflow-x: clip;
        overflow-y: visible;
        padding: 0 2px;
    }

    .decor {
        position: fixed;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: -1;
        opacity: 0.16;
    }

    .f {
        position: absolute;
        animation: drift 9s ease-in-out infinite;
    }

    .f1 {
        top: 14%;
        left: -12px;
        rotate: 30deg;
    }

    .f2 {
        top: 58%;
        right: -6px;
        rotate: -25deg;
        animation-delay: -3s;
    }

    .f3 {
        bottom: 4%;
        left: 8%;
        rotate: 70deg;
        animation-delay: -6s;
    }

    @keyframes drift {
        0%,
        100% {
            transform: translate(0, 0) rotate(0);
        }
        50% {
            transform: translate(6px, -10px) rotate(8deg);
        }
    }

    .app-header {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 6px 0 14px;
        margin-bottom: 10px;
        border-bottom: 2px dashed var(--line);
    }

    .logo {
        position: relative;
        display: grid;
        justify-items: center;
        width: 56px;
        padding: 0;
        border-radius: 14px;
    }

    .logo :global(.bird) {
        margin-bottom: -8px;
        position: relative;
        z-index: 1;
    }

    .logo:hover :global(.bird) {
        animation: wiggle 0.5s ease;
    }

    .logo.hop :global(.bird) {
        animation: hop 0.5s var(--spring);
    }

    .twig {
        width: 56px;
        height: 12px;
    }

    @keyframes hop {
        0% {
            transform: translateY(0) scaleY(1);
        }
        20% {
            transform: translateY(2px) scaleY(0.85);
        }
        55% {
            transform: translateY(-16px) rotate(-10deg);
        }
        100% {
            transform: translateY(0);
        }
    }

    .titles {
        min-width: 0;
    }

    .tools {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .checker-btn {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        flex: none;
        border-radius: 50%;
        color: var(--forest-deep);
        background: var(--card);
        border: 1.5px solid var(--line);
        box-shadow: 0 3px 0 rgba(110, 80, 50, 0.16);
        --lens: rgba(47, 125, 109, 0.18);
    }

    .checker-btn:hover {
        transform: translateY(-1px) rotate(-6deg);
    }

    .checker-btn:active {
        transform: translateY(2px) scale(0.9);
        box-shadow: 0 1px 0 rgba(110, 80, 50, 0.16);
        transition-duration: 0.08s;
    }

    h1 {
        font-size: clamp(1.25rem, 5.4vw, 1.7rem);
        color: var(--forest-deep);
        line-height: 1.05;
    }

    .tagline {
        font-family: var(--font-hand);
        font-size: 1.15rem;
        color: var(--twig);
        line-height: 1;
        margin-top: 2px;
    }

    .content {
        flex: 1;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .page {
        flex: 1;
        display: flex;
        flex-direction: column;
        transform-origin: 50% 0;
    }
</style>
