<script lang="ts">
    import { gameStore, type RoundGoalMode } from "./store";
    import { MAX_PLAYERS } from "./rules/scoring";
    import { t } from "./i18n";
    import { slide } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { onMount } from "svelte";
    import Egg from "./ui/Egg.svelte";
    import CategoryIcon from "./ui/CategoryIcon.svelte";
    import { swoop, poof, ms } from "./ui/motion";
    import CollabCard from "./collab/CollabCard.svelte";

    const colors = [
        "#7fb2d9", // blue
        "#e0827e", // red
        "#f0c75e", // yellow
        "#a985cf", // purple
        "#8cc097", // green
        "#f3efe6", // white
        "#4a4e69", // black
    ];

    let newName = $state("");
    let selectedColor = $state(colors[0]);

    interface RecentPlayer {
        name: string;
        color: string;
    }

    let recentPlayers: RecentPlayer[] = $state([]);

    let players = $derived($gameStore.players);
    let options = $derived($gameStore.options);
    let isFull = $derived(players.length >= MAX_PLAYERS);

    onMount(() => {
        try {
            const stored = localStorage.getItem("wingspan_recent_players");
            if (stored) recentPlayers = JSON.parse(stored);
        } catch (e) {
            console.error("Failed to load recent players", e);
        }
        selectedColor = nextFreeColor(selectedColor);
    });

    /** First colour (starting at `from`) that no player in the nest uses yet. */
    function nextFreeColor(from: string): string {
        const used = new Set($gameStore.players.map((p) => p.color));
        const start = Math.max(0, colors.indexOf(from));
        for (let i = 0; i < colors.length; i++) {
            const c = colors[(start + i) % colors.length];
            if (!used.has(c)) return c;
        }
        return from;
    }

    function saveRecentPlayers() {
        const current = players.map((p) => ({ name: p.name, color: p.color }));
        const unique = new Map<string, RecentPlayer>();
        [...current, ...recentPlayers].forEach((p) => {
            if (!unique.has(p.name)) unique.set(p.name, p);
        });
        try {
            localStorage.setItem(
                "wingspan_recent_players",
                JSON.stringify(Array.from(unique.values()).slice(0, 10)),
            );
        } catch (e) {
            console.error("Failed to save recent players", e);
        }
    }

    function clearRecent() {
        try {
            localStorage.removeItem("wingspan_recent_players");
        } catch {
            /* ignore */
        }
        recentPlayers = [];
    }

    function addRecentPlayer(p: RecentPlayer) {
        if (isFull || players.some((existing) => existing.name === p.name)) return;
        gameStore.addPlayer(p.name, p.color);
        selectedColor = nextFreeColor(selectedColor);
    }

    function handleAddPlayer() {
        const name = newName.trim();
        if (!name || isFull) return;
        gameStore.addPlayer(name, selectedColor);
        newName = "";
        selectedColor = nextFreeColor(selectedColor);
    }

    function startGame() {
        if (players.length === 0) return;
        saveRecentPlayers();
        const startPlayer = players[Math.floor(Math.random() * players.length)];
        gameStore.setStartPlayer(startPlayer.id);
        gameStore.setPhase("SELECTION");
    }

    const setMode = (roundGoalMode: RoundGoalMode) => gameStore.setOptions({ roundGoalMode });
</script>

