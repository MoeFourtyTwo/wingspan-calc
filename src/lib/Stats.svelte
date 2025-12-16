<script lang="ts">
    import { gameStore, CATEGORIES, type Player } from "./store";
    import { historyStore, type GameRecord } from "./historyStore";
    import { t } from "./i18n";
    import { fade, slide, scale } from "svelte/transition";
    import { onMount, tick, onDestroy } from "svelte";
    import Chart from "chart.js/auto";

    let selectedGameId: string | null = null;
    let comparisonGroup: string[] | null = null;
    let showHistorySelector = false;

    // Chart Instances
    let historyChartInstance: Chart | null = null;
    let distributionChartInstance: Chart | null = null;
    let winnersChartInstance: Chart | null = null;

    // Canvas Elements
    let historyCanvas: HTMLCanvasElement;
    let distributionCanvas: HTMLCanvasElement;
    let winnersCanvas: HTMLCanvasElement;

    // Derived stats for comparison
    let groupStats: {
        games: number;
        wins: Record<string, number>;
        avgScore: Record<string, number>;
        highScore: Record<string, number>;
        history: { date: string; scores: Record<string, number> }[];
        accumulated: Record<string, Record<string, number>>; // player -> { category: total }
    } | null = null;

    // Normalize current game
    $: currentGameRecord = {
        id: $gameStore.gameId,
        date: new Date().toISOString(),
        startPlayerName:
            $gameStore.players.find((p) => p.id === $gameStore.startPlayerId)
                ?.name || "",
        players: $gameStore.players.map((p) => ({
            name: p.name,
            total: p.total,
            scores: p.scores,
            winner: false,
            color: p.color,
        })),
    };

    // Default Selection Logic
    $: {
        if (
            !selectedGameId &&
            $gameStore.players.length === 0 &&
            $historyStore.length > 0
        ) {
            selectedGameId = $historyStore[0].id; // Default to historical
        }
    }

    // Determine which game to display
    $: displayedGame = selectedGameId
        ? $historyStore.find((g) => g.id === selectedGameId) ||
          currentGameRecord
        : currentGameRecord;

    $: players = [...(displayedGame?.players || [])].sort(
        (a, b) => b.total - a.total,
    );
    $: maxScore = Math.max(...players.map((p) => p.total), 1);

    // Reactive Chart Updates
    $: {
        $t;
        if (groupStats && historyCanvas) renderHistoryChart();
    }

    $: {
        $t;
        if (groupStats && winnersCanvas) renderWinnersChart();
    }

    $: {
        $t;
        if (displayedGame && distributionCanvas) renderDistributionChart();
    }

    // Helpers
    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString();
    }

    function selectGame(id: string | null) {
        selectedGameId = id;
        showHistorySelector = false;
        closeComparison();
        // Wait for DOM update then render distribution
        tick().then(() => {
            if (distributionCanvas) renderDistributionChart();
        });
    }

    function deleteCurrentGame() {
        if (selectedGameId && confirm($t("delete") + "?")) {
            historyStore.deleteGame(selectedGameId);
            selectedGameId = null;
        }
    }

    function goHome() {
        gameStore.resetGame();
    }

    // Comparison Logic
    function getPlayerNames(game: GameRecord | typeof currentGameRecord) {
        return game.players
            .map((p) => p.name)
            .sort()
            .join(",");
    }

    async function openComparison() {
        if (!displayedGame) return;
        const groupKey = getPlayerNames(displayedGame);
        const relevantGames = $historyStore
            .filter((g) => getPlayerNames(g) === groupKey)
            .sort(
                (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime(),
            );

        if (relevantGames.length === 0) {
            alert("No history for this exact group.");
            return;
        }

        const wins: Record<string, number> = {};
        const totalScore: Record<string, number> = {};
        const highScore: Record<string, number> = {};
        const counts: Record<string, number> = {};
        const accumulated: Record<string, Record<string, number>> = {};

        // Init stats
        displayedGame.players.forEach((p) => {
            wins[p.name] = 0;
            totalScore[p.name] = 0;
            highScore[p.name] = 0;
            counts[p.name] = 0;
            accumulated[p.name] = { total: 0 };
            CATEGORIES.forEach((cat) => (accumulated[p.name][cat] = 0));
        });

        const historyData: { date: string; scores: Record<string, number> }[] =
            [];

        relevantGames.forEach((g) => {
            const roundScores: Record<string, number> = {};
            g.players.forEach((p) => {
                if (p.winner) wins[p.name] = (wins[p.name] || 0) + 1;
                totalScore[p.name] = (totalScore[p.name] || 0) + p.total;
                highScore[p.name] = Math.max(highScore[p.name] || 0, p.total);
                counts[p.name] = (counts[p.name] || 0) + 1;
                roundScores[p.name] = p.total;

                // Accumulate
                accumulated[p.name].total += p.total;
                CATEGORIES.forEach((cat) => {
                    accumulated[p.name][cat] += p.scores[cat] || 0;
                });
            });
            historyData.push({
                date: g.date,
                scores: roundScores,
            });
        });

        const avgScore: Record<string, number> = {};
        Object.keys(totalScore).forEach((name) => {
            avgScore[name] = Math.round(totalScore[name] / (counts[name] || 1));
        });

        groupStats = {
            games: relevantGames.length,
            wins,
            avgScore,
            highScore,
            history: historyData,
            accumulated,
        };
        comparisonGroup = displayedGame.players.map((p) => p.name);

        await tick();
        renderHistoryChart();
        renderWinnersChart();
    }

    function getLeaderScore(category: string): number {
        if (!groupStats || !comparisonGroup) return 0;
        return Math.max(
            ...comparisonGroup.map(
                (name) => groupStats!.accumulated[name][category],
            ),
        );
    }

    async function renderHistoryChart() {
        if (!historyCanvas || !groupStats || !comparisonGroup) return;
        if (historyChartInstance) historyChartInstance.destroy();

        const labels = groupStats.history.map((h) => formatDate(h.date));
        const datasets = comparisonGroup.map((name) => {
            const playerColor =
                displayedGame.players.find((p) => p.name === name)?.color ||
                "#000";
            return {
                label: name,
                data: groupStats!.history.map((h) => h.scores[name] || 0),
                borderColor: playerColor,
                backgroundColor: playerColor,
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6,
            };
        });

        historyChartInstance = new Chart(historyCanvas, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { boxWidth: 10, usePointStyle: true },
                    },
                    tooltip: { mode: "index", intersect: false },
                },
                scales: {
                    y: { beginAtZero: false, grid: { color: "#f0f0f0" } },
                    x: { grid: { display: false } },
                },
            },
        });
    }

    async function renderWinnersChart() {
        if (!winnersCanvas || !groupStats || !comparisonGroup) return;
        if (winnersChartInstance) winnersChartInstance.destroy();

        const labels = comparisonGroup;
        const data = comparisonGroup.map((name) => groupStats!.wins[name] || 0);
        const backgroundColor = comparisonGroup.map(
            (name) =>
                displayedGame.players.find((p) => p.name === name)?.color ||
                "#999",
        );

        winnersChartInstance = new Chart(winnersCanvas, {
            type: "pie",
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { boxWidth: 10, usePointStyle: true },
                    },
                },
            },
        });
    }

    async function renderDistributionChart() {
        if (!distributionCanvas || !displayedGame) return;
        if (distributionChartInstance) distributionChartInstance.destroy();

        const labels = players.map((p) => p.name);
        const datasets = CATEGORIES.map((cat) => ({
            label: $t(cat),
            data: players.map((p) => p.scores[cat]),
            backgroundColor: categoryColors[cat],
            stack: "Stack 0",
            barPercentage: 0.6,
        }));

        distributionChartInstance = new Chart(distributionCanvas, {
            type: "bar",
            data: { labels, datasets },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { boxWidth: 10, usePointStyle: true },
                    },
                    tooltip: { mode: "nearest", intersect: true },
                },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, grid: { display: false } },
                },
            },
        });
    }

    function closeComparison() {
        comparisonGroup = null;
        groupStats = null;
        if (historyChartInstance) historyChartInstance.destroy();
        if (winnersChartInstance) winnersChartInstance.destroy();
        historyChartInstance = null;
        winnersChartInstance = null;
    }

    onDestroy(() => {
        if (historyChartInstance) historyChartInstance.destroy();
        if (winnersChartInstance) winnersChartInstance.destroy();
        if (distributionChartInstance) distributionChartInstance.destroy();
    });

    const categoryColors: Record<string, string> = {
        round_goals: "#a3c4dc",
        bonus: "#e9c46a",
        nectar: "#e76f51",
        birds: "#2a9d8f",
        tucked: "#e6b8b8",
        eggs: "#f4a261",
        food: "#9fb98b",
    };
