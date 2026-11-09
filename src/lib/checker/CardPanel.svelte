<script lang="ts">
    import { t, type TranslationKey } from "../i18n";
    import { renderTokens } from "../data/tokens";
    import { pop, reducedMotion, swoop } from "../ui/motion";
    import NameLabel from "./NameLabel.svelte";
    import Rulings from "./Rulings.svelte";
    import SearchBox from "./SearchBox.svelte";
    import VerdictBadge from "./VerdictBadge.svelte";
    import { birdSubtitle, checkCard, englishSubtitle, localText, searchCardBirds, searchCards } from "./search";
    import type { Verdict } from "./rules";
    import type { Bird, BonusCard, Lang } from "./types";

    interface Props {
        cards: BonusCard[];
        birds: Bird[];
        edition: Lang;
        card: BonusCard | null;
        /** Search in the card list. */
        query: string;
        /** Search inside the selected card's bird list. */
        birdQuery: string;
        backLabel: string;
        setLabel: (set: string) => string;
        onselect: (card: BonusCard) => void;
        onbird: (bird: Bird) => void;
        onback: () => void;
    }

    let {
        cards,
        birds,
        edition,
        card,
        query = $bindable(),
        birdQuery = $bindable(),
        backLabel,
        setLabel,
        onselect,
        onbird,
        onback,
    }: Props = $props();

    const PAGE = 150;
    /** Longer notes (e.g. whole tables) start collapsed so the verdict stays close. */
    const LONG_NOTE = 280;

    function jumpToVerdict() {
        document.getElementById("chk-verdict-title")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }

    let found = $derived(searchCards(cards, query, edition));

    let check = $derived(card ? checkCard(birds, card, edition) : null);
    /** Rows of the verdict list: qualifying birds, or every search match with its verdict. */
    let rows = $derived.by((): { bird: Bird; verdict: Verdict }[] => {
        if (!card || !check || check.kind === "other" || check.allCan) return [];
        if (birdQuery.trim()) return searchCardBirds(birds, card, birdQuery, edition);
        const list = check.kind === "fixed" ? check.yes : check.maybe;
        const v: Verdict = check.kind === "fixed" ? "yes" : "maybe";
        return list.map((bird) => ({ bird, verdict: v }));
    });

    let limit = $state(PAGE);
    $effect.pre(() => {
        void card;
        void birdQuery;
        limit = PAGE;
    });
    let shown = $derived(rows.slice(0, limit));

    let countText = $derived.by(() => {
        if (!check) return "";
        if (birdQuery.trim()) return plural("chkSearchCount", rows.length);
        return check.kind === "fixed" ? plural("chkCountYes", check.yes.length) : plural("chkCountMaybe", check.maybe.length);
    });

    function plural(key: "chkSearchCount" | "chkCountYes" | "chkCountMaybe", n: number) {
        return $t((n === 1 ? `${key}_one` : key) as TranslationKey, { n });
    }

    const text = (x: { en: string; de: string | null }) => renderTokens(localText(x, edition), edition);
    const stagger = (i: number) => ({ delay: Math.min(i, 14) * 22, duration: i < 30 ? 300 : 0, start: 0.6 });
</script>

