<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "$lib/utils";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: SelectPrimitive.TriggerProps = $props();
</script>

<SelectPrimitive.Trigger
  bind:ref
  class={cn(
    "flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors outline-none hover:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
    className
  )}
  {...restProps}
>
  {@render children?.()}
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 opacity-60" aria-hidden="true">
    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
  </svg>
</SelectPrimitive.Trigger>
