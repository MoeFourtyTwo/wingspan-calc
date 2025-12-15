<script lang="ts">
    import { onMount } from "svelte";
    import { gameStore } from "./store";
    import { t } from "./i18n";
    import { scale } from "svelte/transition";

    let displayingPlayerIndex = 0;
    let isFinished = false;
    let interval: any;

    // The actual start player is already determined in the store,
    // but we want to animate "finding" them or just picking one visually.
    // Actually, wait, Setup.svelte was setting the start player.
    // Let's modify Setup to NOT set it, and let THIS component set it?
    // Or Setup sets it, and we just animate to it.
    // Let's have Setup set it, so we know who to land on.

    $: targetPlayerId = $gameStore.startPlayerId;
    $: players = $gameStore.players;
    $: targetPlayer = players.find((p) => p.id === targetPlayerId);

    onMount(() => {
        // Start fast cycling
        let speed = 100;
        const slowdownFactor = 1.1;
        const maxSpeed = 800;

        // Safety check
        if (players.length === 0) {
            gameStore.setPhase("SETUP");
            return;
        }

        const runLoop = () => {
            displayingPlayerIndex =
                (displayingPlayerIndex + 1) % players.length;

            // If we are moving slow enough and hit the target, stop
            if (
                speed > 400 &&
                players[displayingPlayerIndex].id === targetPlayerId
            ) {
                finish();
                return;
            }

            speed *= slowdownFactor;
            if (speed > maxSpeed) speed = maxSpeed;

            interval = setTimeout(runLoop, speed);
        };

        runLoop();

        return () => clearTimeout(interval);
    });

    function finish() {
        isFinished = true;
        // Removed auto transition
    }

    function goToScoring() {
        gameStore.setPhase("SCORING");
    }
</script>

<div class="selection-container">
    <h2>
        {isFinished ? $t("firstSelected") : $t("selectingFirst")}
    </h2>

    <div class="animation-stage">
        <div class="player-card" class:highlight={isFinished}>
            <span
                class="player-dot large"
                style="background-color: {players[displayingPlayerIndex]
                    ?.color}"
            ></span>
            <h1 class="player-name">{players[displayingPlayerIndex]?.name}</h1>
        </div>
    </div>

    {#if isFinished}
        <div class="message" in:scale>
            {$t("turnStartPre")}<b>{targetPlayer?.name}</b>{$t("turnStartPost")}
        </div>

        <button
            class="btn-primary start-scoring-btn"
            in:scale={{ delay: 200 }}
            on:click={goToScoring}
        >
            {$t("startGame")} →
        </button>
    {/if}
</div>

<style>
    .selection-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        padding: 2rem;
    }

    h2 {
        color: var(--color-text-secondary);
        margin-bottom: 3rem;
    }

    .player-card {
        background: white;
        padding: 2rem 3rem;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        transition: transform 0.1s;
        width: 300px;
    }

    .player-card.highlight {
        transform: scale(1.1);
        box-shadow: 0 0 0 4px var(--color-accent-gold);
        border: 2px solid var(--color-accent-gold);
    }

    .player-dot.large {
        width: 40px;
        height: 40px;
        border-radius: 50%;
    }

    .player-name {
        font-size: 2rem;
        margin: 0;
    }

    .message {
        margin-top: 2rem;
        font-size: 1.2rem;
        color: var(--color-text-primary);
        margin-bottom: 2rem;
    }

    .start-scoring-btn {
        animation: bounce 2s infinite;
    }

    @keyframes bounce {
        0%,
        20%,
        50%,
        80%,
        100% {
            transform: translateY(0);
        }
        40% {
            transform: translateY(-10px);
        }
        60% {
            transform: translateY(-5px);
        }
    }
</style>
