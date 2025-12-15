<script lang="ts">
    import { gameStore } from "./store";
    import { t } from "./i18n";
    import { slide, scale } from "svelte/transition";

    // Sort players by total score descending
    $: sortedPlayers = [...$gameStore.players].sort(
        (a, b) => b.total - a.total,
    );
    $: winner = sortedPlayers[0];

    function goToStats() {
        gameStore.setPhase("STATS");
    }

    function playAgain() {
        if (confirm($t("confirmNewGame"))) {
            gameStore.resetGame();
        }
    }
</script>

<div class="result-container">
    <div class="header">
        <button
            class="btn-secondary back-btn"
            on:click={() => gameStore.backToScoring()}
        >
            ← {$t("adjustScores")}
        </button>
    </div>

    <div class="winner-section" in:scale={{ duration: 500, start: 0.8 }}>
        <div class="laurel-wreath">🏆</div>
        <h2>{$t("winner")}</h2>
        <div class="winner-card">
            <span
                class="player-dot large"
                style="background-color: {winner?.color}"
            ></span>
            <h1 class="winner-name">{winner?.name}</h1>
            <div class="winner-score">{winner?.total} {$t("pts")}</div>
        </div>
    </div>

    <div class="leaderboard">
        <h3>{$t("leaderboard")}</h3>
        <ul>
            {#each sortedPlayers as player, i (player.id)}
                <li class="leaderboard-item" transition:slide|local>
                    <div class="rank">#{i + 1}</div>
                    <div class="player-info">
                        <span
                            class="player-dot"
                            style="background-color: {player.color}"
                        ></span>
                        <span class="name">{player.name}</span>
                    </div>
                    <div class="score">{player.total}</div>
                </li>
            {/each}
        </ul>
    </div>

    <div class="actions">
        <button class="btn-primary" on:click={goToStats}>
            {$t("viewStats")} →
        </button>
        <button
            class="btn-secondary"
            on:click={playAgain}
            style="margin-top: 10px; width: 100%;"
        >
            {$t("newGame")}
        </button>
    </div>
</div>

<style>
    .result-container {
        padding: 0 0.5rem;
        text-align: center;
    }

    .header {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        margin-bottom: 1rem;
        padding-top: 0.5rem;
    }

    .back-btn {
        border: none;
        background: transparent;
        color: var(--color-text-secondary);
        padding: 0;
        font-size: 0.9rem;
    }

    .back-btn:hover {
        color: var(--color-text-primary);
        text-decoration: underline;
    }

    .winner-section {
        margin-bottom: 3rem;
        padding: 2rem;
        background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.8) 0%,
            rgba(255, 255, 255, 0) 70%
        );
    }

    .laurel-wreath {
        font-size: 3rem;
        margin-bottom: 0.5rem;
    }

    .winner-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .player-dot.large {
        width: 24px;
        height: 24px;
        border-radius: 50%;
    }

    .winner-name {
        font-size: 2.5rem;
        margin: 0;
        color: var(--color-text-primary);
    }

    .winner-score {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-primary-brown);
        background: white;
        padding: 4px 16px;
        border-radius: 20px;
        box-shadow: var(--shadow-sm);
    }

    .leaderboard {
        margin-bottom: 2rem;
        text-align: left;
    }

    .leaderboard h3 {
        margin-bottom: 1rem;
        padding-left: 0.5rem;
    }

    .leaderboard-item {
        background: white;
        padding: 16px;
        border-radius: var(--radius-md);
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: var(--shadow-sm);
    }

    .rank {
        font-weight: 700;
        color: var(--color-text-secondary);
        width: 30px;
    }

    .player-info {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .player-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .score {
        font-weight: 700;
        font-size: 1.2rem;
    }

    .actions {
        margin-top: 2rem;
    }
</style>
