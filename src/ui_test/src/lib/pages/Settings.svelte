<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { settings } from "$lib/stores/settings.svelte";

  let saved = $state(false);
  let saving = $state(false);

  const input =
    "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  $effect(() => {
    void settings.load();
  });

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    saving = true;
    saved = false;
    await settings.save({ ...settings.current });
    saving = false;
    saved = true;
    setTimeout(() => (saved = false), 2500);
  }
</script>

<h2 class="mb-1 text-xl font-semibold">Settings</h2>
<p class="mb-6 text-sm text-muted-foreground">
  Stored on this device only — no account needed.
</p>

<form class="flex max-w-lg flex-col gap-6" onsubmit={onSubmit}>
  <fieldset class="flex flex-col gap-3 rounded-lg border border-border p-4">
    <legend class="px-1 text-sm font-medium">Player</legend>
    <label class="flex items-center justify-between gap-3 text-sm">
      Volume ({Math.round(settings.current.volume * 100)}%)
      <input type="range" min="0" max="1" step="0.05" bind:value={settings.current.volume}
        class="w-40 accent-[var(--primary)]" />
    </label>
    <label class="flex items-center justify-between gap-3 text-sm">
      Playback speed
      <select bind:value={settings.current.playback_speed} class={input}>
        {#each [0.5, 0.75, 1, 1.25, 1.5, 2] as s (s)}
          <option value={s}>{s}×</option>
        {/each}
      </select>
    </label>
    <label class="flex items-center justify-between gap-3 text-sm">
      Subtitle language
      <input type="text" bind:value={settings.current.subtitle_lang} placeholder="en" class="{input} w-28" />
    </label>
    <label class="flex items-center justify-between gap-3 text-sm">
      Preferred quality
      <select bind:value={settings.current.preferred_quality} class={input}>
        {#each ["auto", "1080p", "720p", "480p"] as q (q)}
          <option value={q}>{q}</option>
        {/each}
      </select>
    </label>
  </fieldset>

  <fieldset class="flex flex-col gap-3 rounded-lg border border-border p-4">
    <legend class="px-1 text-sm font-medium">Automation</legend>
    <label class="flex items-center justify-between text-sm">
      Auto play when ready
      <input type="checkbox" bind:checked={settings.current.autoplay} class="accent-[var(--primary)]" />
    </label>
    <label class="flex items-center justify-between text-sm">
      Auto next episode
      <input type="checkbox" bind:checked={settings.current.auto_next} class="accent-[var(--primary)]" />
    </label>
    <label class="flex items-center justify-between gap-3 text-sm">
      Auto-next countdown (seconds)
      <input type="number" min="3" max="60" bind:value={settings.current.countdown_seconds} class="{input} w-24" />
    </label>
    <label class="flex items-center justify-between text-sm">
      Auto skip intro
      <input type="checkbox" bind:checked={settings.current.auto_skip_intro} class="accent-[var(--primary)]" />
    </label>
    <label class="flex items-center justify-between text-sm">
      Auto skip outro
      <input type="checkbox" bind:checked={settings.current.auto_skip_outro} class="accent-[var(--primary)]" />
    </label>
    <label class="flex items-center justify-between text-sm">
      Auto fullscreen on play
      <input type="checkbox" bind:checked={settings.current.auto_fullscreen} class="accent-[var(--primary)]" />
    </label>
  </fieldset>


  <div class="flex items-center gap-3">
    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
    {#if saved}
      <span class="text-sm text-primary">Saved ✓</span>
    {/if}
  </div>
</form>
