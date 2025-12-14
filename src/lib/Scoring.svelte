<script lang="ts">
    import {
        gameStore,
        CATEGORIES,
        CATEGORY_LABELS,
        type Category,
    } from "./store";
    import { slide } from "svelte/transition";

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
</style>
