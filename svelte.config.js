import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Svelte 5 runes everywhere; legacy `$:` / `export let` syntax is a compile error.
    runes: true,
  },
}
