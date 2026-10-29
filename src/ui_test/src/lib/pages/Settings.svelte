<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { settings, DEFAULT_SETTINGS } from "$lib/stores/settings.svelte";

  let saved = $state(false);
  let saving = $state(false);
  let dirty = $state(false);

  const selectClass =
    "h-9 rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary";
  const numberClass =
    "h-9 w-20 rounded-lg border border-border/80 bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary";

  $effect(() => {
    void settings.load();
  });

  function markDirty(): void {
    dirty = true;
    saved = false;
  }

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    saving = true;
    saved = false;
    await settings.save({ ...settings.current });
    saving = false;
    saved = true;
    dirty = false;
    setTimeout(() => (saved = false), 2500);
  }

  function resetDefaults(): void {
    settings.current = { ...DEFAULT_SETTINGS };
    markDirty();
  }
</script>

<!-- Toggle switch, reused across the "Automation" section -->
{#snippet toggle(label: string, description: string, checked: boolean, onchange: (v: boolean) => void)}
  <label class="flex items-center justify-between gap-4 py-2.5 cursor-pointer group">
    <span class="min-w-0">
      <span class="block text-sm font-medium text-foreground">{label}</span>
      <span class="block text-xs text-muted-foreground mt-0.5">{description}</span>
    </span>
    <span class="relative shrink-0">
      <input
        type="checkbox"
        {checked}
        onchange={(e) => onchange(e.currentTarget.checked)}
        class="peer sr-only"
      />
      <span
        class="block h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
      ></span>
      <span
        class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
      ></span>
    </span>
  </label>
{/snippet}

<div class="flex flex-col gap-6 max-w-2xl">
  <!-- Header -->
  <div class="flex items-center gap-3.5 border-b border-border/80 pb-5">
    <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/30">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-6 w-6" aria-hidden="true">
        <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
      </svg>
    </span>
    <div>
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">Settings</h1>
      <p class="text-xs sm:text-sm font-medium text-slate-300 mt-0.5">
        Stored on this device only — no account needed.
      </p>
    </div>
  </div>

  <form class="flex flex-col gap-6" onsubmit={onSubmit} onchange={markDirty} oninput={markDirty}>
    <!-- Player Defaults -->
    <section class="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
            <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold tracking-tight text-foreground">Player Defaults</h2>
          <p class="text-xs text-muted-foreground">How episodes look and sound when you hit play</p>
        </div>
      </div>

      <div class="flex flex-col divide-y divide-border/50">
        <div class="flex items-center justify-between gap-4 py-3">
          <span class="text-sm font-medium text-foreground">Volume</span>
          <div class="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={settings.current.volume}
              class="w-36 sm:w-44 accent-primary"
            />
            <span class="w-10 text-right text-xs font-semibold text-muted-foreground tabular-nums">
              {Math.round(settings.current.volume * 100)}%
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4 py-3">
          <span class="text-sm font-medium text-foreground">Playback speed</span>
          <select bind:value={settings.current.playback_speed} class={selectClass}>
            {#each [0.5, 0.75, 1, 1.25, 1.5, 2] as s (s)}
              <option value={s}>{s}×</option>
            {/each}
          </select>
        </div>

        <div class="flex items-center justify-between gap-4 py-3">
          <span class="text-sm font-medium text-foreground">Subtitle language</span>
          <input
            type="text"
            bind:value={settings.current.subtitle_lang}
            placeholder="en"
            maxlength="8"
            class="{numberClass} w-24 text-center uppercase"
          />
        </div>

        <div class="flex items-center justify-between gap-4 py-3">
          <span class="text-sm font-medium text-foreground">Preferred quality</span>
          <select bind:value={settings.current.preferred_quality} class={selectClass}>
            {#each ["auto", "1080p", "720p", "480p"] as q (q)}
              <option value={q}>{q}</option>
            {/each}
          </select>
        </div>
      </div>
    </section>

    <!-- Automation -->
    <section class="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
      <div class="flex items-center gap-2.5 mb-2">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
            <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold tracking-tight text-foreground">Automation</h2>
          <p class="text-xs text-muted-foreground">Keep episodes flowing without extra taps</p>
        </div>
      </div>

      <div class="flex flex-col divide-y divide-border/50">
        {@render toggle(
          "Autoplay when ready",
          "Start the episode as soon as it loads",
          settings.current.autoplay,
          (v) => (settings.current.autoplay = v)
        )}
        {@render toggle(
          "Auto-next episode",
          "Move to the next episode when one ends",
          settings.current.auto_next,
          (v) => (settings.current.auto_next = v)
        )}

        {#if settings.current.auto_next}
          <div class="flex items-center justify-between gap-4 py-3 pl-1">
            <span class="text-sm text-muted-foreground">Auto-next countdown</span>
            <div class="flex items-center gap-2">
              <input
                type="number"
                min="3"
                max="60"
                bind:value={settings.current.countdown_seconds}
                class={numberClass}
              />
              <span class="text-xs text-muted-foreground">sec</span>
            </div>
          </div>
        {/if}

        {@render toggle(
          "Auto-skip intro",
          "Jump straight past the opening theme",
          settings.current.auto_skip_intro,
          (v) => (settings.current.auto_skip_intro = v)
        )}
        {@render toggle(
          "Auto-skip outro",
          "Skip past the ending credits",
          settings.current.auto_skip_outro,
          (v) => (settings.current.auto_skip_outro = v)
        )}
        {@render toggle(
          "Auto-fullscreen on play",
          "Enter fullscreen automatically when playback starts",
          settings.current.auto_fullscreen,
          (v) => (settings.current.auto_fullscreen = v)
        )}
      </div>
    </section>

    <!-- Save bar -->
    <div class="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
      <div class="min-w-0 text-xs text-muted-foreground">
        {#if saved}
          <span class="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
            </svg>
            Saved
          </span>
        {:else if dirty}
          Unsaved changes
        {:else}
          All changes saved
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onclick={resetDefaults}
          class="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
        >
          Reset to defaults
        </button>
        <Button type="submit" disabled={saving || !dirty}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  </form>
</div>
