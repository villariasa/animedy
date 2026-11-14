<script lang="ts">
</script>

<div
  class="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-4 sm:h-6 w-full select-none overflow-hidden"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 1200 24"
    preserveAspectRatio="none"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-full w-full opacity-60"
  >
    <defs>
      <!-- Gradient for soft powder accumulation -->
      <linearGradient id="snow-drift-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
        <stop offset="35%" stop-color="#e2ecf5" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#c9ddf0" stop-opacity="0.45" />
      </linearGradient>
    </defs>

    <!-- Natural undulating snow drift contour -->
    <path
      d="M 0 24
         L 0 14
         Q 75 8, 160 12
         T 340 9
         Q 450 15, 560 11
         T 760 13
         Q 870 7, 980 12
         T 1200 10
         L 1200 24
         Z"
      fill="url(#snow-drift-gradient)"
    />

    <!-- Faint icy crystal crest line along the top ridge -->
    <path
      d="M 0 14
         Q 75 8, 160 12
         T 340 9
         Q 450 15, 560 11
         T 760 13
         Q 870 7, 980 12
         T 1200 10"
      stroke="#ffffff"
      stroke-width="0.8"
      stroke-opacity="0.5"
      fill="none"
    />
  </svg>
</div>
