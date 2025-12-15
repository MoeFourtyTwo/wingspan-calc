<script lang="ts">
    import { gameStore, CATEGORIES } from "./store";
    import { t } from "./i18n";
    import { fade } from "svelte/transition";

    $: players = $gameStore.players.sort((a, b) => b.total - a.total);
    $: maxScore = Math.max(...players.map((p) => p.total), 1); // Avoid div by zero

    const categoryColors = {
        round_goals: "#a3c4dc",
        bonus: "#e9c46a",
        nectar: "#e76f51", // Accent
        birds: "#2a9d8f",
        tucked: "#e6b8b8",
        eggs: "#f4a261",
        food: "#9fb98b",
    };

    function playAgain() {
        if (confirm($t("confirmNewGame"))) {
            gameStore.resetGame();
        }
    }

    function goBack() {
        gameStore.setPhase("RESULT");
    }
</script>

<div class="stats-container">
    <div class="header">
        <button class="btn-secondary back-btn" on:click={goBack}>
            ← {$t("backToResults")}
        </button>
        <h2>{$t("statsTitle")}</h2>
    </div>

    <!-- Score Breakdown Table -->
    <div class="card table-card">
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>{$t("categoryTitle")}</th>
                        {#each players as player}
                            <th>
                                <div class="th-content">
                                    <span
                                        class="player-dot"
                                        style="background-color: {player.color}"
                                    ></span>
                                    {player.name}
                                </div>
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each CATEGORIES as cat}
                        <tr>
                            <td class="cat-label">{$t(cat)}</td>
                            {#each players as player}
                                <td>{player.scores[cat]}</td>
                            {/each}
                        </tr>
                    {/each}
                    <tr class="total-row">
                        <td>{$t("total")}</td>
                        {#each players as player}
                            <td>{player.total}</td>
                        {/each}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Visualizer: Stacked Bar Chart -->
    <div class="card chart-card">
        <h3>{$t("scoreDistribution")}</h3>
        <div class="chart-container">
            {#each players as player}
                <div class="player-bar-row">
                    <div class="bar-label">{player.name}</div>
                    <div class="bar-track">
                        {#each CATEGORIES as cat}
                            {#if player.scores[cat] > 0}
                                <div
                                    class="bar-segment"
                                    style="width: {(player.scores[cat] /
                                        maxScore) *
                                        100}%; background-color: {categoryColors[
                                        cat
                                    ]}"
                                    title="{$t(cat)}: {player.scores[cat]}"
                                ></div>
                            {/if}
                        {/each}
                    </div>
                    <div class="bar-total">{player.total}</div>
                </div>
            {/each}
        </div>

        <div class="legend">
            {#each CATEGORIES as cat}
                <div class="legend-item">
                    <span
                        class="legend-dot"
                        style="background-color: {categoryColors[cat]}"
                    ></span>
                    <span>{$t(cat)}</span>
                </div>
            {/each}
        </div>
    </div>

    <div class="actions">
        <button class="btn-secondary" on:click={playAgain} style="width: 100%;">
            {$t("newGame")}
        </button>
    </div>
</div>

<style>
    .stats-container {
        padding: 0 0.5rem 2rem 0.5rem;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .back-btn {
        border: none;
        font-size: 0.9rem;
    }

    h2 {
        margin: 0;
        font-size: 1.5rem;
    }

    h3 {
        margin-bottom: 1rem;
    }

    .table-wrapper {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }

    th,
    td {
        padding: 8px;
        text-align: center;
        border-bottom: 1px solid #eee;
    }

    th {
        font-weight: 600;
        color: var(--color-text-secondary);
    }

    .th-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font-size: 0.8rem;
    }

    .cat-label {
        text-align: left;
        font-weight: 600;
        color: var(--color-text-primary);
    }

    .total-row td {
        border-top: 2px solid #ddd;
        border-bottom: none;
        font-weight: 800;
        font-size: 1.1rem;
    }

    .player-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    /* Chart Styles */
    .chart-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 1.5rem;
    }

    .player-bar-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .bar-label {
        width: 60px;
        font-size: 0.9rem;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .bar-track {
        flex: 1;
        height: 24px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 12px;
        overflow: hidden;
        display: flex;
    }

    .bar-segment {
        height: 100%;
        transition: width 0.5s ease-out;
    }

    .bar-total {
        width: 30px;
        font-weight: 700;
        font-size: 0.9rem;
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        margin-top: 1rem;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--color-text-secondary);
    }

    .legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
</style>
