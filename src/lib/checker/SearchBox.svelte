<script lang="ts">
    import { t } from "../i18n";

    interface Props {
        value: string;
        label: string;
        id: string;
    }

    let { value = $bindable(), label, id }: Props = $props();
    let input: HTMLInputElement | undefined = $state();

    function clear() {
        value = "";
        input?.focus();
    }
</script>

<div class="search">
    <label class="visually-hidden" for={id}>{label}</label>
    <svg class="glass" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
    <input
        bind:this={input}
        bind:value
        {id}
        type="search"
        placeholder={label}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
    />
    {#if value}
        <button class="clear" type="button" onclick={clear} aria-label={$t("chkClearSearch")}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
    {/if}
</div>

<style>
    .search {
        position: relative;
        display: flex;
        align-items: center;
    }

    .glass {
        position: absolute;
        left: 14px;
        color: var(--ink-soft);
        pointer-events: none;
    }

    input {
        width: 100%;
        min-height: 48px;
        padding: 10px 48px 10px 44px;
        border-radius: 999px;
        border: 2px solid var(--line);
        background: var(--card);
        font-size: 1rem;
        box-shadow: inset 0 2px 0 rgba(110, 80, 50, 0.06);
        transition: border-color 0.2s, box-shadow 0.2s;
    }

    input::placeholder {
        color: #8a8574;
        text-overflow: ellipsis;
    }

    input::-webkit-search-cancel-button {
        display: none;
    }

    input:focus {
        outline: none;
        border-color: var(--forest);
        box-shadow: 0 0 0 4px rgba(47, 125, 109, 0.18);
    }

    .clear {
        position: absolute;
        right: 2px;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        color: var(--ink-soft);
    }

    .clear:active {
        transform: scale(0.85);
    }
</style>
