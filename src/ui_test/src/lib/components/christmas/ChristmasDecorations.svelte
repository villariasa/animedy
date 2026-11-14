<script lang="ts">
  import { seasonal } from "$lib/stores/seasonal.svelte";
  import { router } from "$lib/router.svelte";
  import SnowCanvas from "./SnowCanvas.svelte";
  import StringLights from "./StringLights.svelte";
  import CornerPineBranches from "./CornerPineBranches.svelte";
  import BottomSnowDrift from "./BottomSnowDrift.svelte";

  // When on the watch route, suppress top string lights and corner branches
  // to keep the video playback area 100% pristine and unaffected.
  const isWatchPage = $derived(router.current.name === "watch");
</script>

{#if seasonal.isActive}
  <!-- 1. Background Snowfall (canvas with micro-particles and occasional rotating flakes) -->
  <SnowCanvas />

  <!-- 2. Bottom viewport subtle snow drift accumulation -->
  <BottomSnowDrift />

  <!-- 3. Top edge string lights and corner pine branches (hidden on /watch to keep player pristine) -->
  {#if !isWatchPage}
    <StringLights />
    <CornerPineBranches />
  {/if}
{/if}
