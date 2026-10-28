<script lang="ts">
  let copied = $state(false);
  let loved = $state(false);
  let loveCount = $state(1342);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://animedy.pages.dev";
  const shareText = "Stream continuous, ad-free anime in HD on Animedy!";

  function copyLink(): void {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(siteUrl).then(() => {
        copied = true;
        setTimeout(() => (copied = false), 2200);
      }).catch(() => undefined);
    }
  }

  function toggleLove(): void {
    if (!loved) {
      loved = true;
      loveCount += 1;
    } else {
      loved = false;
      loveCount -= 1;
    }
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(siteUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`;
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(siteUrl)}&title=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent(shareText)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${siteUrl}`)}`;
</script>

<div class="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-md">
  <!-- Ambient background glow -->
  <div class="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl"></div>
  <div class="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"></div>

  <div class="relative flex flex-col md:flex-row items-center justify-between gap-4">
    <!-- Left: Mascot / Heart Icon + Love This Site Message -->
    <div class="flex items-center gap-3.5">
      <!-- Animated Heart Mascot Badge -->
      <div class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-primary/20 border border-rose-500/30 shadow-inner">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6 text-rose-500 animate-pulse">
          <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
        </svg>
        <span class="absolute -top-1 -right-1 flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
        </span>
      </div>

      <div class="flex flex-col">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-bold tracking-tight text-foreground">Love this site?</h2>
          <span class="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400">
            {loveCount.toLocaleString()} fans
          </span>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Share Animedy and let fellow anime enthusiasts know!
        </p>
      </div>
    </div>

    <!-- Right: Social Share Buttons + Copy Link & Love Button -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Direct Share Icons -->
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground transition-all hover:border-foreground/40 hover:bg-accent hover:text-foreground active:scale-95"
        title="Share on X / Twitter"
        aria-label="Share on X"
      >
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </a>

      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400 active:scale-95"
        title="Share on Facebook"
        aria-label="Share on Facebook"
      >
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      </a>

      <a
        href={redditUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground transition-all hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 active:scale-95"
        title="Share on Reddit"
        aria-label="Share on Reddit"
      >
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z"/>
        </svg>
      </a>

      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground transition-all hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-400 active:scale-95"
        title="Share on Telegram"
        aria-label="Share on Telegram"
      >
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      </a>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 active:scale-95"
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
      >
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.031 0C5.395 0 .018 5.377.018 12.013c0 2.119.553 4.186 1.604 6.009L0 24l6.166-1.618a11.968 11.968 0 0 0 5.865 1.523h.005c6.632 0 12.01-5.377 12.01-12.014A11.95 11.95 0 0 0 12.031 0zm0 21.996h-.004a9.96 9.96 0 0 1-5.078-1.387l-.364-.216-3.771.989 1.006-3.676-.237-.377A9.957 9.957 0 0 1 2.022 12.013c0-5.518 4.49-10.008 10.013-10.008 2.673 0 5.185 1.041 7.073 2.93a9.94 9.94 0 0 1 2.926 7.078c0 5.519-4.49 10.009-10.003 10.009zm5.484-7.498c-.3-.15-1.775-.876-2.05-.976-.275-.1-.475-.15-.675.15s-.775.976-.95 1.176-.35.225-.65.075c-.3-.15-1.267-.467-2.413-1.489-.893-.796-1.496-1.78-1.671-2.08-.175-.3-.019-.462.131-.611.135-.134.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525s-.675-1.625-.925-2.225c-.244-.585-.492-.505-.675-.514-.175-.009-.375-.01-.575-.01s-.525.075-.8.375c-.275.3-1.05 1.026-1.05 2.501s1.075 2.899 1.225 3.1c.15.2 2.115 3.23 5.124 4.53 3.01 1.3 3.01.867 3.56.817.55-.05 1.775-.725 2.025-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
        </svg>
      </a>

      <!-- Copy Link Button with Toast State -->
      <button
        type="button"
        onclick={copyLink}
        class="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3 py-2 text-xs font-semibold text-foreground transition-all hover:bg-accent active:scale-95"
      >
        {#if copied}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5 text-emerald-500">
            <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
          </svg>
          <span class="text-emerald-500 font-bold">Copied!</span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
          Copy Link
        {/if}
      </button>

      <!-- Interactive "I Love It!" Heart Button -->
      <button
        type="button"
        onclick={toggleLove}
        class="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95 {loved ? 'bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/30' : ''}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5 {loved ? 'text-white' : 'text-rose-500'}">
          <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.16-1.107 20.373 20.373 0 0 1-3.69-4.836A7.472 7.472 0 0 1 4 7.5C4 4.462 6.462 2 9.5 2a5.498 5.498 0 0 1 4.298 2.043A5.498 5.498 0 0 1 18.5 7.5c0 1.258-.337 2.44-.925 3.46a20.373 20.373 0 0 1-3.69 4.836 20.758 20.758 0 0 1-1.16 1.107l-.02.01-.005.003h-.002a.75.75 0 0 1-.698 0l-.002-.003Z" />
        </svg>
        {loved ? "Loved!" : "Love Animedy"}
      </button>
    </div>
  </div>
</div>
