<script lang="ts">
    import { t, type TranslationKey } from "../i18n";
    import type { Verdict } from "./rules";

    interface Props {
        verdict: Verdict;
        /** Icon only (the label is kept for screen readers). */
        compact?: boolean;
    }

    let { verdict, compact = false }: Props = $props();

    const KEY: Record<Verdict, TranslationKey> = {
        yes: "chkV_yes",
        maybe: "chkV_maybe",
        no: "chkV_no",
        unknown: "chkV_unknown",
        "n/a": "chkV_na",
    };
    const CLS: Record<Verdict, string> = { yes: "yes", maybe: "maybe", no: "no", unknown: "unknown", "n/a": "unknown" };
</script>

{#key verdict}
    <span class="badge {CLS[verdict]}" class:compact>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
            {#if verdict === "yes"}
                <path d="M5 12.5l4.5 4.5L19 7.5" />
            {:else if verdict === "maybe"}
                <path d="M4 14c2.5-4 5-4 8 0s5.5 4 8 0" />
            {:else if verdict === "no"}
                <path d="M7 7l10 10M17 7L7 17" />
            {:else}
                <path d="M9 9.5a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1-1.2 1.8v.5" /><path d="M12 18h.01" />
            {/if}
        </svg>
        <span class:visually-hidden={compact}>{$t(KEY[verdict])}</span>
    </span>
{/key}

<style>
    .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex: none;
        padding: 3px 10px 3px 7px;
        border-radius: 999px;
        font-family: var(--font-display);
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        color: #fff;
        background: var(--v);
        box-shadow: 0 2px 0 var(--v-edge);
        animation: spring-in 0.42s var(--spring) both;
    }

    .badge.compact {
        padding: 4px;
    }

    .yes {
        --v: var(--forest);
        --v-edge: var(--forest-deep);
    }

    .maybe {
        --v: var(--gold);
        --v-edge: var(--grassland-deep);
        color: #3a2c06;
    }

    .no {
        --v: var(--berry);
        --v-edge: #8e3a32;
    }

    .unknown {
        --v: #8d8b80;
        --v-edge: #66645b;
        white-space: normal;
    }

    @keyframes spring-in {
        0% {
            transform: scale(0.3) rotate(-12deg);
            opacity: 0;
        }
        60% {
            opacity: 1;
        }
        100% {
            transform: scale(1) rotate(0);
        }
    }
</style>
