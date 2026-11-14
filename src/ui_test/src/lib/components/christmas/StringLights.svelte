<script lang="ts">
  import { onMount } from "svelte";

  interface Bulb {
    x: number;
    color: string;
    glow: string;
    duration: string;
    delay: string;
  }

  let containerWidth = $state(1200);
  let bulbs = $state<Bulb[]>([]);

  const PALETTE = [
    { color: "#e8b03e", glow: "rgba(232, 176, 62, 0.45)" }, // Warm gold
    { color: "#d9434e", glow: "rgba(217, 67, 78, 0.4)" },   // Cranberry ruby
    { color: "#3da669", glow: "rgba(61, 166, 105, 0.38)" }, // Soft pine green
    { color: "#faecc5", glow: "rgba(250, 236, 197, 0.45)" }, // Champagne soft white
    { color: "#e8983e", glow: "rgba(232, 152, 62, 0.4)" }   // Amber glow
  ];

  function computeBulbs(w: number) {
    const spacing = Math.max(38, Math.min(54, w / 28));
    const count = Math.max(8, Math.floor(w / spacing));
    const actualSpacing = w / count;

    const list: Bulb[] = [];
    for (let i = 0; i <= count; i++) {
      const p = PALETTE[i % PALETTE.length];
      const dur = 4.2 + (i % 5) * 0.7;
      const del = (i * 0.45) % 3.5;
      list.push({
        x: i * actualSpacing,
        color: p.color,
        glow: p.glow,
        duration: `${dur.toFixed(1)}s`,
        delay: `${del.toFixed(2)}s`
      });
    }
    bulbs = list;
  }

  onMount(() => {
    const update = () => {
      containerWidth = window.innerWidth;
      computeBulbs(containerWidth);
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  });
</script>

<div
  class="pointer-events-none fixed inset-x-0 top-0 z-30 h-11 w-full overflow-hidden select-none"
  aria-hidden="true"
>
  <svg
    class="h-full w-full overflow-visible"
    viewBox="0 0 {containerWidth} 36"
    preserveAspectRatio="none"
  >
    <defs>
      <!-- Subtle wire shadow -->
      <filter id="wire-shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-opacity="0.4" flood-color="#000" />
      </filter>
    </defs>

    <!-- Dark pine twisted wire with natural catenary sagging between bulbs -->
    {#if bulbs.length > 1}
      {#each bulbs.slice(0, -1) as bulb, idx}
        {@const next = bulbs[idx + 1]}
        {@const midX = (bulb.x + next.x) / 2}
        {@const sag = Math.min(10, (next.x - bulb.x) * 0.22)}
        <path
          d="M {bulb.x} 0 Q {midX} {sag + 2} {next.x} 0"
          fill="none"
          stroke="#162619"
          stroke-width="1.8"
          stroke-linecap="round"
          filter="url(#wire-shadow)"
        />
        <path
          d="M {bulb.x} 0 Q {midX} {sag + 1.5} {next.x} 0"
          fill="none"
          stroke="#263d2b"
          stroke-width="0.8"
          stroke-linecap="round"
          opacity="0.75"
        />
      {/each}
    {/if}

    <!-- Light bulbs with sockets and soft glow -->
    {#each bulbs as b, idx}
      <!-- Socket fixture -->
      <rect
        x={b.x - 2.5}
        y="1"
        width="5"
        height="4"
        rx="1"
        fill="#142116"
        stroke="#273a2a"
        stroke-width="0.6"
      />
      <!-- Tiny socket brass collar -->
      <rect
        x={b.x - 2}
        y="4"
        width="4"
        height="1.5"
        fill="#5a4d2f"
        opacity="0.85"
      />

      <!-- Glass bulb with gentle CSS breathing glow -->
      <g
        class="christmas-bulb-glow"
        style="--bulb-color: {b.color}; --bulb-glow: {b.glow}; --anim-dur: {b.duration}; --anim-delay: {b.delay};"
      >
        <!-- Teardrop shaped realistic holiday bulb -->
        <path
          d="M {b.x - 2.5} 5.5
             C {b.x - 4.5} 8.5, {b.x - 4} 13.5, {b.x} 17
             C {b.x + 4} 13.5, {b.x + 4.5} 8.5, {b.x + 2.5} 5.5
             Z"
          fill={b.color}
          opacity="0.92"
        />
        <!-- Inner warm filament filament highlight -->
        <ellipse
          cx={b.x}
          cy="10.5"
          rx="1.4"
          ry="3"
          fill="#fff"
          opacity="0.7"
        />
        <!-- Glass shine curve -->
        <path
          d="M {b.x - 2.2} 8 C {b.x - 2.8} 10.5, {b.x - 1.8} 13, {b.x - 0.5} 14.5"
          fill="none"
          stroke="#ffffff"
          stroke-width="0.7"
          stroke-linecap="round"
          opacity="0.65"
        />
      </g>
    {/each}
  </svg>
</div>

<style>
  .christmas-bulb-glow {
    filter: drop-shadow(0 0 5px var(--bulb-glow)) drop-shadow(0 0 10px var(--bulb-glow));
    animation: gentle-glow var(--anim-dur) ease-in-out infinite alternate;
    animation-delay: var(--anim-delay);
    will-change: filter, opacity;
  }

  @keyframes gentle-glow {
    0% {
      opacity: 0.72;
      filter: drop-shadow(0 0 3px var(--bulb-glow));
    }
    50% {
      opacity: 0.95;
      filter: drop-shadow(0 0 7px var(--bulb-glow)) drop-shadow(0 0 13px var(--bulb-glow));
    }
    100% {
      opacity: 0.78;
      filter: drop-shadow(0 0 4px var(--bulb-glow));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .christmas-bulb-glow {
      animation: none !important;
      opacity: 0.85;
      filter: drop-shadow(0 0 5px var(--bulb-glow));
    }
  }
</style>

