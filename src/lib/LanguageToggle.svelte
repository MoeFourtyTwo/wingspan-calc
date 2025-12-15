<script lang="ts">
    import { language } from "./i18n";

    function toggle() {
        language.update((l) => (l === "en" ? "de" : "en"));
    }
</script>

<button class="language-toggle" on:click={toggle}>
    <span class="option" class:active={$language === "en"}>EN</span>
    <span class="separator">/</span>
    <span class="option" class:active={$language === "de"}>DE</span>
</button>

<style>
    .language-toggle {
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(0, 0, 0, 0.05);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 600;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        font-family: inherit;
        transition: background-color 0.2s;
    }

    .language-toggle:hover {
        background: rgba(0, 0, 0, 0.08);
        color: var(--color-text-primary);
    }

    .option {
        padding: 2px 6px;
        border-radius: 4px;
        transition:
            color 0.2s,
            background-color 0.2s;
    }

    .option.active {
        color: var(--color-primary-blue);
        background: white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .separator {
        color: #ccc;
    }
</style>
