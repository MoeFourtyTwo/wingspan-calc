<script lang="ts" context="module">
    let counter = 0;
</script>

<script lang="ts">
    import { inkFor, shade } from "./color";

    /** Shell colour. */
    export let color = "#f3efe6";
    /** Width in px; height is 1.25 × width. */
    export let size = 28;
    /** Accessible name. When empty the egg is decorative. */
    export let label = "";
    /** Optional letter drawn on the shell. */
    export let initial = "";
    export let speckled = true;
    let className = "";
    export { className as class };

    const gid = `egg-grad-${++counter}`;
    $: ink = inkFor(color);
</script>

<svg
    class="egg {className}"
    width={size}
    height={size * 1.25}
    viewBox="0 0 40 50"
    role="img"
    aria-label={label || undefined}
    aria-hidden={label ? undefined : "true"}
>
    <defs>
        <radialGradient id={gid} cx="36%" cy="30%" r="80%">
            <stop offset="0" stop-color={shade(color, 0.45)} />
            <stop offset="0.5" stop-color={color} />
            <stop offset="1" stop-color={shade(color, -0.22)} />
        </radialGradient>
    </defs>
    <path
        d="M20 2C31 2 38 21 38 32C38 43 30 48 20 48C10 48 2 43 2 32C2 21 9 2 20 2Z"
        fill="url(#{gid})"
        stroke={shade(color, -0.42)}
        stroke-width="1.6"
    />
    {#if speckled}
        <g fill={shade(color, -0.45)} opacity="0.35">
            <circle cx="27" cy="16" r="1.4" />
            <circle cx="31" cy="27" r="1" />
            <circle cx="11" cy="31" r="1.2" />
            <circle cx="24" cy="40" r="1.5" />
            <circle cx="15" cy="40" r="0.9" />
            <circle cx="30" cy="36" r="0.9" />
        </g>
    {/if}
    <ellipse
        cx="13"
        cy="17"
        rx="3.6"
        ry="7"
        fill="#fff"
        opacity="0.5"
        transform="rotate(22 13 17)"
    />
    {#if initial}
        <text
            x="20"
            y="35"
            text-anchor="middle"
            font-size="17"
            font-family="Fredoka, sans-serif"
            font-weight="600"
            fill={ink}>{initial}</text
        >
    {/if}
</svg>

<style>
    .egg {
        display: block;
        flex-shrink: 0;
        overflow: visible;
        filter: drop-shadow(0 2px 1px rgba(60, 40, 20, 0.25));
    }
</style>
