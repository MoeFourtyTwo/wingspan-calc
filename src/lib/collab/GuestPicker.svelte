<script lang="ts">
    import type { Player } from "../store";
    import { t } from "../i18n";
    import Egg from "../ui/Egg.svelte";
    import { swoop } from "../ui/motion";

    interface Props {
        players: Player[];
        /** playerId → deviceId */
        claims: Record<string, string>;
        /** deviceId → label (online phones) */
        devices: Record<string, string>;
        myId: string;
        onchange: (playerIds: string[]) => void;
    }

    let { players, claims, devices, myId, onchange }: Props = $props();

    let mine = $derived(players.filter((p) => claims[p.id] === myId).map((p) => p.id));

    function toggle(id: string) {
        onchange(mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]);
    }
</script>

<ul class="picker">
    {#each players as p, i (p.id)}
        {@const owner = claims[p.id]}
        {@const selected = owner === myId}
        {@const locked = !!owner && !selected}
        <li in:swoop={{ y: 12, delay: 35 * i, duration: 320 }}>
            <button
                class="chip"
                class:selected
                class:locked
                aria-pressed={selected}
                disabled={locked}
                onclick={() => toggle(p.id)}
                style="--pc: {p.color}"
            >
                <span class="egg"><Egg color={p.color} size={selected ? 30 : 26} /></span>
                <span class="text">
                    <span class="name">{p.name}</span>
                    {#if locked}
                        <span class="owner">
                            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
                            {$t("guestLockedBy", { name: devices[owner] ?? $t("anotherPhone") })}
                        </span>
                    {/if}
                </span>
                <span class="check" aria-hidden="true">
                    {#if selected}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    {/if}
                </span>
            </button>
        </li>
    {/each}
</ul>

<style>
    .picker {
        list-style: none;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
    }

    .chip {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 56px;
        padding: 6px 10px 6px 8px;
        border-radius: 18px;
        text-align: left;
        background: #fff;
        border: 2px solid var(--line);
        box-shadow: 0 3px 0 rgba(110, 80, 50, 0.14);
    }

    .chip:hover:not(:disabled) .egg {
        animation: wobble 0.45s ease;
    }

    .chip:active:not(:disabled) {
        transform: scale(0.94);
    }

    .chip.selected {
        border-color: var(--forest);
        background: #e3f1ec;
        box-shadow: 0 3px 0 var(--forest);
        transform: translateY(-2px);
    }

    .chip.locked {
        opacity: 1;
        background: var(--paper);
        border-style: dashed;
        box-shadow: none;
        cursor: not-allowed;
    }

    .chip.locked .egg {
        filter: grayscale(0.6);
        opacity: 0.6;
    }

    .egg {
        display: grid;
        place-items: center;
        width: 30px;
        flex-shrink: 0;
        transform-origin: 50% 90%;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
    }

    .name {
        font-weight: 800;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .owner {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--ink-soft);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .check {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        color: #fff;
        background: transparent;
        transition: background-color 0.2s;
    }

    .selected .check {
        background: var(--forest);
        animation: tick-in 0.4s var(--spring);
    }

    @keyframes tick-in {
        from {
            transform: scale(0) rotate(-40deg);
        }
    }
</style>
