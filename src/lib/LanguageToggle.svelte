<script lang="ts">
    import { language } from "./i18n";
</script>

<div class="language-toggle">
    <button
        class:active={$language === "en"}
        on:click={() => language.set("en")}
    >
        EN
    </button>
    <span class="separator">/</span>
    <button
        class:active={$language === "de"}
        on:click={() => language.set("de")}
    >
        DE
    </button>
</div>

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
    }

    button {
        background: none;
        border: none;
        padding: 2px 4px;
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: 4px;
        transition:
            color 0.2s,
            background-color 0.2s;
    }

    button:hover {
        color: var(--color-text-primary);
    }

    button.active {
        color: var(--color-primary-blue);
        background: white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .separator {
        color: #ccc;
    }
</style>
