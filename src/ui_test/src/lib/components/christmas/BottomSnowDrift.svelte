<script lang="ts">
</script>

<div
  class="pointer-events-none fixed inset-x-0 bottom-0 z-35 h-5 sm:h-8 w-full select-none overflow-hidden"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 1200 28"
    preserveAspectRatio="none"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="h-full w-full"
  >
    <defs>
      <!-- Gradient for crisp snowy powder accumulation -->
      <linearGradient id="snow-drift-gradient-vibrant" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
        <stop offset="25%" stop-color="#f0f6fc" stop-opacity="0.75" />
        <stop offset="60%" stop-color="#d4e6f9" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#a8cdfc" stop-opacity="0.95" />
      </linearGradient>
      <filter id="snow-glow" x="-5%" y="-20%" width="110%" height="150%">
        <feDropShadow dx="0" dy="-1" stdDeviation="2" flood-color="#ffffff" flood-opacity="0.45" />
      </filter>
    </defs>

    <!-- Natural undulating snow drift contour -->
    <path
      d="M 0 28
         L 0 16
         Q 80 8, 175 13
         T 370 9
         Q 490 17, 610 11
         T 830 14
         Q 950 7, 1070 13
         T 1200 10
         L 1200 28
         Z"
      fill="url(#snow-drift-gradient-vibrant)"
      filter="url(#snow-glow)"
    />

    <!-- Sparkling snow crest rim along the top ridge -->
    <path
      d="M 0 16
         Q 80 8, 175 13
         T 370 9
         Q 490 17, 610 11
         T 830 14
         Q 950 7, 1070 13
         T 1200 10"
      stroke="#ffffff"
      stroke-width="1.8"
      stroke-linecap="round"
      fill="none"
    />
  </svg>
</div>
