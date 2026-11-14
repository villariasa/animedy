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
    { color: "#ff2e4d", glow: "rgba(255, 46, 77, 0.8)" },  // Ruby red
    { color: "#ffb81c", glow: "rgba(255, 184, 28, 0.8)" }, // Warm gold
    { color: "#00e676", glow: "rgba(0, 230, 118, 0.75)" },// Emerald pine
    { color: "#00e5ff", glow: "rgba(0, 229, 255, 0.75)" },// Icy cyan
    { color: "#fff5d0", glow: "rgba(255, 245, 208, 0.85)" }, // Warm champagne
    { color: "#ff6d00", glow: "rgba(255, 109, 0, 0.8)" }  // Festive orange
  ];

  function computeBulbs(w: number) {
    const spacing = Math.max(34, Math.min(50, w / 30));
    const count = Math.max(10, Math.floor(w / spacing));
    const actualSpacing = w / count;

    const list: Bulb[] = [];
    for (let i = 0; i <= count; i++) {
      const p = PALETTE[i % PALETTE.length];
      const dur = 3.6 + (i % 4) * 0.8;
      const del = (i * 0.4) % 3.2;
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

<!-- Placed right along the bottom edge of the sticky header (top-[51px]) at z-45 so it is 100% visible -->
<div
  class="pointer-events-none fixed inset-x-0 top-[51px] z-45 h-9 w-full overflow-visible select-none"
  aria-hidden="true"
>
  <svg
    class="h-full w-full overflow-visible"
    viewBox="0 0 {containerWidth} 32"
    preserveAspectRatio="none"
  >
    <defs>
      <filter id="bulb-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-opacity="0.6" flood-color="#000" />
      </filter>
    </defs>

    <!-- Wire string catenary draping between bulbs -->
    {#if bulbs.length > 1}
      {#each bulbs.slice(0, -1) as bulb, idx}
        {@const next = bulbs[idx + 1]}
        {@const midX = (bulb.x + next.x) / 2}
        {@const sag = Math.min(9, (next.x - bulb.x) * 0.2)}
        <!-- Dark green twisted cord -->
        <path
          d="M {bulb.x} 0 Q {midX} {sag + 2} {next.x} 0"
          fill="none"
          stroke="#0f1d13"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          d="M {bulb.x} 0 Q {midX} {sag + 1.5} {next.x} 0"
          fill="none"
          stroke="#1b3d24"
          stroke-width="1"
          stroke-linecap="round"
          opacity="0.85"
        />
      {/each}
    {/if}

    <!-- Bulbs with dark socket clips and glowing glass capsules -->
    {#each bulbs as b}
      <!-- Socket collar -->
      <rect
        x={b.x - 2.5}
        y="1"
        width="5"
        height="4"
        rx="1"
        fill="#0b160e"
        stroke="#1c3622"
        stroke-width="0.8"
      />
      <rect
        x={b.x - 2}
        y="4"
        width="4"
        height="1.5"
        fill="#7c6020"
      />

      <!-- Glowing bulb -->
      <g
        class="festive-bulb"
        style="--bulb-color: {b.color}; --bulb-glow: {b.glow}; --anim-dur: {b.duration}; --anim-delay: {b.delay};"
      >
        <!-- Glass bulb body -->
        <path
          d="M {b.x - 2.5} 5.5
             C {b.x - 5} 9, {b.x - 4.5} 14.5, {b.x} 18
             C {b.x + 4.5} 14.5, {b.x + 5} 9, {b.x + 2.5} 5.5
             Z"
          fill={b.color}
          opacity="0.96"
          filter="url(#bulb-shadow)"
        />
        <!-- Inner bright core -->
        <ellipse
          cx={b.x}
          cy="11"
          rx="1.6"
          ry="3.5"
          fill="#ffffff"
          opacity="0.85"
        />
        <!-- Glass highlight reflection -->
        <path
          d="M {b.x - 2.2} 8 C {b.x - 3} 10.5, {b.x - 2} 13.5, {b.x - 0.5} 15"
          fill="none"
          stroke="#ffffff"
          stroke-width="0.8"
          stroke-linecap="round"
          opacity="0.8"
        />
      </g>
    {/each}
  </svg>
</div>

<style>
  .festive-bulb {
    filter: drop-shadow(0 0 6px var(--bulb-glow)) drop-shadow(0 0 12px var(--bulb-glow));
    animation: festive-pulse var(--anim-dur) ease-in-out infinite alternate;
    animation-delay: var(--anim-delay);
    will-change: filter, opacity;
  }

  @keyframes festive-pulse {
    0% {
      opacity: 0.8;
      filter: drop-shadow(0 0 4px var(--bulb-glow)) drop-shadow(0 0 8px var(--bulb-glow));
    }
    50% {
      opacity: 1;
      filter: drop-shadow(0 0 8px var(--bulb-glow)) drop-shadow(0 0 16px var(--bulb-glow));
    }
    100% {
      opacity: 0.85;
      filter: drop-shadow(0 0 5px var(--bulb-glow)) drop-shadow(0 0 10px var(--bulb-glow));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .festive-bulb {
      animation: none !important;
      opacity: 0.95;
      filter: drop-shadow(0 0 6px var(--bulb-glow));
    }
  }
</style>
