<script lang="ts">
    import { shade } from "./color";

    export let color = "#3b7fb6";
    export let breast = "#e9925a";
    /** Width in px. */
    export let size = 48;
    export let flapping = false;
    /** -1 mirrors the bird to face left. */
    export let facing: 1 | -1 = 1;
    let className = "";
    export { className as class };
</script>

<svg
    class="bird {className}"
    class:flapping
    width={size}
    height={size * 0.875}
    viewBox="0 0 64 56"
    aria-hidden="true"
    style="--facing: {facing}"
>
    <g class="flip">
        <path d="M14 33 L1 25 L4 38 Z" fill={shade(color, -0.3)} />
        <path d="M27 46 L25 54 M33 46 L33 54" stroke="#c27a2c" stroke-width="2.4" stroke-linecap="round" />
        <ellipse cx="29" cy="34" rx="18" ry="14" fill={color} />
        <ellipse cx="33" cy="39" rx="12" ry="7.5" fill={breast} />
        <circle cx="44" cy="21" r="11" fill={color} />
        <circle cx="47" cy="19" r="2.4" fill="#1d1d1d" />
        <circle cx="47.8" cy="18.2" r="0.8" fill="#fff" />
        <circle cx="45" cy="26" r="2.6" fill="#f29b9b" opacity="0.55" />
        <path d="M54 19.5 L62.5 22.5 L54 25 Z" fill="#e8a33d" stroke="#b97a22" stroke-width="0.6" />
        <path class="wing" d="M17 31 Q29 21 40 31 Q31 41 17 36 Z" fill={shade(color, -0.25)} />
        <path d="M37 13 Q40 7 44 10" stroke={shade(color, -0.3)} stroke-width="2" fill="none" stroke-linecap="round" />
    </g>
</svg>

<style>
    .bird {
        display: block;
        overflow: visible;
        filter: drop-shadow(0 3px 2px rgba(40, 30, 10, 0.25));
    }

    .flip {
        transform-origin: 32px 28px;
        transform: scaleX(var(--facing));
        transition: transform 0.15s ease;
    }

    .wing {
        transform-origin: 38px 31px;
    }

    .flapping .wing {
        animation: flap 0.14s ease-in-out infinite alternate;
    }

    @keyframes flap {
        from {
            transform: rotate(-8deg);
        }
        to {
            transform: rotate(55deg) scaleY(1.1);
        }
    }
</style>
