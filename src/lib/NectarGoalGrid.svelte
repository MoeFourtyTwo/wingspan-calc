<script lang="ts">
    import { gameStore, type Player } from "./store";
    import { t } from "./i18n";

    export let activePlayerId: string | null;

    const BIOMES = [0, 1, 2]; // 0=Forest, 1=Grassland, 2=Wetland
    // const BIOME_NAMES = ["Forest", "Grassland", "Wetland"]; // Replaced by translation
    const RANKS = [1, 2, 0]; // 1st, 2nd, None

    function togglePlacement(biomeIndex: number, rank: number) {
        if (!activePlayerId) return;
        gameStore.updateNectarPlacement(activePlayerId, biomeIndex, rank);
    }

    // Helper to get players in a specific cell
    function getPlayersInCell(
        players: Player[],
        biomeIndex: number,
        rank: number,
    ) {
        return players.filter((p) => p.nectarPlacements[biomeIndex] === rank);
    }

    function getRowValidation(players: Player[], biomeIndex: number): boolean {
        const c1 = players.filter(
            (p) => p.nectarPlacements[biomeIndex] === 1,
        ).length;
        const c2 = players.filter(
            (p) => p.nectarPlacements[biomeIndex] === 2,
        ).length;
        const totalPlaced = c1 + c2;

        // Rule 0: If nobody is placed, it's valid (all None)
        if (totalPlaced === 0) return true;

        // Rule 1: Must have at least one 1st place if anyone is placed
        if (c1 === 0) return false;

        // Rule 2: Tie for 1st blocks 2nd place
        // If 1 person in 1st -> 2nd available.
        // If 2+ people in 1st -> 2nd blocked (c2 must be 0).
        if (c1 >= 2 && c2 > 0) return false;

        return true;
    }

    const biomeKeys = ["forest", "grassland", "wetland"] as const;
</script>

<div class="shared-grid-container">
    <div class="grid">
        <!-- Header Row -->
        <div class="row header-row">
            <div class="cell-label corner">{$t("biome")}</div>
            <div class="cell-header rank-header rank-1">{$t("rank1")}</div>
            <div class="cell-header rank-header rank-2">{$t("rank2")}</div>
            <div class="cell-header rank-header header-none">{$t("none")}</div>
        </div>

        {#each BIOMES as biomeIndex}
            {@const isValid = getRowValidation($gameStore.players, biomeIndex)}
            <div
                class="row-wrapper"
                class:has-error={!isValid}
                class:row-forest={biomeIndex === 0}
                class:row-grassland={biomeIndex === 1}
                class:row-wetland={biomeIndex === 2}
            >
                <div class="row">
                    <div class="cell-label biome-label">
                        {$t(biomeKeys[biomeIndex])}
                    </div>

                    {#each RANKS as rank}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <div
                            class="cell"
                            class:active-target={activePlayerId &&
                                $gameStore.players.find(
                                    (p) => p.id === activePlayerId,
                                )?.nectarPlacements[biomeIndex] === rank}
                            class:cell-none={rank === 0}
                            class:rank-1-cell={rank === 1}
                            class:rank-2-cell={rank === 2}
                            role="button"
                            tabindex="0"
                            on:click={() => togglePlacement(biomeIndex, rank)}
                        >
                            <div class="dots-container">
                                {#each getPlayersInCell($gameStore.players, biomeIndex, rank) as p (p.id)}
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
        padding: 6px;
        border-radius: 8px;
        border: 2px solid transparent;
        transition:
            border-color 0.2s,
            background-color 0.2s;
        background-color: #fafafa; /* Default fallback */
    }

    /* Biome-specific row backgrounds (Subtle Tints) */
    .row-forest {
        background-color: rgba(76, 175, 80, 0.08); /* Green tint */
    }
    .row-grassland {
        background-color: rgba(255, 193, 7, 0.08); /* Yellow tint */
    }
    .row-wetland {
        background-color: rgba(33, 150, 243, 0.08); /* Blue tint */
    }

    .row-wrapper.has-error {
        background-color: #fff5f5;
        border-color: #ffcccc;
    }

    .row {
        display: grid;
        grid-template-columns: 80px repeat(2, 1fr) 0.8fr;
        gap: 8px;
        align-items: stretch;
    }

    .header-row {
        margin-bottom: 0.5rem;
        /* Match grid columns exactly for the header too if simpler layout */
        /* But header-row is outside the colored wrapper, so keep standard Grid layout */
        grid-template-columns: 80px repeat(2, 1fr) 0.8fr;
        display: grid;
        gap: 8px;
        padding: 0 6px; /* Match wrapper padding horizontal */
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

    .header-none {
        background: #eee;
        color: #777;
        font-weight: 500;
        border-radius: 4px; /* Fix consistency */
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .biome-label {
        font-size: 0.9rem;
        color: #333;
        text-align: left;
        justify-content: flex-start;
        padding-left: 4px;
    }

    .cell {
        background: rgba(
            255,
            255,
            255,
            0.6
        ); /* Translucent to show biome color if desired, or solid white */
        background: #fff;
        border: 2px solid rgba(0, 0, 0, 0.1);
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
        border-color: #ccc;
        background: #fff;
    }

    .cell-none {
        border: 2px dashed #ddd;
        background: rgba(255, 255, 255, 0.5);
    }
    .cell-none:hover {
        border-color: #bbb;
    }

    /* Highlight the cell if it contains the active player */
    .cell.active-target {
        border-width: 2px;
        background-color: white;
        box-shadow: 0 0 0 2px rgba(94, 92, 230, 0.2);
    }

    .cell.active-target.rank-1-cell {
        border-color: #ffd700;
        background-color: rgba(255, 215, 0, 0.15);
    }
    .cell.active-target.rank-2-cell {
        border-color: #c0c0c0;
        background-color: rgba(192, 192, 192, 0.15);
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
