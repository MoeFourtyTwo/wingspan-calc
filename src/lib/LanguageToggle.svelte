<script lang="ts">
    import { language, setLanguage, t } from "./i18n";

    function toggle() {
        setLanguage($language === "en" ? "de" : "en");
    }
</script>

<button
    class="language-toggle"
    class:de={$language === "de"}
    on:click={toggle}
    aria-label="{$t('switchLanguage')} (EN / DE)"
>
    <span class="thumb" aria-hidden="true"></span>
    <span class="option" class:active={$language === "en"}>EN</span>
    <span class="option" class:active={$language === "de"}>DE</span>
</button>

<style>
    .language-toggle {
        position: relative;
        display: inline-grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        min-height: 36px;
        padding: 3px;
        border-radius: 999px;
        background: rgba(110, 80, 50, 0.1);
        border: 1.5px solid var(--line);
        font-family: var(--font-display);
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--ink-soft);
    }

    .language-toggle:active {
        transform: scale(0.94);
    }

    .thumb {
        position: absolute;
        top: 3px;
        bottom: 3px;
        left: 3px;
        width: calc(50% - 3px);
        border-radius: 999px;
        background: var(--card);
        box-shadow: 0 2px 0 rgba(110, 80, 50, 0.18);
        transition: transform 0.35s var(--spring);
    }

    .de .thumb {
        transform: translateX(100%);
    }

    .option {
        position: relative;
        padding: 2px 10px;
        transition: color 0.2s;
    }

    .option.active {
        color: var(--forest-deep);
    }
</style>
