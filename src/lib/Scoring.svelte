<script lang="ts">
    import {
        gameStore,
        CATEGORIES,
        CATEGORY_LABELS,
        type Category,
    } from "./store";
    import { slide } from "svelte/transition";
    import RoundGoalGrid from "./RoundGoalGrid.svelte";

    let expandedPlayerId: string | null = null;

    // Computed properties
    $: currentCategoryIndex = $gameStore.currentScoringCategoryIndex;
    $: currentCategory = CATEGORIES[currentCategoryIndex];
    $: label = CATEGORY_LABELS[currentCategory];
    $: isFirstCategory = currentCategoryIndex === 0;
    $: isLastCategory = currentCategoryIndex === CATEGORIES.length - 1;

    function handleScoreChange(playerId: string, val: number) {
        // Ensure value is non-negative
        const safeVal = Math.max(0, val);
        gameStore.updateScore(playerId, currentCategory, safeVal);
    }

    function handleNext() {
        gameStore.nextCategory();
    }

    function handleBack() {
        gameStore.prevCategory();
    }
    function handleReset() {
        gameStore.resetAllRoundPlacements();
    }
</script>

<div class="scoring-container">
    <div class="header">
        <button class="btn-secondary back-btn" on:click={handleBack}>
            ← Back
        </button>
        <div class="progress-indicator">
            <span>{currentCategoryIndex + 1} / {CATEGORIES.length}</span>
        </div>
    </div>

    <div class="category-header">
        <h2>{label}</h2>
        <!-- Optional: Add icon/description here -->
    </div>

    <div class="players-inputs">
        {#if currentCategory === "round_goals"}
            <!-- Shared Round Goal UI -->
            <div class="round-goals-wrapper" transition:slide|local>
                <div class="player-selector">
                    <div class="selector-header">
                        <div class="selector-label">
                            Select Player to Place:
                        </div>
                        <button
                            class="reset-icon-btn"
                            on:click={handleReset}
                            title="Reset Grid"
                        >
                            ↺
                        </button>
                    </div>
                    <div class="avatars-scroll">
                        {#each $gameStore.players as player (player.id)}
                            <button
                                class="avatar-btn"
                                class:selected={expandedPlayerId === player.id}
                                on:click={() => (expandedPlayerId = player.id)}
                                style="--player-color: {player.color}"
                            >
                                <span class="avatar-dot"></span>
                                <span class="avatar-name">{player.name}</span>
                            </button>
                        {/each}
                    </div>
                </div>

                <div class="grid-section">
                    <p class="instruction">
                        {#if expandedPlayerId}
                            Tap grid cells to place <strong
                                >{$gameStore.players.find(
                                    (p) => p.id === expandedPlayerId,
                                )?.name}</strong
                            >
                        {:else}
                            Select a player above to start placing
                        {/if}
                    </p>
                    <RoundGoalGrid activePlayerId={expandedPlayerId} />
                </div>
            </div>
        {:else}
            <!-- Standard Numeric Inputs (Other Categories) -->
            {#each $gameStore.players as player (player.id)}
                <div class="player-input-card" transition:slide|local>
                    <div class="player-label">
                        <span
                            class="player-dot"
                            style="background-color: {player.color}"
                        ></span>
                        <span class="player-name">{player.name}</span>
                    </div>

                    <div class="input-wrapper">
                        <input
                            type="number"
                            min="0"
                            value={player.scores[currentCategory]}
                            on:input={(e) =>
                                handleScoreChange(
                                    player.id,
                                    Number(e.currentTarget.value),
                                )}
                            on:keydown={(e) => {
                                if (["e", "E", "+", "-"].includes(e.key)) {
                                    e.preventDefault();
                                }
                            }}
                            placeholder="0"
                        />
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <div class="actions">
        <button class="btn-primary next-btn" on:click={handleNext}>
            {isLastCategory ? "Finish Scoring" : "Next Category →"}
        </button>
    </div>
</div>

<style>
    .scoring-container {
        padding: 0 0.5rem;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .back-btn {
        border: none;
        background: transparent;
        color: var(--color-text-secondary);
        padding: 0;
    }

    .back-btn:hover {
        color: var(--color-text-primary);
        background: transparent;
    }

    .progress-indicator {
        font-size: 0.9rem;
        color: var(--color-text-secondary);
        font-weight: 600;
        background: rgba(0, 0, 0, 0.05);
        padding: 4px 12px;
        border-radius: 20px;
    }

    .category-header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .category-header h2 {
        font-size: 1.5rem;
        color: var(--color-text-primary);
    }

    .players-inputs {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 2rem;
    }

    .player-input-card {
        background: white;
        padding: 16px;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .player-label {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .player-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
    }

    .player-name {
        font-weight: 600;
        font-size: 1.1rem;
    }

    .input-wrapper input {
        width: 80px;
        padding: 8px;
        text-align: center;
        font-size: 1.2rem;
        border: 2px solid #ddd;
        border-radius: var(--radius-sm);
        font-weight: 700;
    }

    .input-wrapper input:focus {
        outline: none;
        border-color: var(--color-primary-blue);
    }

    .actions {
        position: sticky;
        bottom: 20px;
        background: linear-gradient(
            to top,
            var(--color-bg-mesh) 80%,
            transparent
        );
        padding-top: 20px;
    }

    /* Shared Round Goal UI Styles */
    .round-goals-wrapper {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .player-selector {
        background: white;
        padding: 12px;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
    }

    .selector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .selector-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        margin-bottom: 0;
    }

    .reset-icon-btn {
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        font-size: 1.2rem;
        padding: 0 4px;
        cursor: pointer;
        line-height: 1;
        border-radius: 4px;
        transition:
            color 0.2s,
            background 0.2s;
    }

    .reset-icon-btn:hover {
        color: var(--color-text-primary);
        background: rgba(0, 0, 0, 0.05);
    }

    .avatars-scroll {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 4px;
    }

    .avatar-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        background: none;
        border: 2px solid transparent;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        min-width: 60px;
        transition: all 0.2s;
    }

    .avatar-btn:hover {
        background: rgba(0, 0, 0, 0.03);
    }

    .avatar-btn.selected {
        background: rgba(94, 92, 230, 0.1);
        border-color: var(--color-primary-blue);
    }

    .avatar-dot {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: var(--player-color);
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .avatar-name {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-text-primary);
        white-space: nowrap;
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .grid-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .instruction {
        text-align: center;
        font-size: 0.9rem;
        color: var(--color-text-secondary);
        margin: 0;
    }
</style>
