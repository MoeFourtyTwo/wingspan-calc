<script lang="ts" module>
    import type { Category } from "../rules/scoring";

    
    export const CATEGORY_COLORS: Record<Category, string> = {
        birds: "#3b7fb6",
        bonus: "#d9a72b",
        round_goals: "#2f7d6d",
        eggs: "#c99a6b",
        food: "#c2554a",
        tucked: "#8a6142",
        nectar: "#d8578a",
        hummingbirds: "#12a39a",
    };
</script>

<script lang="ts">
    interface Props {
        /** Habitat-inspired accent colour per scoring category. */
        category: Category;
        size?: number;
    }

    let { category, size = 28 }: Props = $props();

    let c = $derived(CATEGORY_COLORS[category]);
</script>

<svg
    class="cat-icon"
    width={size}
    height={size}
    viewBox="0 0 32 32"
    aria-hidden="true"
    fill="none"
    stroke="#2b3a2f"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
>
    {#if category === "birds"}
        <path d="M5 19c3 0 5-3 8-6 2-2 6-3 8-1l5-1-4 3c0 6-5 10-12 10-3 0-5-2-5-5z" fill={c} />
        <path d="M11 18c3 2 6 1 8-2" />
        <circle cx="21.5" cy="12.5" r="0.9" fill="#2b3a2f" />
        <path d="M14 25l-1 4M18 24l1 5" />
    {:else if category === "bonus"}
        <rect x="7" y="4" width="18" height="24" rx="3" fill="#fffaf0" />
        <path d="M16 9l2.2 4.5 4.8.6-3.5 3.3.9 4.8L16 20l-4.4 2.2.9-4.8L9 14.1l4.8-.6z" fill={c} />
    {:else if category === "round_goals"}
        <path d="M8 29V4" />
        <path d="M8 5h15l-3 5 3 5H8" fill={c} />
        <circle cx="8" cy="29" r="1.5" fill="#2b3a2f" />
    {:else if category === "eggs"}
        <path d="M16 3c6 0 10 10 10 16 0 6-4 10-10 10S6 25 6 19C6 13 10 3 16 3z" fill={c} />
        <circle cx="19" cy="12" r="1" fill="#2b3a2f" stroke="none" />
        <circle cx="12" cy="20" r="1" fill="#2b3a2f" stroke="none" />
        <circle cx="19" cy="23" r="1.2" fill="#2b3a2f" stroke="none" />
    {:else if category === "food"}
        <circle cx="11" cy="20" r="6" fill={c} />
        <circle cx="21" cy="21" r="5" fill={c} />
        <circle cx="17" cy="13" r="4.5" fill={c} />
        <path d="M17 9c0-3 2-5 5-6M17 8c-2-2-5-2-7 0 2 1 5 1 7 0z" />
    {:else if category === "tucked"}
        <rect x="5" y="9" width="15" height="20" rx="2.5" fill="#fffaf0" transform="rotate(-12 12 19)" />
        <rect x="10" y="6" width="15" height="20" rx="2.5" fill={c} transform="rotate(8 17 16)" />
        <path d="M14 14h7M14 18h5" stroke="#fffaf0" transform="rotate(8 17 16)" />
    {:else if category === "nectar"}
        <circle cx="16" cy="9" r="4.5" fill={c} />
        <circle cx="22.5" cy="14" r="4.5" fill={c} />
        <circle cx="20" cy="21" r="4.5" fill={c} />
        <circle cx="12" cy="21" r="4.5" fill={c} />
        <circle cx="9.5" cy="14" r="4.5" fill={c} />
        <circle cx="16" cy="15.5" r="3.5" fill="#e9b632" />
    {:else if category === "hummingbirds"}
        <path d="M18.5 10.5L3 6.5" />
        <path d="M18 11c4-3 9-1 10 3l1 11-5-4c-3 2-8 1-9-3-1-3 0-6 3-7z" fill={c} />
        <path d="M22 15c1-6 5-10 9-11-1 5-4 10-8 12z" fill="#7fd1b9" />
        <circle cx="21" cy="11.5" r="0.9" fill="#2b3a2f" />
    {/if}
</svg>

<style>
    .cat-icon {
        display: block;
        flex-shrink: 0;
        overflow: visible;
    }
</style>
