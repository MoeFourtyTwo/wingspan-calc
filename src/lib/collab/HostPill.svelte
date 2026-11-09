<script lang="ts">
    import { t } from "../i18n";
    import { hostView, onlinePhones, openShare } from "./ui";

    // Bump the counter when a phone comes or goes.
    let bumpKey = $derived($onlinePhones);
</script>

<button
    class="pill"
    class:live={!!$hostView}
    onclick={openShare}
    aria-haspopup="dialog"
    aria-label={$hostView ? $t("hostPill", { n: $onlinePhones }) : $t("collabConnect")}
    title={$hostView ? $t("hostPill", { n: $onlinePhones }) : $t("collabConnect")}
>
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18.5h3" /></svg>
    {#if $hostView}
        {#key bumpKey}
            <span class="n" aria-hidden="true">{$onlinePhones}</span>
        {/key}
    {:else}
        <span class="n plus" aria-hidden="true">+</span>
    {/if}
</button>

<style>
    .pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        min-width: 44px;
        min-height: 40px;
        padding: 4px 10px 4px 8px;
        border-radius: 999px;
        color: var(--ink-soft);
        background: var(--card);
        border: 1.5px solid var(--line);
        box-shadow: 0 2px 0 rgba(110, 80, 50, 0.14);
    }

    .pill.live {
        color: var(--forest-deep);
        background: #e3f1ec;
        border-color: color-mix(in srgb, var(--forest) 45%, transparent);
    }

    .pill:active {
        transform: scale(0.9);
    }

    .n {
        display: inline-block;
        min-width: 1ch;
        font-family: var(--font-display);
        font-size: 1.05rem;
        line-height: 1;
        animation: bump 0.4s var(--spring);
    }

    .n.plus {
        animation: none;
    }

    @keyframes bump {
        from {
            transform: scale(1.6) rotate(-10deg);
        }
    }
</style>
