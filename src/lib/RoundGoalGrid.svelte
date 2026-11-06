<script lang="ts">
    import { gameStore, validateRoundGoalsRow } from "./store";
    import { ROUND_GOAL_POINTS } from "./rules/scoring";
    import { t, language } from "./i18n";
    import { get } from "svelte/store";
    import { sharedSetupPrefs } from "./setup/setupPrefs";
    import { goalCaptions } from "./setup/setupRecord";
    import Egg from "./ui/Egg.svelte";
    import { sendEgg, receiveEgg } from "./ui/placement";

    interface Props {
        activePlayerId: string | null;
    }

    let { activePlayerId }: Props = $props();

    const ROUNDS = [0, 1, 2, 3];
    const RANKS = [1, 2, 3, 0]; // 1st, 2nd, 3rd, none
    const rankKey = { 1: "rank1", 2: "rank2", 3: "rank3", 0: "none" } as const;

    let players = $derived($gameStore.players);
    let active = $derived(players.find((p) => p.id === activePlayerId));

    // Goals drawn with the setup helper, in the language of the cards on the table.
    const setupPrefs = sharedSetupPrefs(get(language));
    let captions = $derived(goalCaptions($gameStore.setup, $setupPrefs.edition));

    function place(round: number, rank: number) {
        if (!activePlayerId) return;
        gameStore.updateRoundPlacement(activePlayerId, round, rank);
    }
</script>

<div class="grid-card">
    <div class="row head" aria-hidden="true">
        <span class="corner">{$t("round")}</span>
        {#each RANKS as rank}
            <span class="rank-head r{rank}">{$t(rankKey[rank as 0 | 1 | 2 | 3])}</span>
        {/each}
    </div>

    {#each ROUNDS as round}
        {@const valid = validateRoundGoalsRow(players, round)}
        {@const caption = captions[round]}
        <div class="row" class:invalid={!valid} class:has-caption={!!caption}>
            <span class="round-label">R{round + 1}</span>
            {#if caption}
                <span class="caption" title={$t("setupGoalOfRound", { n: round + 1, goal: caption })}>{caption}</span>
            {/if}
            {#each RANKS as rank}
                {@const pts = rank > 0 ? ROUND_GOAL_POINTS[round][rank - 1] : null}
                <button
                    class="cell r{rank}"
                    class:target={active?.roundPlacements[round] === rank}
                    disabled={!activePlayerId}
                    aria-pressed={active?.roundPlacements[round] === rank}
                    aria-label={$t("placeIn", {
                        name: active?.name ?? "",
                        row: `${$t("round")} ${round + 1}`,
                        rank: $t(rankKey[rank as 0 | 1 | 2 | 3]),
                    })}
                    onclick={() => place(round, rank)}
                >
                    {#if pts !== null}<span class="pts">{pts}</span>{/if}
                    <span class="eggs">
                        {#each players.filter((p) => p.roundPlacements[round] === rank) as p (p.id)}
                            <span
                                class="egg"
                                class:is-active={p.id === activePlayerId}
                                in:receiveEgg={{ key: `${p.id}-${round}` }}
                                out:sendEgg={{ key: `${p.id}-${round}` }}
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
        /* green goal board */
        background-image: linear-gradient(135deg, rgba(47, 125, 109, 0.08), transparent 60%);
    }

    .row {
        display: grid;
        grid-template-columns: 34px repeat(3, 1fr) 0.8fr;
        gap: 6px;
        padding: 3px;
        border-radius: 12px;
        border: 2px solid transparent;
        transition:
            background-color 0.2s,
            border-color 0.2s;
    }

    /* Drawn goal as a small first line; the round badge spans both lines. */
    .row.has-caption {
        row-gap: 2px;
    }

    .row.has-caption .round-label {
        grid-row: span 2;
    }

    .caption {
        grid-column: 2 / -1;
        min-width: 0;
        padding: 0 4px;
        font-size: 0.74rem;
        font-weight: 700;
        line-height: 1.25;
        color: var(--forest-deep);
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
    }

    .row.invalid {
        background: #fbe4df;
        border-color: #e8a99f;
        animation: wiggle 0.4s ease;
    }

    .head {
        padding-bottom: 0;
    }

    .corner {
        font-size: 0.7rem;
        font-weight: 800;
        color: var(--ink-soft);
        align-self: center;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
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
    .rank-head.r3 {
        background: #d99b62;
    }
    .rank-head.r0 {
        background: transparent;
        color: var(--ink-soft);
        border: 1.5px dashed var(--line);
    }

    .round-label {
        display: grid;
        place-items: center;
        font-family: var(--font-display);
        font-weight: 600;
        color: #fff;
        background: var(--forest);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        align-self: center;
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
        background: rgba(255, 255, 255, 0.5);
    }

    .cell.target.r1 {
        border-color: #e0b52c;
        background: #fdf3cf;
    }
    .cell.target.r2 {
        border-color: #a9adab;
        background: #f1f2f1;
    }
    .cell.target.r3 {
        border-color: #c4824a;
        background: #f8e6d6;
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
