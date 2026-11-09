<script lang="ts">
    import { language, t, type TranslationKey } from "../i18n";
    import { TOKENS, renderTokens } from "../data/tokens";
    import { pop, swoop } from "../ui/motion";
    import NameLabel from "./NameLabel.svelte";
    import Rulings from "./Rulings.svelte";
    import SearchBox from "./SearchBox.svelte";
    import VerdictBadge from "./VerdictBadge.svelte";
    import { birdSubtitle, checkBird, englishSubtitle, localText, searchBirds } from "./search";
    import type { Verdict } from "./rules";
    import type { Bird, BonusCard, Lang } from "./types";

    interface Props {
        birds: Bird[];
        cards: BonusCard[];
        edition: Lang;
        bird: Bird | null;
        query: string;
        backLabel: string;
        setLabel: (set: string) => string;
        onselect: (bird: Bird) => void;
        oncard: (card: BonusCard) => void;
        onback: () => void;
    }

    let { birds, cards, edition, bird, query = $bindable(), backLabel, setLabel, onselect, oncard, onback }: Props = $props();

    const PAGE = 150;

    let found = $derived(searchBirds(birds, query, edition));
    let limit = $state(PAGE);
    $effect.pre(() => {
        void query;
        limit = PAGE;
    });
    let shown = $derived(found.slice(0, limit));

    let groups = $derived(bird ? checkBird(bird, cards, edition) : null);

    let ui = $derived($language);
    const tok = (key: string) => TOKENS[key]?.[ui] ?? key;
    const text = (x: { en: string; de: string | null }) => renderTokens(localText(x, edition), edition);
    const stagger = (i: number) => ({ delay: Math.min(i, 14) * 22, duration: i < 30 ? 300 : 0, start: 0.6 });

    function nestText(b: Bird) {
        if (b.nest === "wild") return $t("chkNestWild");
        if (b.nest === "none") return $t("chkNestNone");
        return tok(b.nest);
    }

    function wingspanText(b: Bird) {
        if (b.wingspan === "*") return $t("chkWingspanAny");
        return b.wingspan === null ? "–" : `${b.wingspan} cm`;
    }

    function foodText(b: Bird) {
        const parts = Object.entries(b.food).map(([k, n]) => `${n} ${tok(k)}`);
        if (parts.length === 0) return b.foodTotal === 0 ? $t("chkFoodNone") : "–";
        return parts.join(b.foodSlash ? ` ${$t("chkFoodOr")} ` : " + ");
    }

    function countLabel(n: number) {
        return $t((n === 1 ? "chkSearchCount_one" : "chkSearchCount") as TranslationKey, { n });
    }

    const GROUPS: { key: "yes" | "maybe" | "unknown"; verdict: Verdict }[] = [
        { key: "yes", verdict: "yes" },
        { key: "maybe", verdict: "maybe" },
        { key: "unknown", verdict: "unknown" },
    ];
</script>

