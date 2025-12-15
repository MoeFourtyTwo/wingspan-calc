<script lang="ts">
    import { gameStore, type Player } from "./store";
    import { t } from "./i18n";
    import { slide } from "svelte/transition";

    export let activePlayerId: string | null;

    const ROUNDS = [0, 1, 2, 3];
    const RANKS = [1, 2, 3, 0]; // 1st, 2nd, 3rd, None

    function togglePlacement(roundIndex: number, rank: number) {
        if (!activePlayerId) return;
        // Just set the rank directly. If clicking the same one, it stays (no toggle off needed since we have a 'None' column now)
        gameStore.updateRoundPlacement(activePlayerId, roundIndex, rank);
    }

    // Helper to get players in a specific cell
    function getPlayersInCell(
        players: Player[],
        roundIndex: number,
        rank: number,
    ) {
        return players.filter((p) => p.roundPlacements[roundIndex] === rank);
    }

    function getRowValidation(players: Player[], roundIndex: number): boolean {
        const c1 = players.filter(
            (p) => p.roundPlacements[roundIndex] === 1,
        ).length;
        const c2 = players.filter(
            (p) => p.roundPlacements[roundIndex] === 2,
        ).length;
        const c3 = players.filter(
            (p) => p.roundPlacements[roundIndex] === 3,
        ).length;
        const totalPlaced = c1 + c2 + c3;

        // Rule 0: If nobody is placed, it's valid (all None)
        if (totalPlaced === 0) return true;

        // Rule 1: Must have at least one 1st place
        if (c1 === 0) return false;

        // Logic for "Next Available Rank"
        // If 1 person in 1st => 2nd place is available.
        // If 2 people in 1st => 2nd place is skipped (so c2 must be 0), 3rd is available.
        // If 3+ people in 1st => 2nd and 3rd skipped (c2=0, c3=0).

        if (c1 === 1) {
            // 2nd place is available.
            // If we have a 3rd place, we MUST have a 2nd place (No Gaps).
            if (c3 > 0 && c2 === 0) return false; // Gap check

            // If we have 2nd place filled:
            if (c2 > 0) {
                // 1 in 1st + N in 2nd.
                // If 1 in 1st + 1 in 2nd => 3rd place available.
                // If 1 in 1st + 2 in 2nd => 3rd place skipped (c3 must be 0).
                if (c2 >= 2 && c3 > 0) return false; // Podium full check
            }
        } else if (c1 === 2) {
            // Tie for 1st. 2nd place skipped.
            if (c2 > 0) return false; // Invalid: 2nd place should be empty
            // 3rd place is available.
        } else if (c1 >= 3) {
            // Full podium in 1st.
            if (c2 > 0 || c3 > 0) return false;
        }

        return true;
    }
</script>

<div class="shared-grid-container">
    <div class="grid">
        <!-- Header Row -->
        <div class="row header-row">
            <div class="cell-label corner">{$t("round")}</div>
            <div class="cell-header rank-header rank-1">{$t("rank1")}</div>
            <div class="cell-header rank-header rank-2">{$t("rank2")}</div>
            <div class="cell-header rank-header rank-3">{$t("rank3")}</div>
            <div class="cell-header rank-header header-none">{$t("none")}</div>
        </div>

        {#each ROUNDS as roundIndex}
            {@const isValid = getRowValidation($gameStore.players, roundIndex)}
            <div class="row-wrapper" class:has-error={!isValid}>
                <div class="row">
                    <div class="cell-label round-label">
                        R{roundIndex + 1}
                    </div>

                    {#each RANKS as rank}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <div
                            class="cell"
                            class:active-target={activePlayerId &&
                                $gameStore.players.find(
                                    (p) => p.id === activePlayerId,
                                )?.roundPlacements[roundIndex] === rank}
                            class:cell-none={rank === 0}
                            class:rank-1-cell={rank === 1}
                            class:rank-2-cell={rank === 2}
                            class:rank-3-cell={rank === 3}
                            role="button"
                            tabindex="0"
                            on:click={() => togglePlacement(roundIndex, rank)}
                        >
                            <div class="dots-container">
                                {#each getPlayersInCell($gameStore.players, roundIndex, rank) as p (p.id)}
                                    <div
                                        class="player-dot"
                                        style="background-color: {p.color};"
                                        class:is-active={p.id ===
                                            activePlayerId}
                                        title={p.name}
                                    ></div>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .shared-grid-container {
        padding: 0.5rem;
        background: white;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        margin-top: 1rem;
    }

    .grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .row-wrapper {
        padding: 4px;
        border-radius: 8px;
        border: 2px solid transparent;
        transition:
            border-color 0.2s,
            background-color 0.2s;
    }

    .row-wrapper.has-error {
        background-color: #fff5f5;
        border-color: #ffcccc;
    }

    .row {
        display: grid;
        grid-template-columns: 50px repeat(3, 1fr) 0.8fr; /* 4th col slightly smaller */
        gap: 8px;
        align-items: stretch;
    }

    .header-row {
        margin-bottom: 0.5rem;
    }

    .cell-label {
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .rank-header {
        text-align: center;
        font-weight: 700;
        padding: 4px;
        border-radius: 4px;
        color: #444;
    }

    .rank-1 {
        background-color: #ffd700;
        border: 1px solid #e6c200;
    }
    .rank-2 {
        background-color: #c0c0c0;
        border: 1px solid #aaaaaa;
    }
    .rank-3 {
        background-color: #cd7f32;
        border: 1px solid #b06d28;
        color: white;
    }

    .header-none {
        background: #eee;
        color: #777;
        font-weight: 500;
    }

    .round-label {
        background: #f5f5f5;
        border-radius: 4px;
        font-size: 1rem;
    }

    .cell {
        background: #f9f9f9;
        border: 2px solid #eee;
        border-radius: 8px;
        min-height: 50px;
        cursor: pointer;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        padding: 4px;
        transition: all 0.2s;
    }

    .cell:hover {
        border-color: #ddd;
        background: #fff;
    }

    .cell-none {
        border: 2px dashed #eee;
        background: #fafafa;
    }
    .cell-none:hover {
        border-color: #ccc;
    }

    /* Highlight the cell if it contains the active player */
    .cell.active-target {
        border-width: 2px;
        background-color: white;
    }

    .cell.active-target.rank-1-cell {
        border-color: #ffd700;
        background-color: rgba(255, 215, 0, 0.1);
    }
    .cell.active-target.rank-2-cell {
        border-color: #c0c0c0;
        background-color: rgba(192, 192, 192, 0.1);
    }
    .cell.active-target.rank-3-cell {
        border-color: #cd7f32;
        background-color: rgba(205, 127, 50, 0.1);
    }

    .dots-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
        width: 100%;
    }

    .player-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: transform 0.2s;
    }

    .player-dot.is-active {
        transform: scale(1.3);
        border-color: var(--color-text-primary);
        z-index: 2;
    }

    .player-dot:not(.is-active) {
        opacity: 0.7;
    }
</style>
