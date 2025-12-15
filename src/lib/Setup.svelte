<script lang="ts">
    import { gameStore } from "./store";
    import { t } from "./i18n";
    import { fade, slide } from "svelte/transition";

    let newName = "";
    // Default to first color
    let selectedColor = "#a3c4dc";

    const colors = [
        "#8FB8DE", // Muted Blue
        "#E5989B", // Muted Red
        "#F2D096", // Muted Yellow
        "#B589D6", // Muted Purple
        "#99C2A2", // Muted Green
        "#E8E6E1", // Off-White
        "#4A4E69", // Muted Black
    ];

    function handleAddPlayer() {
        if (!newName.trim()) return;
        gameStore.addPlayer(newName.trim(), selectedColor);
        newName = "";
        // Optional: cycle to next color for convenience
        const currentIndex = colors.indexOf(selectedColor);
        selectedColor = colors[(currentIndex + 1) % colors.length];
    }

    function removePlayer(id: string) {
        gameStore.removePlayer(id);
    }

    function startGame() {
        if ($gameStore.players.length === 0) return;

        // Randomize start player
        const randomIndex = Math.floor(
            Math.random() * $gameStore.players.length,
        );
        const startPlayer = $gameStore.players[randomIndex];
        gameStore.setStartPlayer(startPlayer.id);

        gameStore.setPhase("SELECTION");
    }
</script>

<div class="setup-container">
    <div class="card add-player-card">
        <h2>{$t("addPlayer")}</h2>

        <div class="input-group">
            <input
                type="text"
                placeholder={$t("playerName")}
                bind:value={newName}
                on:keydown={(e) => e.key === "Enter" && handleAddPlayer()}
            />
        </div>

        <div class="color-picker">
            {#each colors as color}
                <button
                    class="color-option {selectedColor === color
                        ? 'selected'
                        : ''}"
                    style="background-color: {color};"
                    on:click={() => (selectedColor = color)}
                    aria-label="Select color {color}"
                ></button>
            {/each}
        </div>

        <button
            class="btn-primary"
            on:click={handleAddPlayer}
            disabled={!newName.trim()}
        >
            {$t("addPlayer")}
        </button>
    </div>

    <div class="players-list">
        <h3>{$t("players")} ({$gameStore.players.length})</h3>
        {#if $gameStore.players.length === 0}
            <p class="empty-state">{$t("noPlayers")}</p>
        {:else}
            <ul>
                {#each $gameStore.players as player (player.id)}
                    <li class="player-item" transition:slide|local>
                        <div class="player-info">
                            <span
                                class="player-dot"
                                style="background-color: {player.color};"
                            ></span>
                            <span class="player-name">{player.name}</span>
                        </div>
                        <button
                            class="btn-icon"
                            on:click={() => removePlayer(player.id)}
                            aria-label="Remove player"
                        >
                            ✕
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>

    <div class="actions">
        <button
            class="btn-primary start-btn"
            disabled={$gameStore.players.length < 1}
            on:click={startGame}
        >
            {$t("startGame")} →
        </button>
    </div>
</div>

<style>
    .setup-container {
        padding: 0 0.5rem;
    }

    h2,
    h3 {
        margin-bottom: 1rem;
        color: var(--color-text-primary);
    }

    .add-player-card {
        border: 2px solid rgba(0, 0, 0, 0.05);
    }

    .input-group input {
        width: 100%;
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: var(--radius-sm);
        font-size: 1rem;
        margin-bottom: 1rem;
        transition: border-color 0.2s;
    }

    .input-group input:focus {
        outline: none;
        border-color: var(--color-primary-blue);
    }

    .color-picker {
        display: flex;
        gap: 10px;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }

    .color-option {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.1);
        transition:
            transform 0.2s,
            border-color 0.2s;
    }

    .color-option:hover {
        transform: scale(1.1);
    }

    .color-option.selected {
        border-color: #333;
        transform: scale(1.1);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8) inset;
    }

    .players-list {
        margin: 2rem 0;
    }

    .empty-state {
        color: var(--color-text-secondary);
        font-style: italic;
        text-align: center;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.02);
        border-radius: var(--radius-md);
    }

    ul {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .player-item {
        background: white;
        padding: 12px;
        border-radius: var(--radius-md);
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: var(--shadow-sm);
    }

    .player-info {
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

    .player-name {
        font-weight: 600;
    }

    .btn-icon {
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 1.2rem;
        padding: 4px 8px;
    }

    .btn-icon:hover {
        color: var(--color-danger);
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
    }

    .start-btn {
        background: var(--color-text-primary);
        color: white;
    }

    .start-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
        opacity: 0.7;
    }
</style>
