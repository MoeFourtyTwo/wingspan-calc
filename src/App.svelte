<script lang="ts">
  import { gameStore } from "./lib/store";
  import { t } from "./lib/i18n";
  import Setup from "./lib/Setup.svelte";
  import Scoring from "./lib/Scoring.svelte";
  import Result from "./lib/Result.svelte";
  import Stats from "./lib/Stats.svelte";
  import StartPlayerSelection from "./lib/StartPlayerSelection.svelte";
  import LanguageToggle from "./lib/LanguageToggle.svelte";
  import { fade, slide } from "svelte/transition";

  // Reactive access to store
  $: phase = $gameStore.currentPhase;
</script>

<main>
  <div class="app-header">
    <div class="header-top">
      <LanguageToggle />
    </div>
    <h1>🪶 {$t("appTitle")}</h1>
  </div>

  <div class="content">
    {#if phase === "SETUP"}
      <div in:fade>
        <Setup />
      </div>
    {:else if phase === "SELECTION"}
      <StartPlayerSelection />
    {:else if phase === "SCORING"}
      <div in:fade>
        <Scoring />
      </div>
    {:else if phase === "RESULT"}
      <div in:fade>
        <Result />
      </div>
    {:else if phase === "STATS"}
      <div in:fade>
        <Stats />
      </div>
    {/if}
  </div>
</main>

<style>
  .app-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-top: 1rem;
    position: relative;
  }

  .header-top {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }

  h1 {
    font-size: 1.8rem;
    color: var(--color-text-primary);
    margin-top: 2rem; /* Make space for toggle */
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }
</style>
