<script lang="ts">
  import { fade } from "svelte/transition";
  import { ambience } from "$lib/stores/ambience.svelte";
</script>

<!-- Fixed, non-interactive layer behind the whole app (header, margins,
     content). Content renders after it in DOM order, so UI stays sharp. -->
<!-- -z-10: without an explicit z-index, this fixed layer (a "positioned"
     element) paints ABOVE ordinary static-flow content regardless of DOM
     order, dimming any text not wrapped in its own stacking context. -->
<div class="pointer-events-none fixed inset-0 -z-10 h-full w-full overflow-hidden" aria-hidden="true">
  {#if ambience.image}
    {#key ambience.image}
      <div
        transition:fade={{ duration: 700 }}
        class="absolute inset-0 bg-cover bg-center blur-[45px] scale-110 will-change-transform"
        style="background-image: url('{ambience.image}')"
      ></div>
    {/key}
  {/if}
  <!-- Dark veil + blend into the site's near-black base toward the bottom -->
  <div class="absolute inset-0 bg-background/80"></div>
  <div class="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background"></div>
</div>
