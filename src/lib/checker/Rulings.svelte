<script lang="ts">
    import { t } from "../i18n";
    import type { Ruling } from "./types";

    let { rulings }: { rulings: Ruling[] } = $props();
</script>

{#if rulings.length}
    <details class="rulings">
        <summary>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
            <span>{$t("chkRulings")}</span>
            <span class="n">{rulings.length}</span>
            <svg class="caret" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <ul>
            {#each rulings as r, i (i)}
                <li>
                    <p>{r.text}</p>
                    {#if r.source}
                        <a href={r.source} target="_blank" rel="noopener noreferrer">
                            {$t("chkSource")}
                            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
                        </a>
                    {/if}
                </li>
            {/each}
        </ul>
    </details>
{/if}

<style>
    .rulings {
        margin-top: 14px;
        border-radius: var(--radius-sm);
        background: rgba(217, 167, 43, 0.1);
    }

    summary {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--twig-deep);
        cursor: pointer;
        list-style: none;
    }

    summary::-webkit-details-marker {
        display: none;
    }

    .n {
        display: inline-grid;
        place-items: center;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        background: var(--grassland);
        color: #3a2c06;
        font-size: 0.8rem;
    }

    .caret {
        margin-left: auto;
        transition: transform 0.3s var(--spring);
    }

    details[open] .caret {
        transform: rotate(180deg);
    }

    ul {
        list-style: none;
        display: grid;
        gap: 8px;
        padding: 0 8px 10px;
    }

    li {
        padding: 8px 12px 8px 14px;
        border-radius: var(--radius-sm);
        background: rgba(255, 250, 240, 0.85);
        border-left: 4px solid var(--grassland);
        font-size: 0.92rem;
        white-space: pre-line;
        overflow-wrap: anywhere;
        animation: drop-in 0.3s var(--snap) both;
    }

    @keyframes drop-in {
        from {
            transform: translateY(-6px);
            opacity: 0;
        }
    }

    a {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 32px;
        margin-top: 2px;
        color: var(--wetland-deep);
        font-weight: 700;
        font-size: 0.85rem;
    }
</style>