<div class="setup screen">
    <div class="toolbar">
        <button
            class="btn-ghost"
            onclick={() => gameStore.setPhase("STATS")}
            aria-label={$t("history")}
        >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
                <path d="M4 21V5M8 7h7M8 11h5" />
            </svg>
            <span>{$t("history")}</span>
        </button>
    </div>

    <!-- Add player -->
    <section class="card taped add-card" in:swoop={{ y: 18, delay: 60 }}>
        <h2 class="section-title">{$t("addPlayer")}</h2>

        <div class="name-row">
            <Egg color={selectedColor} size={34} class="preview-egg" />
            <input
                type="text"
                placeholder={$t("playerName")}
                aria-label={$t("playerName")}
                maxlength="20"
                bind:value={newName}
                disabled={isFull}
                onkeydown={(e) => e.key === "Enter" && handleAddPlayer()}
            />
        </div>

        <div class="color-picker" role="radiogroup" aria-label={$t("eggColor", { n: "" }).trim()}>
            {#each colors as color, i}
                {@const taken = players.some((p) => p.color === color)}
                <button
                    class="color-option"
                    class:selected={selectedColor === color}
                    class:taken
                    role="radio"
                    aria-checked={selectedColor === color}
                    aria-label={$t("eggColor", { n: i + 1 })}
                    onclick={() => (selectedColor = color)}
                >
                    <Egg {color} size={26} />
                </button>
            {/each}
        </div>

        {#if recentPlayers.length > 0}
            <div class="recent" transition:slide|local={{ duration: ms(220) }}>
                <div class="recent-header">
                    <span class="label-hand">{$t("recentPlayers")}</span>
                    <button class="text-btn" onclick={clearRecent}>{$t("clearHistory")}</button>
                </div>
                <div class="chips">
                    {#each recentPlayers as p, i}
                        <button
                            class="chip"
                            in:swoop={{ y: 10, delay: 30 * i, duration: 300 }}
                            onclick={() => addRecentPlayer(p)}
                            disabled={isFull || players.some((gp) => gp.name === p.name)}
                        >
                            <Egg color={p.color} size={14} speckled={false} />
                            {p.name}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <button class="btn-primary add-btn" onclick={handleAddPlayer} disabled={!newName.trim() || isFull}>
            <span aria-hidden="true">+</span>
            {$t("addPlayer")}
        </button>
        {#if isFull}
            <p class="full-hint" role="status" transition:slide|local={{ duration: ms(200) }}>
                {$t("maxPlayersReached", { n: MAX_PLAYERS })}
            </p>
        {/if}
    </section>

    <!-- The nest -->
    <section class="nest-section">
        <h3 class="section-title">
            {$t("players")}
            <span class="count">{players.length}/{MAX_PLAYERS}</span>
        </h3>
        {#if players.length === 0}
            <p class="empty" in:swoop={{ y: 8 }}>
                <svg viewBox="0 0 120 40" width="120" height="40" aria-hidden="true">
                    <ellipse cx="60" cy="26" rx="52" ry="12" fill="#8a6142" />
                    <ellipse cx="60" cy="22" rx="40" ry="8" fill="#5e4029" />
                    <path d="M10 26 Q60 44 110 26 M14 22 Q60 40 106 22 M18 30 Q60 46 102 30" stroke="#a47b52" stroke-width="2" fill="none" />
                </svg>
                <span>{$t("nestEmpty")}</span>
            </p>
        {:else}
            <ul class="players">
                {#each players as player, i (player.id)}
                    <li
                        class="player"
                        animate:flip={{ duration: ms(260) }}
                        in:swoop={{ x: -30, y: 0, rotate: -4, delay: 40 * Math.min(i, 3), duration: 360 }}
                        out:poof
                    >
                        <span class="egg-wrap"><Egg color={player.color} size={30} /></span>
                        <span class="player-name">{player.name}</span>
                        <button
                            class="icon-btn remove"
                            onclick={() => gameStore.removePlayer(player.id)}
                            aria-label={$t("removePlayerNamed", { name: player.name })}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </section>

    <!-- Shared game: host for other phones, or join one -->
    <CollabCard playerCount={players.length} />

    <!-- Options -->
    <section class="card options" in:swoop={{ y: 18, delay: 140 }}>
        <h3 class="section-title">{$t("gameOptions")}</h3>

        <label class="toggle-row">
            <CategoryIcon category="nectar" size={28} />
            <span class="toggle-text">
                <span class="toggle-title">{$t("oceania")}</span>
                <span class="toggle-hint">{$t("oceaniaHint")}</span>
            </span>
            <input
                type="checkbox"
                class="switch"
                checked={options.oceania}
                onchange={(e) => gameStore.setOptions({ oceania: e.currentTarget.checked })}
            />
        </label>

        <label class="toggle-row">
            <CategoryIcon category="hummingbirds" size={28} />
            <span class="toggle-text">
                <span class="toggle-title">{$t("americas")}</span>
                <span class="toggle-hint">{$t("americasHint")}</span>
            </span>
            <input
                type="checkbox"
                class="switch"
                checked={options.americas}
                onchange={(e) => gameStore.setOptions({ americas: e.currentTarget.checked })}
            />
        </label>

        <fieldset class="board-side">
            <legend class="toggle-title">{$t("roundGoalSide")}</legend>
            <div class="segmented">
                <button
                    class="seg green"
                    class:active={options.roundGoalMode === "competitive"}
                    aria-pressed={options.roundGoalMode === "competitive"}
                    onclick={() => setMode("competitive")}
                >
                    <span class="seg-title">{$t("competitive")}</span>
                    <span class="seg-hint">{$t("competitiveHint")}</span>
                </button>
                <button
                    class="seg blue"
                    class:active={options.roundGoalMode === "casual"}
                    aria-pressed={options.roundGoalMode === "casual"}
                    onclick={() => setMode("casual")}
                >
                    <span class="seg-title">{$t("casual")}</span>
                    <span class="seg-hint">{$t("casualHint")}</span>
                </button>
            </div>
        </fieldset>
    </section>

    <div class="actions sticky-actions">
        <button class="btn-primary start-btn" disabled={players.length < 1} onclick={startGame}>
            {$t("startGame")}
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
        </button>
    </div>
</div>

<style>
    .setup {
        position: relative;
    }

    .toolbar {
        display: flex;
        justify-content: flex-end;
        margin: -4px 0 10px;
    }

    .add-card {
        margin-top: 8px;
    }

    .name-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
    }

    .name-row :global(.preview-egg) {
        animation: wobble 0.5s ease;
    }

    .name-row input {
        flex: 1;
        min-width: 0;
        padding: 12px 14px;
        font-size: 1.05rem;
        border: 2px solid var(--line);
        border-radius: var(--radius-sm);
        background: #fff;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }

    .name-row input:focus {
        outline: none;
        border-color: var(--forest);
        box-shadow: 0 0 0 4px rgba(47, 125, 109, 0.15);
    }

    .color-picker {
        display: flex;
        justify-content: space-between;
        gap: 4px;
        margin-bottom: 16px;
    }

    .color-option {
        display: grid;
        place-items: center;
        width: 42px;
        height: 48px;
        border-radius: 12px;
        border: 2px solid transparent;
    }

    .color-option:hover {
        transform: translateY(-3px) rotate(-6deg);
    }

    .color-option.selected {
        border-color: var(--forest);
        background: rgba(47, 125, 109, 0.1);
        transform: translateY(-4px) scale(1.08);
    }

    .color-option.taken:not(.selected) {
        opacity: 0.4;
    }

    .recent {
        margin-bottom: 14px;
    }

    .recent-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .text-btn {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--ink-soft);
        text-decoration: underline;
        padding: 6px 4px;
    }

    .text-btn:hover {
        color: var(--berry);
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 4px 12px 4px 8px;
        border-radius: 999px;
        background: var(--paper);
        border: 1.5px solid var(--line);
        font-size: 0.9rem;
    }

    .chip:hover:not(:disabled) {
        transform: translateY(-2px) rotate(-2deg);
    }

    .chip:active:not(:disabled) {
        transform: scale(0.92);
    }

    .chip:disabled {
        opacity: 0.45;
        text-decoration: line-through;
    }

    .full-hint {
        margin-top: 10px;
        text-align: center;
        font-weight: 700;
        color: var(--berry);
        font-size: 0.9rem;
    }

    .nest-section {
        margin: 10px 0 18px;
    }

    .count {
        margin-left: auto;
        font-family: var(--font-hand);
        font-size: 1.3rem;
        color: var(--twig);
    }

    .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 14px;
        text-align: center;
        font-family: var(--font-hand);
        font-size: 1.35rem;
        color: var(--ink-soft);
        border: 2px dashed var(--line);
        border-radius: var(--radius-md);
    }

    .players {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        border-radius: 22px;
        /* woven-nest look */
        background:
            repeating-linear-gradient(
                -20deg,
                rgba(94, 64, 41, 0.18) 0 3px,
                transparent 3px 9px
            ),
            repeating-linear-gradient(
                25deg,
                rgba(138, 97, 66, 0.2) 0 2px,
                transparent 2px 11px
            ),
            #c9a27a;
        box-shadow:
            inset 0 4px 10px rgba(60, 35, 15, 0.35),
            0 2px 0 rgba(110, 80, 50, 0.2);
    }

    .player {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 6px 6px 12px;
        background: var(--card);
        border-radius: 14px;
        box-shadow: 0 2px 0 rgba(94, 64, 41, 0.35);
    }

    .egg-wrap {
        display: grid;
        transform-origin: 50% 90%;
    }

    .player:hover .egg-wrap {
        animation: wobble 0.5s ease;
    }

    .player-name {
        flex: 1;
        min-width: 0;
        font-weight: 800;
        font-size: 1.1rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .remove:hover {
        color: var(--berry);
    }

    .board-side {
        border: none;
        padding-top: 12px;
    }

    .board-side legend {
        margin-bottom: 8px;
        float: left;
        width: 100%;
    }

    .segmented {
        clear: both;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .seg {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        padding: 10px 12px;
        text-align: left;
        border-radius: 14px;
        border: 2px solid var(--line);
        background: #fff;
    }

    .seg:active {
        transform: scale(0.95);
    }

    .seg-title {
        font-family: var(--font-display);
        font-weight: 600;
    }

    .seg-hint {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--ink-soft);
        line-height: 1.25;
    }

    .seg.green.active {
        border-color: var(--forest);
        background: #e3f1ec;
        box-shadow: 0 3px 0 var(--forest);
        transform: translateY(-2px);
    }

    .seg.blue.active {
        border-color: var(--wetland);
        background: #e3eef8;
        box-shadow: 0 3px 0 var(--wetland);
        transform: translateY(-2px);
    }

    .start-btn {
        font-size: 1.25rem;
        min-height: 58px;
    }

    .start-btn:not(:disabled) :global(svg) {
        animation: nudge 1.4s ease-in-out infinite;
    }

    @keyframes nudge {
        0%,
        100% {
            transform: translateX(0);
        }
        50% {
            transform: translateX(4px);
        }
    }
</style>
