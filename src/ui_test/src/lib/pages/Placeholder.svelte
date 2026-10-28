<script lang="ts">
  let { title, task }: { title: string; task: string } = $props();
</script>

<section class="flex flex-col items-center gap-2 py-16 text-center">
  <h2 class="text-xl font-semibold">{title}</h2>
  <p class="text-sm text-muted-foreground">Coming in {task}.</p>
</section>
