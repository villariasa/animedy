<script lang="ts">
  import { Button } from "$lib/components/ui/button";

  let {
    label,
    seconds,
    onconfirm,
    oncancel
  }: {
    label: string;
    seconds: number;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();

  let remaining = $state(0);

  $effect(() => {
    remaining = seconds;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        onconfirm();
      }
    }, 1000);
    return () => clearInterval(timer);
  });
</script>

<div
  class="absolute inset-0 z-20 flex items-center justify-center bg-black/70"
  role="alertdialog"
  aria-label={label}
>
  <div class="flex w-80 flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
    <p class="text-sm text-muted-foreground">{label}</p>
    <p class="text-4xl font-semibold tabular-nums">{remaining}</p>
    <div class="flex gap-2">
      <Button onclick={onconfirm}>Play now</Button>
      <Button variant="outline" onclick={oncancel}>Cancel</Button>
    </div>
  </div>
</div>