</script>

<div class="stats-container">
    <!-- Header with Game Selector -->
    <div class="header">
        <button class="btn-secondary back-btn" on:click={goHome}> 🏠 </button>

        <div class="selector-container">
            <button
                class="selector-btn"
                on:click={() => (showHistorySelector = !showHistorySelector)}
            >
                {selectedGameId
                    ? formatDate(displayedGame.date)
                    : $gameStore.players.length > 0
                      ? $t("currentGame")
                      : $t("selectGame")}
                <span class="chevron">▼</span>
            </button>

            {#if showHistorySelector}
                <div class="dropdown" transition:slide>
                    {#if $historyStore.length > 0 || $gameStore.players.length > 0}
                        {#if $gameStore.players.length > 0}
                            <button
                                class:active={!selectedGameId}
                                on:click={() => selectGame(null)}
                            >
                                {$t("currentGame")}
                            </button>
                        {/if}
                        {#each $historyStore as game}
                            <button
                                class:active={selectedGameId === game.id}
                                on:click={() => selectGame(game.id)}
                            >
                                {formatDate(game.date)} - {game.players.find(
                                    (p) => p.winner,
                                )?.name || "?"}
                            </button>
                        {/each}
                    {:else}
                        <button disabled>No history yet</button>
                    {/if}
                </div>
            {/if}
        </div>

        <div class="header-actions">
            {#if selectedGameId}
                <button
                    class="icon-btn"
                    on:click={deleteCurrentGame}
                    title={$t("delete")}>🗑️</button
                >
            {/if}
        </div>
    </div>

    <!-- Comparison Overlay -->
    {#if comparisonGroup && groupStats}
        <div class="comparison-overlay" transition:slide>
            <div class="card comparison-card">
                <div class="comp-header">
                    <h3>{$t("groupStats")} ({groupStats.games} Games)</h3>
                    <button class="icon-btn" on:click={closeComparison}
                        >✕</button
                    >
                </div>

                <!-- Summary Stats -->
                <div class="stats-grid">
                    <div class="stat-col header-col">
                        <span>&nbsp;</span>
                        <span>{$t("statRate")}</span>
                        <span>{$t("statWins")}</span>
                        <span>{$t("statAvg")}</span>
                        <span>{$t("statHigh")}</span>
                    </div>
                    {#each comparisonGroup as name}
                        {@const winRate =
                            groupStats.games > 0
                                ? Math.round(
                                      (groupStats.wins[name] /
                                          groupStats.games) *
                                          100,
                                  )
                                : 0}
                        <div class="stat-col">
                            <strong>{name}</strong>
                            <span>{winRate}%</span>
                            <span>{groupStats.wins[name] || 0}</span>
                            <span>{groupStats.avgScore[name] || 0}</span>
                            <span>{groupStats.highScore[name] || 0}</span>
                        </div>
                    {/each}
                </div>

                <!-- Charts -->
                <div class="charts-row">
                    <div class="graph-container history-graph">
                        <h4>{$t("historyTrend")}</h4>
                        <div class="canvas-wrapper">
                            <canvas bind:this={historyCanvas}></canvas>
                        </div>
                    </div>

                    <div class="graph-container winners-graph">
                        <h4>{$t("totalWins")}</h4>
                        <div class="canvas-wrapper">
                            <canvas bind:this={winnersCanvas}></canvas>
                        </div>
                    </div>
                </div>

                <!-- Accumulated Stats Section -->
                <div class="accumulated-section">
                    <h3>{$t("accumulatedPoints")}</h3>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    {#each comparisonGroup as name}
                                        <th>{name}</th>
                                    {/each}
                                </tr>
                            </thead>
                            <tbody>
                                {#each CATEGORIES as cat}
                                    {@const maxVal = getLeaderScore(cat)}
                                    <tr>
                                        <td class="cat-label">{$t(cat)}</td>
                                        {#each comparisonGroup as name}
                                            {@const val =
                                                groupStats.accumulated[name][
                                                    cat
                                                ]}
                                            <td
                                                class:leader={val === maxVal &&
                                                    val > 0}>{val}</td
                                            >
                                        {/each}
                                    </tr>
                                {/each}
                                <tr class="total-row">
                                    <td>{$t("totalAccumulated")}</td>
                                    {#each comparisonGroup as name}
                                        {@const val =
                                            groupStats.accumulated[name].total}
                                        <td
                                            class:leader={val ===
                                                getLeaderScore("total") &&
                                                val > 0}>{val}</td
                                        >
                                    {/each}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Main Stats View -->
    {#if displayedGame && displayedGame.players.length > 0}
        <div class="card table-card">
            <div class="card-header-row">
                <h3>{$t("scoreBreakdown")}</h3>
                {#if selectedGameId && !comparisonGroup}
                    <button class="text-btn" on:click={openComparison}
                        >{$t("compareGroup")}</button
                    >
                {/if}
            </div>

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
            <div class="distribution-container">
                <canvas bind:this={distributionCanvas}></canvas>
            </div>
        </div>
    {:else}
        <div class="empty-state">
            <p>No game data to display.</p>
            <button class="btn-primary" on:click={goHome}>Start New Game</button
            >
        </div>
    {/if}
</div>

<style>
    .stats-container {
        padding: 0 0.5rem 2rem 0.5rem;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        position: relative;
        z-index: 10;
    }

    .back-btn {
        border: none;
        font-size: 0.9rem;
        padding: 6px 12px;
        border-radius: 8px;
    }

    .selector-container {
        position: relative;
        flex: 1;
        display: flex;
        justify-content: center;
    }

    .selector-btn {
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.1);
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.95rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .chevron {
        font-size: 0.7rem;
        opacity: 0.5;
    }

    .dropdown {
        position: absolute;
        top: 110%;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 8px;
        display: flex;
        flex-direction: column;
        width: 240px;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .dropdown button {
        background: none;
        border: none;
        padding: 8px;
        text-align: left;
        cursor: pointer;
        border-radius: 6px;
        transition: background-color 0.2s;
        font-size: 0.9rem;
    }

    .dropdown button:hover:not(:disabled) {
        background: rgba(0, 0, 0, 0.05);
    }

    .dropdown button.active {
        background: rgba(0, 0, 0, 0.05);
        font-weight: bold;
        color: var(--color-primary-blue);
    }

    .header-actions {
        width: 60px; /* Spacer/Container */
        display: flex;
        justify-content: flex-end;
    }

    .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2rem;
    }

    .card-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .card-header-row h3 {
        margin: 0;
    }

    .text-btn {
        background: none;
        border: none;
        color: var(--color-primary-blue);
        cursor: pointer;
        text-decoration: underline;
    }

    /* Table & Chart Styles */
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
        border: 1px solid rgba(0, 0, 0, 0.1);
    }

    /* Accumulated Stats Styles */
    .accumulated-section {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
    }
    .accumulated-section h3 {
        margin-top: 0;
        margin-bottom: 1rem;
        font-size: 1rem;
        color: var(--color-text-secondary);
    }
    .leader {
        font-weight: bold;
        color: var(--color-primary-blue);
        background-color: rgba(98, 182, 203, 0.1); /* Subtle blue tint */
    }

    .chart-card {
        margin-top: 2rem; /* Added gap between table and chart */
    }

    .distribution-container {
        height: 300px;
        position: relative;
    }

    /* Comparison Overlay */
    .comparison-overlay {
        margin-bottom: 1.5rem;
    }
    .comparison-card {
        background: white;
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .comp-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
    }
    .comp-header h3 {
        margin: 0;
        font-size: 1.1rem;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .stat-col {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        text-align: center;
        font-size: 0.9rem;
    }
    .header-col span {
        font-weight: bold;
        color: var(--color-text-secondary);
    }

    .charts-row {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .graph-container {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    .canvas-wrapper {
        position: relative;
        height: 250px;
    }

    .graph-container h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.9rem;
        color: var(--color-text-secondary);
    }

    .empty-state {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-secondary);
    }
</style>
