<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import HoverSelect from "$lib/components/HoverSelect.svelte";
  import { settings, DEFAULT_SETTINGS } from "$lib/stores/settings.svelte";
  import { buildBackup, downloadBackup, restoreBackup, BackupParseError } from "$lib/backup";
  import {
    notificationsSupported,
    notificationPermission,
    requestNotificationPermission,
    type NotifPermission
  } from "$lib/notifications";

  let notifPermission = $state<NotifPermission>(notificationPermission());
  let requestingNotif = $state(false);

  async function enableNotifications(): Promise<void> {
    requestingNotif = true;
    notifPermission = await requestNotificationPermission();
    requestingNotif = false;
  }

  let saved = $state(false);
  let saving = $state(false);
  let dirty = $state(false);

  let exporting = $state(false);
  let restoreFileInput = $state<HTMLInputElement | undefined>(undefined);
  let restoreStatus = $state<{ type: "success" | "error"; message: string } | null>(null);
  let restoring = $state(false);
  let confirmingRestore = $state(false);

  async function exportBackup(): Promise<void> {
    exporting = true;
    try {
      downloadBackup(await buildBackup());
    } finally {
      exporting = false;
    }
  }

  function pickRestoreFile(): void {
    confirmingRestore = false;
    restoreFileInput?.click();
  }

  async function onRestoreFileChosen(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    restoring = true;
    restoreStatus = null;
    try {
      await restoreBackup(await file.text());
      restoreStatus = { type: "success", message: "Backup restored — your data is back." };
    } catch (err) {
      restoreStatus = {
        type: "error",
        message: err instanceof BackupParseError ? err.message : "Couldn't restore that file."
      };
    } finally {
      restoring = false;
      if (restoreFileInput) restoreFileInput.value = "";
    }
  }

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

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6">
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
          <HoverSelect
            value={String(settings.current.playback_speed)}
            onValueChange={(v) => { settings.current.playback_speed = Number(v); markDirty(); }}
            options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => ({ value: String(s), label: `${s}×` }))}
            triggerClass="w-24"
          />
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
          <HoverSelect
            value={settings.current.preferred_quality}
            onValueChange={(v) => { settings.current.preferred_quality = v; markDirty(); }}
            options={["auto", "1080p", "720p", "480p"].map((q) => ({ value: q, label: q }))}
            triggerClass="w-24"
          />
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

  <!-- Data & Backup (outside the form — unrelated to player-settings save state) -->
  <section class="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
    <div class="flex items-center gap-2.5 mb-4">
      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
          <path fill-rule="evenodd" d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Zm10.25 7.25a.75.75 0 0 0-1.5 0v2.19l-.72-.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l2-2a.75.75 0 1 0-1.06-1.06l-.72.72v-2.19Z" clip-rule="evenodd" />
        </svg>
      </span>
      <div>
        <h2 class="text-sm font-bold tracking-tight text-foreground">Data &amp; Backup</h2>
        <p class="text-xs text-muted-foreground">Everything here lives only in this browser — back it up before clearing site data</p>
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onclick={exportBackup}
        disabled={exporting}
        class="inline-flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-background/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v8.69l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V2.75A.75.75 0 0 1 10 2ZM4 15.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
        </svg>
        {exporting ? "Exporting…" : "Download backup"}
      </button>

      {#if !confirmingRestore}
        <button
          type="button"
          onclick={() => (confirmingRestore = true)}
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-background/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 18a.75.75 0 0 1-.75-.75V8.56L6.53 11.28a.75.75 0 0 1-1.06-1.06l4-4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1-1.06 1.06L10.75 8.56v8.69A.75.75 0 0 1 10 18ZM4 4.75a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 4.75Z" clip-rule="evenodd" />
          </svg>
          Restore from file
        </button>
      {:else}
        <div class="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <span class="text-xs font-medium text-amber-300">This replaces all current data. Continue?</span>
          <button
            type="button"
            onclick={pickRestoreFile}
            disabled={restoring}
            class="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {restoring ? "Restoring…" : "Choose file"}
          </button>
          <button
            type="button"
            onclick={() => (confirmingRestore = false)}
            class="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      {/if}
      <input
        bind:this={restoreFileInput}
        type="file"
        accept="application/json"
        class="hidden"
        onchange={onRestoreFileChosen}
      />
    </div>

    {#if restoreStatus}
      <p class="mt-3 text-xs font-medium {restoreStatus.type === 'success' ? 'text-emerald-400' : 'text-destructive'}">
        {restoreStatus.message}
      </p>
    {/if}
  </section>

  <!-- Notifications -->
  {#if notificationsSupported()}
    <section class="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" clip-rule="evenodd" />
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold tracking-tight text-foreground">Notifications</h2>
          <p class="text-xs text-muted-foreground">Get a browser notification when a liked anime's new episode airs — even if this tab isn't open</p>
        </div>
      </div>

      {#if notifPermission === "granted"}
        <p class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
            <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
          </svg>
          Notifications enabled
        </p>
      {:else if notifPermission === "denied"}
        <p class="text-xs text-muted-foreground">
          Notifications are blocked for this site. Enable them in your browser's site settings to turn this on.
        </p>
      {:else}
        <button
          type="button"
          onclick={enableNotifications}
          disabled={requestingNotif}
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {requestingNotif ? "Requesting…" : "Enable notifications"}
        </button>
      {/if}
    </section>
  {/if}
</div>
