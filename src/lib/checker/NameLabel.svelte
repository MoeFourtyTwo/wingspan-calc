<script lang="ts">
    import { t } from "../i18n";
    import { isFallback, localText } from "./search";
    import type { Lang, Text } from "./types";

    interface Props {
        name: Text;
        lang: Lang;
    }

    let { name, lang }: Props = $props();
</script>

<span class="name">{localText(name, lang)}</span>{#if isFallback(name, lang)}<abbr class="en-tag" title={$t("chkEnTag")}>
        <span aria-hidden="true">EN</span><span class="visually-hidden">({$t("chkEnTag")})</span></abbr
    >{/if}

<style>
    .en-tag {
        display: inline-block;
        margin-left: 6px;
        padding: 0 5px;
        border-radius: 5px;
        border: 1.5px solid var(--wetland);
        color: var(--wetland-deep);
        font-family: var(--font-display);
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 1.4;
        text-decoration: none;
        vertical-align: 2px;
    }
</style>
