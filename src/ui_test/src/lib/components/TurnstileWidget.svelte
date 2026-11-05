<script lang="ts">
  import { TURNSTILE_SITE_KEY } from "$lib/api/account";

  interface TurnstileApi {
    render(el: HTMLElement, opts: Record<string, unknown>): string;
    reset(widgetId?: string): void;
  }

  // eslint-disable-next-line no-useless-assignment -- $bindable default, read by the parent binding
  let { token = $bindable("") }: { token?: string } = $props();

  let container = $state<HTMLDivElement | undefined>();
  let widgetId: string | null = null;

  function tryRender(): boolean {
    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile || !container || widgetId !== null) return !!widgetId;
    widgetId = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: (t: string) => (token = t),
      "expired-callback": () => (token = ""),
      "error-callback": () => (token = "")
    });
    return true;
  }

  $effect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    // The api.js script in index.html loads async — poll briefly until ready.
    if (tryRender()) return;
    const poll = setInterval(() => {
      if (tryRender()) clearInterval(poll);
    }, 250);
    return () => clearInterval(poll);
  });

  export function reset(): void {
    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (turnstile && widgetId !== null) {
      turnstile.reset(widgetId);
      token = "";
    }
  }
</script>

{#if TURNSTILE_SITE_KEY}
  <div bind:this={container} class="cf-turnstile min-h-[65px]"></div>
{/if}
