<script lang="ts">
    import { shade } from "./color";

    
    interface Props {
        color?: string;
        /** Height in px. */
        size?: number;
        class?: string;
    }

    let { color = "#3b7fb6", size = 36, class: className = "" }: Props = $props();
    
</script>

<svg
    class="feather {className}"
    width={size / 3}
    height={size}
    viewBox="0 0 20 60"
    aria-hidden="true"
>
    <path d="M10 2C18 14 19 34 11 54C3 36 1 16 10 2Z" fill={color} />
    <path d="M10 2C14 12 15 26 12 40L10 54C7 36 6 18 10 2Z" fill={shade(color, 0.25)} opacity="0.6" />
    <path
        d="M10 6V58M10 18L15 13M10 26L16 20M10 34L15 29M10 22L5 17M10 30L4 25M10 38L5 34"
        stroke={shade(color, -0.4)}
        stroke-width="1.1"
        stroke-linecap="round"
        fill="none"
    />
</svg>

<style>
    .feather {
        display: block;
        overflow: visible;
    }
</style>
