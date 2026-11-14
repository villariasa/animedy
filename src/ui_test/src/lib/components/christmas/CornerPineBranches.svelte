<script lang="ts">
</script>

<!-- Top-Left Pine Branch: Hugs the corner vertically down the left edge, leaving the Animedy logo 100% visible -->
<div
  class="pointer-events-none fixed top-0 left-0 z-45 w-16 sm:w-24 select-none overflow-visible"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 95 140"
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
      <filter id="corner-branch-shadow-left" x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="1.5" dy="2.5" stdDeviation="2.5" flood-opacity="0.6" flood-color="#000" />
      </filter>
    </defs>

    <g filter="url(#corner-branch-shadow-left)">
      <!-- Wood Stems: Flowing predominantly downwards along the left edge -->
      <path d="M -5 -5 Q 12 35 18 85" stroke="#231710" stroke-width="3" stroke-linecap="round" />
      <path d="M 8 20 Q 24 50 28 98" stroke="#231710" stroke-width="2.2" stroke-linecap="round" />
      <path d="M -2 40 Q 15 70 20 115" stroke="#231710" stroke-width="1.8" stroke-linecap="round" />

      <!-- Deep Background Spruce Needles (Dark Forest Green) -->
      <g stroke="#0f2415" stroke-width="2" stroke-linecap="round">
        <line x1="2" y1="8" x2="24" y2="22" />
        <line x1="6" y1="20" x2="30" y2="34" />
        <line x1="10" y1="35" x2="36" y2="48" />
        <line x1="14" y1="52" x2="38" y2="65" />
        <line x1="16" y1="70" x2="36" y2="84" />
        <line x1="14" y1="88" x2="32" y2="104" />

        <!-- Downward outer needles -->
        <line x1="0" y1="15" x2="12" y2="40" />
        <line x1="4" y1="38" x2="16" y2="65" />
        <line x1="8" y1="62" x2="18" y2="90" />
        <line x1="10" y1="85" x2="18" y2="115" />
      </g>

      <!-- Mid-layer Pine Needles (Vibrant Forest Green) -->
      <g stroke="#1b4526" stroke-width="1.6" stroke-linecap="round">
        <line x1="3" y1="6" x2="22" y2="18" />
        <line x1="8" y1="18" x2="26" y2="30" />
        <line x1="12" y1="32" x2="32" y2="44" />
        <line x1="15" y1="48" x2="34" y2="60" />
        <line x1="17" y1="65" x2="32" y2="78" />
        <line x1="15" y1="82" x2="28" y2="98" />

        <line x1="2" y1="25" x2="10" y2="50" />
        <line x1="6" y1="50" x2="14" y2="78" />
        <line x1="8" y1="75" x2="15" y2="105" />
      </g>

      <!-- Foreground Highlights (Pine Spruce) -->
      <g stroke="#2a6639" stroke-width="1.3" stroke-linecap="round">
        <line x1="5" y1="10" x2="18" y2="20" />
        <line x1="10" y1="24" x2="24" y2="34" />
        <line x1="14" y1="40" x2="28" y2="50" />
        <line x1="16" y1="58" x2="28" y2="68" />
        <line x1="14" y1="75" x2="24" y2="88" />
      </g>

      <!-- Soft Natural Snow Dusting on Upper Foliage -->
      <path
        d="M -5 -2 Q 10 25 15 65"
        stroke="#ffffff"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M 6 15 Q 18 42 22 80"
        stroke="#ffffff"
        stroke-width="2.4"
        stroke-linecap="round"
      />

      <!-- Delicate Snow Caps -->
      <ellipse cx="14" cy="18" rx="6" ry="3" fill="#ffffff" />
      <ellipse cx="20" cy="38" rx="6.5" ry="3" fill="#ffffff" />
      <ellipse cx="22" cy="60" rx="5.5" ry="2.6" fill="#ffffff" />
      <ellipse cx="18" cy="85" rx="5" ry="2.4" fill="#ffffff" />

      <!-- Hanging Crimson Glass Bauble: Tucked tightly to the left margin -->
      <line x1="22" y1="45" x2="22" y2="72" stroke="#d4af37" stroke-width="0.9" />
      <!-- Bauble cap -->
      <rect x="18.5" y="70" width="7" height="3.5" rx="1" fill="url(#corner-gold-cap)" />
      <!-- Bauble sphere -->
      <circle cx="22" cy="85" r="12" fill="url(#corner-ruby-bauble)" />
      <!-- Specular shine -->
      <ellipse cx="18" cy="80" rx="4" ry="2.4" fill="#ffffff" opacity="0.85" transform="rotate(-30 18 80)" />
      <circle cx="22" cy="85" r="11" fill="none" stroke="#ff7b88" stroke-width="0.8" opacity="0.5" />
    </g>
  </svg>