{#snippet cardRow(c: BonusCard, verdict: Verdict, i: number)}
    <li in:pop|global={stagger(i)}>
        <button class="row card-row v-{verdict === 'n/a' ? 'unknown' : verdict}" onclick={() => oncard(c)}>
            <span class="row-main">
                <span class="row-title"><NameLabel name={c.name} lang={edition} /></span>
                {#if c.condition.en}<span class="row-sub wrap">{text(c.condition)}</span>{/if}
            </span>
            <svg class="chev" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
    </li>
{/snippet}

{#if !bird}
    <div class="list-view">
        <SearchBox bind:value={query} label={$t("chkSearchBirds")} id="chk-bird-search" />
        <p class="count" aria-live="polite">
            {query.trim() ? countLabel(found.length) : $t("chkBirdCount", { n: found.length })}
        </p>
        {#if found.length === 0}
            <p class="empty hand">{$t("chkNoResults")}</p>
        {/if}
        <ul class="rows">
            {#each shown as b, i (b.id)}
                <li in:pop|global={stagger(i)}>
                    <button class="row" onclick={() => onselect(b)}>
                        <span class="row-main">
                            <span class="row-title"><NameLabel name={b.name} lang={edition} /></span>
                            <span class="row-sub">{birdSubtitle(b, edition)}</span>
                        </span>
                        <span class="set-badge set-{b.set}">{setLabel(b.set)}</span>
                        <svg class="chev" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                </li>
            {/each}
        </ul>
        {#if found.length > limit}
            <button class="btn-secondary more" onclick={() => (limit += PAGE)}>
                {$t("chkShowMore", { n: Math.min(PAGE, found.length - limit) })}
            </button>
        {/if}
    </div>
{:else}
    {#key bird.id}
        <article class="detail" in:swoop={{ x: 40, y: 0, rotate: 1, duration: 360 }}>
            <button class="back btn-ghost" onclick={onback}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                {backLabel}
            </button>

            <div class="card taped bird-card">
                <div class="head">
                    <h3><NameLabel name={bird.name} lang={edition} /></h3>
                    <span class="set-badge set-{bird.set}">{setLabel(bird.set)}</span>
                </div>
                <p class="sub">
                    {#if englishSubtitle(bird.name, edition)}<span class="en-name">{bird.name.en}</span>{/if}
                    <i>{bird.scientific}</i>
                </p>

                <div class="tags">
                    {#each bird.habitats as h (h)}
                        <span class="tag hab-{h}">{tok(h)}</span>
                    {/each}
                    {#if bird.predator}<span class="tag">{$t("chkPredator")}</span>{/if}
                    {#if bird.flocking}<span class="tag">{$t("chkFlocking")}</span>{/if}
                    {#if bird.hummingbird}<span class="tag hum">{$t("chkHummingbird")}</span>{/if}
                </div>

                <dl class="facts">
                    <div class="fact pts">
                        <dt>{$t("chkPoints")}</dt>
                        <dd>{bird.points ?? "–"}</dd>
                    </div>
                    <div class="fact">
                        <dt>{$t("chkEggLimit")}</dt>
                        <dd>{bird.eggLimit ?? "–"}</dd>
                    </div>
                    <div class="fact">
                        <dt>{$t("chkNest")}</dt>
                        <dd>{nestText(bird)}</dd>
                    </div>
                    <div class="fact">
                        <dt>{$t("chkWingspan")}</dt>
                        <dd>{wingspanText(bird)}</dd>
                    </div>
                    <div class="fact wide">
                        <dt>{$t("chkHabitats")}</dt>
                        <dd>{bird.habitats.map(tok).join(", ") || "–"}</dd>
                    </div>
                    <div class="fact wide">
                        <dt>{$t("chkFood")}</dt>
                        <dd>{foodText(bird)}</dd>
                    </div>
                </dl>

                {#if bird.power.en}
                    <div class="power">
                        <span class="power-label">{$t("chkPower")}</span>
                        <p>{text(bird.power)}</p>
                    </div>
                {/if}
                <Rulings rulings={bird.rulings} />
            </div>

            {#if groups}
                <section class="groups" aria-label={$t("bonus")}>
                    {#each GROUPS as g (g.key)}
                        {#if groups[g.key].length}
                            <div class="group">
                                <h4 class="group-title">
                                    <VerdictBadge verdict={g.verdict} />
                                    <span class="n">{groups[g.key].length}</span>
                                </h4>
                                <ul class="rows">
                                    {#each groups[g.key] as c, i (c.id)}
                                        {@render cardRow(c, g.verdict, i)}
                                    {/each}
                                </ul>
                            </div>
                        {/if}
                    {/each}
                    {#if groups.no.length}
                        <details class="group">
                            <summary class="group-title">
                                <VerdictBadge verdict="no" />
                                <span class="n">{groups.no.length}</span>
                                <svg class="caret" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                            </summary>
                            <ul class="rows">
                                {#each groups.no as c, i (c.id)}
                                    {@render cardRow(c, "no", i)}
                                {/each}
                            </ul>
                        </details>
                    {/if}
                    {#if groups.na.length}
                        <details class="group">
                            <summary class="group-title">
                                <span class="na-title">{$t("chkGroupNa")}</span>
                                <span class="n">{groups.na.length}</span>
                                <svg class="caret" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                            </summary>
                            <ul class="rows">
                                {#each groups.na as c, i (c.id)}
                                    {@render cardRow(c, "n/a", i)}
                                {/each}
                            </ul>
                        </details>
                    {/if}
                    {#if cards.length === 0}
                        <p class="empty hand">{$t("chkNoCards")}</p>
                    {/if}
                </section>
            {/if}
        </article>
    {/key}
{/if}

<style>
    .bird-card {
        margin-top: 6px;
        padding-top: 20px;
        background:
            linear-gradient(180deg, rgba(59, 127, 182, 0.1), transparent 70px),
            var(--card);
    }

    .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
    }

    .head h3 {
        font-size: 1.45rem;
        color: var(--forest-deep);
        overflow-wrap: anywhere;
    }

    .sub {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 10px;
        color: var(--ink-soft);
        font-size: 0.9rem;
    }

    .en-name {
        font-family: var(--font-hand);
        font-size: 1.2rem;
        color: var(--twig);
        line-height: 1.1;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 10px 0 4px;
    }

    .tag {
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 800;
        background: rgba(110, 80, 50, 0.1);
        color: var(--twig-deep);
    }

    .hab-forest {
        background: rgba(47, 125, 109, 0.16);
        color: var(--forest-deep);
    }

    .hab-grassland {
        background: rgba(217, 167, 43, 0.22);
        color: #6b4f08;
    }

    .hab-wetland {
        background: rgba(59, 127, 182, 0.16);
        color: var(--wetland-deep);
    }

    .hum {
        background: rgba(18, 163, 154, 0.16);
        color: #0b6660;
    }

    .facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
    }

    .fact {
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        background: rgba(110, 80, 50, 0.06);
        border: 1px dashed var(--line);
        min-width: 0;
    }

    .fact.wide {
        grid-column: 1 / -1;
    }

    dt {
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--ink-soft);
    }

    dd {
        font-family: var(--font-display);
        font-size: 1.05rem;
        font-weight: 500;
        overflow-wrap: anywhere;
    }

    .pts dd {
        font-size: 1.4rem;
        color: var(--forest-deep);
        line-height: 1.1;
    }

    .power {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: rgba(59, 127, 182, 0.08);
        border-left: 4px solid var(--wetland);
        white-space: pre-line;
        overflow-wrap: anywhere;
        font-size: 0.95rem;
    }

    .power-label {
        display: block;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--wetland-deep);
    }

    .groups {
        display: grid;
        gap: 14px;
        margin-top: 4px;
    }

    .group-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 1rem;
    }

    .n {
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--ink-soft);
    }

    summary.group-title {
        min-height: 44px;
        margin-bottom: 0;
        padding: 4px 6px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        list-style: none;
    }

    summary.group-title::-webkit-details-marker {
        display: none;
    }

    summary:hover {
        background: rgba(110, 80, 50, 0.06);
    }

    details[open] summary {
        margin-bottom: 8px;
    }

    .caret {
        margin-left: auto;
        color: var(--ink-soft);
        transition: transform 0.3s var(--spring);
    }

    details[open] .caret {
        transform: rotate(180deg);
    }

    .na-title {
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--ink-soft);
    }

    .row-sub.wrap {
        white-space: normal;
        font-size: 0.78rem;
        line-height: 1.3;
    }

    .card-row.v-yes {
        border-left: 5px solid var(--forest);
    }

    .card-row.v-maybe {
        border-left: 5px solid var(--gold);
    }

    .card-row.v-no {
        border-left: 5px solid var(--berry);
    }

    .card-row.v-unknown {
        border-left: 5px solid #8d8b80;
    }
</style>
