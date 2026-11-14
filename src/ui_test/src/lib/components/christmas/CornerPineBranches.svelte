<script lang="ts">
</script>

<!-- Top-Left Pine Branch with Snow & Bauble (z-45 so it is visible, pointer-events-none so logo clicks pass right through) -->
<div
  class="pointer-events-none fixed top-0 left-0 z-45 w-36 sm:w-52 select-none overflow-visible"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 210 135"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-full h-auto overflow-visible branch-sway"
  >
    <defs>
      <!-- Bauble metallic ruby gradient -->
      <radialGradient id="corner-ruby-bauble" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#ff7b88" />
        <stop offset="35%" stop-color="#e6192d" />
        <stop offset="85%" stop-color="#7a0a16" />
        <stop offset="100%" stop-color="#3b030a" />
      </radialGradient>
      <!-- Gold cap gradient -->
      <linearGradient id="corner-gold-cap" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff2b3" />
        <stop offset="50%" stop-color="#d4af37" />
        <stop offset="100%" stop-color="#735c12" />
      </linearGradient>
      <!-- Realistic branch shadow -->
      <filter id="corner-branch-shadow" x="-15%" y="-15%" width="135%" height="135%">
        <feDropShadow dx="2" dy="3" stdDeviation="3" flood-opacity="0.65" flood-color="#000" />
      </filter>
    </defs>

    <g filter="url(#corner-branch-shadow)">
      <!-- Main Wood Stems -->
      <path d="M -10 -10 Q 55 18 125 36" stroke="#231710" stroke-width="3.5" stroke-linecap="round" />
      <path d="M 45 14 Q 85 40 140 58" stroke="#231710" stroke-width="2.5" stroke-linecap="round" />
      <path d="M 22 10 Q 50 50 90 82" stroke="#231710" stroke-width="2.5" stroke-linecap="round" />

      <!-- Deep Background Spruce Needles (Dark Forest Green) -->
      <g stroke="#0f2415" stroke-width="2.2" stroke-linecap="round">
        <line x1="22" y1="2" x2="52" y2="32" />
        <line x1="36" y1="6" x2="70" y2="40" />
        <line x1="55" y1="14" x2="94" y2="50" />
        <line x1="78" y1="20" x2="118" y2="54" />
        <line x1="100" y1="28" x2="145" y2="48" />
        <line x1="116" y1="34" x2="168" y2="52" />

        <line x1="28" y1="20" x2="62" y2="70" />
        <line x1="48" y1="36" x2="88" y2="94" />
        <line x1="68" y1="54" x2="110" y2="105" />
        <line x1="10" y1="14" x2="34" y2="60" />
      </g>

      <!-- Mid-layer Pine Needles (Vibrant Forest Green) -->
      <g stroke="#1b4526" stroke-width="1.8" stroke-linecap="round">
        <line x1="20" y1="0" x2="48" y2="26" />
        <line x1="34" y1="5" x2="66" y2="32" />
        <line x1="52" y1="12" x2="88" y2="44" />
        <line x1="70" y1="18" x2="110" y2="48" />
        <line x1="92" y1="25" x2="135" y2="44" />
        <line x1="108" y1="32" x2="155" y2="46" />

        <line x1="25" y1="18" x2="58" y2="62" />
        <line x1="44" y1="32" x2="82" y2="82" />
        <line x1="62" y1="48" x2="102" y2="94" />
      </g>

      <!-- Foreground Highlights (Pine Spruce) -->
      <g stroke="#2a6639" stroke-width="1.5" stroke-linecap="round">
        <line x1="28" y1="3" x2="52" y2="24" />
        <line x1="45" y1="9" x2="76" y2="32" />
        <line x1="65" y1="16" x2="102" y2="42" />
        <line x1="88" y1="23" x2="126" y2="42" />
        <line x1="104" y1="29" x2="142" y2="44" />
      </g>

      <!-- Heavy Soft Snow Layer on Top of Branches -->
      <path
        d="M -10 -5 Q 35 12 75 28 Q 110 35 155 44"
        stroke="#ffffff"
        stroke-width="3.8"
        stroke-linecap="round"
      />
      <path
        d="M 28 12 Q 62 28 98 52"
        stroke="#ffffff"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M 14 20 Q 40 44 70 70"
        stroke="#ffffff"
        stroke-width="2.8"
        stroke-linecap="round"
      />

      <!-- Organic Snow Caps / Mounds -->
      <ellipse cx="54" cy="21" rx="10" ry="4.5" fill="#ffffff" />
      <ellipse cx="98" cy="33" rx="12" ry="4.5" fill="#ffffff" />
      <ellipse cx="140" cy="44" rx="9" ry="3.8" fill="#ffffff" />
      <ellipse cx="46" cy="44" rx="9" ry="4" fill="#ffffff" />
      <ellipse cx="78" cy="72" rx="8" ry="3.5" fill="#ffffff" />

      <!-- Hanging Crimson Glass Bauble -->
      <line x1="82" y1="42" x2="82" y2="72" stroke="#d4af37" stroke-width="1" />
      <!-- Bauble cap -->
      <rect x="78" y="70" width="8" height="4" rx="1.5" fill="url(#corner-gold-cap)" />
      <!-- Bauble sphere -->
      <circle cx="82" cy="88" r="15" fill="url(#corner-ruby-bauble)" />
      <!-- Specular shine -->
      <ellipse cx="77" cy="82" rx="5" ry="3" fill="#ffffff" opacity="0.8" transform="rotate(-30 77 82)" />
      <circle cx="82" cy="88" r="14" fill="none" stroke="#ff7b88" stroke-width="1" opacity="0.5" />
    </g>
  </svg>
