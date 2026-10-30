<script lang="ts">
  let {
    genres,
    max = 2,
    class: className = ""
  }: {
    genres: string[] | null | undefined;
    /** Caps how many pills render before a "+N" overflow pill, so a show
     * with a dozen genres can't push the card's layout around. */
    max?: number;
    class?: string;
  } = $props();

  const visible = $derived((genres ?? []).slice(0, max));
  const overflowCount = $derived(Math.max(0, (genres ?? []).length - max));
</script>

{#if visible.length > 0}
  <div class="flex flex-wrap items-center gap-0.5 {className}">
    {#each visible as genre (genre)}
      <span class="truncate rounded border border-border/50 bg-muted/40 px-1 py-px text-[8px] font-medium leading-tight text-muted-foreground/90 max-w-[5.5rem]">
        {genre}
      </span>
    {/each}
    {#if overflowCount > 0}
      <span class="rounded border border-border/50 bg-muted/20 px-1 py-px text-[8px] font-medium leading-tight text-muted-foreground/60">
        +{overflowCount}
      </span>
    {/if}
  </div>
{/if}