</div>

<!-- Top-Right Pine Branch with Snow & Champagne Bauble (z-45) -->
<div
  class="pointer-events-none fixed top-0 right-0 z-45 w-16 sm:w-24 select-none overflow-visible"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 95 140"
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
      <filter id="corner-branch-shadow-right" x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="1.5" dy="2.5" stdDeviation="2.5" flood-opacity="0.6" flood-color="#000" />
      </filter>
    </defs>

    <g filter="url(#corner-branch-shadow-right)">
      <!-- Stems flowing downwards along right edge -->
      <path d="M -5 -5 Q 12 35 18 85" stroke="#231710" stroke-width="3" stroke-linecap="round" />
      <path d="M 8 20 Q 24 50 28 98" stroke="#231710" stroke-width="2.2" stroke-linecap="round" />
      <path d="M -2 40 Q 15 70 20 115" stroke="#231710" stroke-width="1.8" stroke-linecap="round" />

      <!-- Needles -->
      <g stroke="#0f2415" stroke-width="2" stroke-linecap="round">
        <line x1="2" y1="8" x2="24" y2="22" />
        <line x1="6" y1="20" x2="30" y2="34" />
        <line x1="10" y1="35" x2="36" y2="48" />
        <line x1="14" y1="52" x2="38" y2="65" />
        <line x1="16" y1="70" x2="36" y2="84" />
        <line x1="14" y1="88" x2="32" y2="104" />

        <line x1="0" y1="15" x2="12" y2="40" />
        <line x1="4" y1="38" x2="16" y2="65" />
        <line x1="8" y1="62" x2="18" y2="90" />
      </g>

      <g stroke="#1b4526" stroke-width="1.6" stroke-linecap="round">
        <line x1="3" y1="6" x2="22" y2="18" />
        <line x1="8" y1="18" x2="26" y2="30" />
        <line x1="12" y1="32" x2="32" y2="44" />
        <line x1="15" y1="48" x2="34" y2="60" />
        <line x1="17" y1="65" x2="32" y2="78" />
      </g>

      <g stroke="#2a6639" stroke-width="1.3" stroke-linecap="round">
        <line x1="5" y1="10" x2="18" y2="20" />
        <line x1="10" y1="24" x2="24" y2="34" />
        <line x1="14" y1="40" x2="28" y2="50" />
      </g>

      <!-- Snow Dusting -->
      <path
        d="M -5 -2 Q 10 25 15 65"
        stroke="#ffffff"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M 6 15 Q 18 42 22 80"
        stroke="#ffffff"
        stroke-width="2.4"
        stroke-linecap="round"
      />

      <ellipse cx="14" cy="18" rx="6" ry="3" fill="#ffffff" />
      <ellipse cx="20" cy="38" rx="6.5" ry="3" fill="#ffffff" />
      <ellipse cx="22" cy="60" rx="5.5" ry="2.6" fill="#ffffff" />

      <!-- Hanging Champagne Gold Bauble -->
      <line x1="22" y1="45" x2="22" y2="72" stroke="#d4af37" stroke-width="0.9" />
      <rect x="18.5" y="70" width="7" height="3.5" rx="1" fill="url(#corner-gold-cap)" />
      <circle cx="22" cy="85" r="12" fill="url(#corner-gold-bauble)" />
      <ellipse cx="18" cy="80" rx="4" ry="2.4" fill="#ffffff" opacity="0.85" transform="rotate(-30 18 80)" />
      <circle cx="22" cy="85" r="11" fill="none" stroke="#fff0b3" stroke-width="0.8" opacity="0.5" />
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
      transform: rotate(0.8deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .branch-sway,
    .branch-sway-alt {
      animation: none !important;
    }
  }
</style>
