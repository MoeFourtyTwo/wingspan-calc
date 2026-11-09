<script lang="ts">
    let { size = 24 }: { size?: number } = $props();
</script>

<svg class="binoculars" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="2.5" width="4" height="4" rx="1" />
    <rect x="15" y="2.5" width="4" height="4" rx="1" />
    <path d="M3.4 14.5L4.8 6.5h4.4l1.3 7" />
    <path d="M20.6 14.5l-1.4-8h-4.4l-1.3 7" />
    <path d="M10.2 10.5h3.6" />
    <circle cx="6.5" cy="17" r="4" fill="var(--lens, transparent)" />
    <circle cx="17.5" cy="17" r="4" fill="var(--lens, transparent)" />
</svg>
