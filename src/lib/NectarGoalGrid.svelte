<script lang="ts">
    import { gameStore, validateNectarRow } from "./store";
    import { HABITATS, NECTAR_POINTS } from "./rules/scoring";
    import { t } from "./i18n";
    import Egg from "./ui/Egg.svelte";
    import { sendEgg, receiveEgg } from "./ui/placement";

    interface Props {
        activePlayerId: string | null;
    }

    let { activePlayerId }: Props = $props();

    const RANKS = [1, 2, 0]; // 1st, 2nd, none
    const rankKey = { 1: "rank1", 2: "rank2", 0: "none" } as const;

    let players = $derived($gameStore.players);
    let active = $derived(players.find((p) => p.id === activePlayerId));

    function place(habitat: number, rank: number) {
        if (!activePlayerId) return;
        gameStore.updateNectarPlacement(activePlayerId, habitat, rank);
    }
</script>

<div class="grid-card">
    <div class="row head" aria-hidden="true">
        <span class="corner">{$t("biome")}</span>
        {#each RANKS as rank}
            <span class="rank-head r{rank}">{$t(rankKey[rank as 0 | 1 | 2])}</span>
        {/each}
    </div>

    {#each HABITATS as habitat, h}
        {@const valid = validateNectarRow(players, h)}
        <div class="row habitat-{habitat}" class:invalid={!valid}>
            <span class="habitat-label">
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    {#if habitat === "forest"}
                        <path d="M12 2L5 13h4l-3 5h12l-3-5h4z" fill="currentColor" /><rect x="11" y="18" width="2" height="4" fill="currentColor" />
                    {:else if habitat === "grassland"}
                        <path d="M4 21c1-6 2-9 4-12M10 21c0-6 1-11 3-15M16 21c0-5 1-8 4-11M7 21c0-4-1-7-3-9M13 21c1-4 2-6 5-7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
                    {:else}
                        <path d="M2 9c3-3 5-3 8 0s5 3 8 0 3-2 4-2M2 15c3-3 5-3 8 0s5 3 8 0 3-2 4-2" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" />
                    {/if}
                </svg>
                <span>{$t(habitat)}</span>
            </span>
            {#each RANKS as rank}
                <button
                    class="cell r{rank}"
                    class:target={active?.nectarPlacements[h] === rank}
                    disabled={!activePlayerId}
                    aria-pressed={active?.nectarPlacements[h] === rank}
                    aria-label={$t("placeIn", {
                        name: active?.name ?? "",
                        row: $t(habitat),
                        rank: $t(rankKey[rank as 0 | 1 | 2]),
                    })}
                    onclick={() => place(h, rank)}
                >
                    {#if rank > 0}<span class="pts">{NECTAR_POINTS[rank - 1]}</span>{/if}
                    <span class="eggs">
                        {#each players.filter((p) => p.nectarPlacements[h] === rank) as p (p.id)}
                            <span
                                class="egg"
                                class:is-active={p.id === activePlayerId}
                                in:receiveEgg={{ key: `n-${p.id}-${h}` }}
                                out:sendEgg={{ key: `n-${p.id}-${h}` }}
                                title={p.name}
                            >
                                <Egg color={p.color} size={rank === 0 ? 13 : 16} speckled={false} />
                            </span>
                        {/each}
                    </span>
                </button>
            {/each}
        </div>
    {/each}
</div>

<style>
    .grid-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: var(--card);
        border: 1.5px solid var(--line);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
    }

    .row {
        display: grid;
        grid-template-columns: 92px 1fr 1fr 0.8fr;
        gap: 6px;
        padding: 5px;
        border-radius: 14px;
        border: 2px solid transparent;
        transition:
            background-color 0.2s,
            border-color 0.2s;
    }

    .head {
        padding: 0 5px;
    }

    .habitat-forest {
        background: rgba(47, 125, 109, 0.16);
        --hab: var(--forest-deep);
    }
    .habitat-grassland {
        background: rgba(217, 167, 43, 0.2);
        --hab: var(--grassland-deep);
    }
    .habitat-wetland {
        background: rgba(59, 127, 182, 0.17);
        --hab: var(--wetland-deep);
    }

    .row.invalid {
        background: #fbe4df;
        border-color: #e8a99f;
        animation: wiggle 0.4s ease;
    }

    .corner {
        font-size: 0.75rem;
        font-weight: 800;
        color: var(--ink-soft);
        align-self: center;
    }

    .rank-head {
        text-align: center;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 0.85rem;
        padding: 3px 0;
        border-radius: 999px;
        color: #3a2e12;
    }

    .rank-head.r1 {
        background: #f2cf55;
    }
    .rank-head.r2 {
        background: #d5d8d6;
    }
    .rank-head.r0 {
        color: var(--ink-soft);
        border: 1.5px dashed var(--line);
    }

    .habitat-label {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--hab);
        font-weight: 800;
        font-size: 0.8rem;
        line-height: 1.1;
        min-width: 0;
        hyphens: auto;
        -webkit-hyphens: auto;
    }

    .habitat-label svg {
        flex-shrink: 0;
    }

    .cell {
        position: relative;
        min-height: 52px;
        padding: 14px 3px 4px;
        border-radius: 12px;
        background: #fff;
        border: 2px solid rgba(110, 80, 50, 0.16);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .cell:hover:not(:disabled) {
        transform: translateY(-2px);
        border-color: rgba(110, 80, 50, 0.35);
    }

    .cell:active:not(:disabled) {
        transform: scale(0.92);
    }

    .cell:disabled {
        cursor: default;
    }

    .cell.r0 {
        border-style: dashed;
        background: rgba(255, 255, 255, 0.55);
    }

    .cell.target.r1 {
        border-color: #e0b52c;
        background: #fdf3cf;
    }
    .cell.target.r2 {
        border-color: #a9adab;
        background: #f1f2f1;
    }
    .cell.target.r0 {
        border-color: var(--ink-soft);
    }

    .pts {
        position: absolute;
        top: 2px;
        left: 6px;
        font-family: var(--font-display);
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--ink-soft);
    }

    .eggs {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        justify-content: center;
    }

    .egg {
        display: block;
        opacity: 0.75;
        transition: transform 0.25s var(--spring);
    }

    .egg.is-active {
        opacity: 1;
        transform: scale(1.25) translateY(-1px);
    }
</style>