{#if !card}
    <div class="list-view">
        <SearchBox bind:value={query} label={$t("chkSearchCards")} id="chk-card-search" />
        <p class="count" aria-live="polite">
            {query.trim() ? plural("chkSearchCount", found.length) : $t("chkCardCount", { n: found.length })}
        </p>
        {#if cards.length === 0}
            <p class="empty hand">{$t("chkNoCards")}</p>
        {:else if found.length === 0}
            <p class="empty hand">{$t("chkNoResults")}</p>
        {/if}
        <ul class="rows">
            {#each found as c, i (c.id)}
                <li in:pop|global={stagger(i)}>
                    <button class="row" onclick={() => onselect(c)}>
                        <span class="row-main">
                            <span class="row-title"><NameLabel name={c.name} lang={edition} /></span>
                            {#if englishSubtitle(c.name, edition)}<span class="row-sub">{c.name.en}</span>{/if}
                        </span>
                        <span class="set-badge set-{c.set}">{setLabel(c.set)}</span>
                        <svg class="chev" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                </li>
            {/each}
        </ul>
    </div>
{:else}
    {#key card.id}
        <article class="detail" in:swoop={{ x: 40, y: 0, rotate: 1, duration: 360 }}>
            <button class="back btn-ghost" onclick={onback}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                {backLabel}
            </button>

            <div class="card taped bonus-card">
                <div class="head">
                    <h3 id="chk-card-title"><NameLabel name={card.name} lang={edition} /></h3>
                    <span class="set-badge set-{card.set}">{setLabel(card.set)}</span>
                </div>
                {#if englishSubtitle(card.name, edition)}<p class="en-name">{card.name.en}</p>{/if}

                {#if card.condition.en}
                    <p class="condition">{text(card.condition)}</p>
                {/if}
                {#if check && check.kind !== "other"}
                    <button class="jump" class:maybe={check.kind === "state"} onclick={jumpToVerdict}>
                        {check.allCan ? $t("chkStateAll") : check.kind === "fixed" ? plural("chkCountYes", check.yes.length) : plural("chkCountMaybe", check.maybe.length)}
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
                    </button>
                {/if}
                <dl class="texts">
                    {#if card.explanation.en}
                        <dt>{$t("chkExplanation")}</dt>
                        <dd>{text(card.explanation)}</dd>
                    {/if}
                    {#if card.scoring.en}
                        <dt>{$t("chkScoring")}</dt>
                        <dd class="scoring">{text(card.scoring)}</dd>
                    {/if}
                    {#if card.note.en && text(card.note).length <= LONG_NOTE}
                        <dt>{$t("chkNote")}</dt>
                        <dd>{text(card.note)}</dd>
                    {/if}
                </dl>
                {#if card.note.en && text(card.note).length > LONG_NOTE}
                    <details class="long-note">
                        <summary>
                            <span>{$t("chkNote")}</span>
                            <svg class="caret" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                        </summary>
                        <p>{text(card.note)}</p>
                    </details>
                {/if}
                <Rulings rulings={card.rulings} />
            </div>

            <section class="verdict" aria-labelledby="chk-verdict-title">
                <h3 id="chk-verdict-title" class="section-title">{$t("chkVerdict")}</h3>

                {#if check?.kind === "other"}
                    <p class="hint other">{$t("chkOtherHint")}</p>
                {:else if check?.allCan}
                    <p class="hint state">{$t("chkStateAll")}</p>
                {:else if check}
                    {#if check.kind === "state"}
                        <p class="hint state">{$t("chkStateHint")}</p>
                    {/if}
                    {#if !birdQuery.trim()}
                        <p class="big-count {check.kind === 'fixed' ? 'yes' : 'maybe'}">{countText}</p>
                    {/if}
                    {#if check.unknown.length}
                        <p class="hint unknown">{$t("chkUnknownCount", { n: check.unknown.length })}</p>
                    {/if}

                    <SearchBox bind:value={birdQuery} label={$t("chkSearchInCard")} id="chk-card-bird-search" />
                    <!-- Without a search the big count above says it already; keep it for screen readers. -->
                    <p class="count" class:visually-hidden={!birdQuery.trim()} aria-live="polite">{countText}</p>
                    {#if birdQuery.trim() && rows.length === 0}
                        <p class="empty hand">{$t("chkNoResults")}</p>
                    {/if}

                    <ul class="rows">
                        {#each shown as r, i (r.bird.id)}
                            <li in:pop|global={stagger(i)}>
                                <button class="row bird-row v-{r.verdict}" onclick={() => onbird(r.bird)}>
                                    <span class="row-main">
                                        <span class="row-title"><NameLabel name={r.bird.name} lang={edition} /></span>
                                        <span class="row-sub">{birdSubtitle(r.bird, edition)}</span>
                                    </span>
                                    <VerdictBadge verdict={r.verdict} compact={!birdQuery.trim()} />
                                </button>
                            </li>
                        {/each}
                    </ul>
                    {#if rows.length > limit}
                        <button class="btn-secondary more" onclick={() => (limit += PAGE)}>
                            {$t("chkShowMore", { n: Math.min(PAGE, rows.length - limit) })}
                        </button>
                    {/if}
                {/if}
            </section>
        </article>
    {/key}
{/if}

<style>
    .bonus-card {
        margin-top: 6px;
        padding-top: 20px;
        background:
            linear-gradient(180deg, rgba(217, 167, 43, 0.12), transparent 70px),
            var(--card);
    }

    .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
    }

    .head h3 {
        font-size: 1.4rem;
        color: var(--forest-deep);
        overflow-wrap: anywhere;
    }

    .en-name {
        font-family: var(--font-hand);
        font-size: 1.2rem;
        color: var(--twig);
        line-height: 1.1;
    }

    .condition {
        margin: 12px 0 10px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: rgba(47, 125, 109, 0.09);
        font-family: var(--font-display);
        font-size: 1.1rem;
        font-weight: 500;
        line-height: 1.3;
        white-space: pre-line;
    }

    .jump {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
        margin-bottom: 4px;
        padding: 6px 14px;
        border-radius: 999px;
        background: var(--forest);
        color: #fff;
        font-family: var(--font-display);
        font-weight: 600;
        box-shadow: 0 3px 0 var(--forest-deep);
        text-align: left;
    }

    .jump:active {
        transform: translateY(2px) scale(0.96);
        box-shadow: 0 1px 0 var(--forest-deep);
    }

    .jump.maybe {
        color: #3a2c06;
        background: var(--gold);
        box-shadow: 0 3px 0 var(--grassland-deep);
    }

    .long-note {
        margin-top: 12px;
        border-radius: var(--radius-sm);
        background: rgba(110, 80, 50, 0.07);
        font-size: 0.9rem;
    }

    .long-note summary {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 6px 10px;
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--ink-soft);
        cursor: pointer;
        list-style: none;
    }

    .long-note summary::-webkit-details-marker {
        display: none;
    }

    .long-note .caret {
        margin-left: auto;
        transition: transform 0.3s var(--spring);
    }

    .long-note[open] .caret {
        transform: rotate(180deg);
    }

    .long-note p {
        padding: 0 12px 10px;
        white-space: pre-line;
        overflow-wrap: anywhere;
    }

    .texts {
        display: grid;
        gap: 2px;
        font-size: 0.95rem;
    }

    dt {
        margin-top: 8px;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-soft);
    }

    dd {
        white-space: pre-line;
        overflow-wrap: anywhere;
    }

    dd.scoring {
        font-weight: 700;
    }

    .verdict {
        margin-top: 8px;
    }

    .verdict h3 {
        scroll-margin-top: 76px;
    }

    .big-count {
        display: inline-block;
        margin: 0 0 10px;
        padding: 4px 14px;
        border-radius: 999px;
        font-family: var(--font-display);
        font-size: 1.3rem;
        font-weight: 600;
        color: #fff;
        background: var(--forest);
        box-shadow: 0 3px 0 var(--forest-deep);
        animation: count-pop 0.45s var(--spring) both;
    }

    .big-count.maybe {
        color: #3a2c06;
        background: var(--gold);
        box-shadow: 0 3px 0 var(--grassland-deep);
    }

    @keyframes count-pop {
        from {
            transform: scale(0.5) rotate(-4deg);
            opacity: 0;
        }
    }
</style>
