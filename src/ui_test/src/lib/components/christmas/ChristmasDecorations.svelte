<script lang="ts">
  import { seasonal } from "$lib/stores/seasonal.svelte";
  import { router } from "$lib/router.svelte";
  import SnowCanvas from "./SnowCanvas.svelte";
  import StringLights from "./StringLights.svelte";
  import CornerPineBranches from "./CornerPineBranches.svelte";
  import BottomSnowDrift from "./BottomSnowDrift.svelte";

  // Snowfall effect is active ONLY on the Dashboard (Home page).
  // All other pages (Liked/Favorites, My List, Watch/Streaming, History, Settings, etc.) have NO snowfall.
  const isDashboard = $derived(router.current.name === "home");

  // When on the watch route, suppress top string lights and corner branches
  // to keep the video playback area 100% pristine and unaffected.
  const isWatchPage = $derived(router.current.name === "watch");
</script>

{#if seasonal.isActive}
  <!-- 1. Snowfall effect: ONLY on Dashboard (Home page) -->
  {#if isDashboard}
    <SnowCanvas />
  {/if}

  <!-- 2. Bottom snow drift (hidden during watch/streaming to keep player clean) -->
  {#if !isWatchPage}
    <BottomSnowDrift />
  {/if}

  <!-- 3. Top edge string lights and corner pine branches (remains on pages, hidden on /watch) -->
  {#if !isWatchPage}
    <StringLights />
    <CornerPineBranches />
  {/if}
{/if}