</div>

<!-- Top-Right Pine Branch with Snow & Champagne Bauble (z-45) -->
<div
  class="pointer-events-none fixed top-0 right-0 z-45 w-36 sm:w-52 select-none overflow-visible"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 210 135"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-full h-auto overflow-visible branch-sway-alt scale-x-[-1]"
  >
    <defs>
      <!-- Bauble metallic gold gradient -->
      <radialGradient id="corner-gold-bauble" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#fff8d6" />
        <stop offset="30%" stop-color="#f0c348" />
        <stop offset="75%" stop-color="#a67c1e" />
        <stop offset="100%" stop-color="#4a3507" />
      </radialGradient>
    </defs>

    <g filter="url(#corner-branch-shadow)">
      <!-- Main Wood Stems -->
      <path d="M -10 -10 Q 55 18 125 36" stroke="#231710" stroke-width="3.5" stroke-linecap="round" />
      <path d="M 45 14 Q 85 40 140 58" stroke="#231710" stroke-width="2.5" stroke-linecap="round" />
      <path d="M 22 10 Q 50 50 90 82" stroke="#231710" stroke-width="2.5" stroke-linecap="round" />

      <!-- Needles -->
      <g stroke="#0f2415" stroke-width="2.2" stroke-linecap="round">
        <line x1="22" y1="2" x2="52" y2="32" />
        <line x1="36" y1="6" x2="70" y2="40" />
        <line x1="55" y1="14" x2="94" y2="50" />
        <line x1="78" y1="20" x2="118" y2="54" />
        <line x1="100" y1="28" x2="145" y2="48" />
        <line x1="116" y1="34" x2="168" y2="52" />

        <line x1="28" y1="20" x2="62" y2="70" />
        <line x1="48" y1="36" x2="88" y2="94" />
        <line x1="68" y1="54" x2="110" y2="105" />
      </g>

      <g stroke="#1b4526" stroke-width="1.8" stroke-linecap="round">
        <line x1="20" y1="0" x2="48" y2="26" />
        <line x1="34" y1="5" x2="66" y2="32" />
        <line x1="52" y1="12" x2="88" y2="44" />
        <line x1="70" y1="18" x2="110" y2="48" />
        <line x1="92" y1="25" x2="135" y2="44" />
        <line x1="108" y1="32" x2="155" y2="46" />

        <line x1="25" y1="18" x2="58" y2="62" />
        <line x1="44" y1="32" x2="82" y2="82" />
        <line x1="62" y1="48" x2="102" y2="94" />
      </g>

      <g stroke="#2a6639" stroke-width="1.5" stroke-linecap="round">
        <line x1="28" y1="3" x2="52" y2="24" />
        <line x1="45" y1="9" x2="76" y2="32" />
        <line x1="65" y1="16" x2="102" y2="42" />
        <line x1="88" y1="23" x2="126" y2="42" />
      </g>

      <!-- Snow Dusting -->
      <path
        d="M -10 -5 Q 35 12 75 28 Q 110 35 155 44"
        stroke="#ffffff"
        stroke-width="3.8"
        stroke-linecap="round"
      />
      <path
        d="M 28 12 Q 62 28 98 52"
        stroke="#ffffff"
        stroke-width="3"
        stroke-linecap="round"
      />

      <ellipse cx="54" cy="21" rx="10" ry="4.5" fill="#ffffff" />
      <ellipse cx="98" cy="33" rx="12" ry="4.5" fill="#ffffff" />
      <ellipse cx="140" cy="44" rx="9" ry="3.8" fill="#ffffff" />
      <ellipse cx="46" cy="44" rx="9" ry="4" fill="#ffffff" />

      <!-- Hanging Champagne Gold Bauble -->
      <line x1="85" y1="45" x2="85" y2="70" stroke="#d4af37" stroke-width="1" />
      <rect x="81" y="68" width="8" height="4" rx="1.5" fill="url(#corner-gold-cap)" />
      <circle cx="85" cy="85" r="14" fill="url(#corner-gold-bauble)" />
      <ellipse cx="80" cy="79" rx="4.5" ry="2.8" fill="#ffffff" opacity="0.85" transform="rotate(-30 80 79)" />
      <circle cx="85" cy="85" r="13" fill="none" stroke="#fff0b3" stroke-width="1" opacity="0.5" />
    </g>
  </svg>
</div>

<style>
  .branch-sway {
    transform-origin: 0% 0%;
    animation: corner-sway 7.5s ease-in-out infinite alternate;
  }

  .branch-sway-alt {
    transform-origin: 100% 0%;
    animation: corner-sway 8.2s ease-in-out infinite alternate-reverse;
  }

  @keyframes corner-sway {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(0.9deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .branch-sway,
    .branch-sway-alt {
      animation: none !important;
    }
  }
</style>
