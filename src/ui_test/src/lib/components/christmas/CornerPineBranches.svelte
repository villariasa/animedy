<script lang="ts">
</script>

<!-- Top-Left Pine Branch with Snow & Bauble -->
<div
  class="pointer-events-none fixed top-0 left-0 z-20 w-28 sm:w-44 select-none opacity-85 transition-opacity duration-300"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 190 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-full h-auto overflow-visible branch-sway"
  >
    <defs>
      <!-- Bauble metallic gradient -->
      <radialGradient id="ruby-bauble" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#ff7b88" />
        <stop offset="35%" stop-color="#c92837" />
        <stop offset="85%" stop-color="#690e18" />
        <stop offset="100%" stop-color="#3d050c" />
      </radialGradient>
      <!-- Bauble cap gradient -->
      <linearGradient id="gold-cap" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fceda4" />
        <stop offset="50%" stop-color="#c49a37" />
        <stop offset="100%" stop-color="#634a10" />
      </linearGradient>
      <!-- Drop shadow -->
      <filter id="branch-shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="1" dy="2" stdDeviation="2.5" flood-opacity="0.45" flood-color="#000" />
      </filter>
    </defs>

    <g filter="url(#branch-shadow)">
      <!-- Main Wood Stems -->
      <path d="M -5 -5 Q 50 15 110 32" stroke="#2a1f18" stroke-width="3" stroke-linecap="round" />
      <path d="M 40 12 Q 75 35 125 52" stroke="#2a1f18" stroke-width="2" stroke-linecap="round" />
      <path d="M 20 8 Q 45 45 80 72" stroke="#2a1f18" stroke-width="2" stroke-linecap="round" />

      <!-- Deep Background Spruce Needles (Dark Forest Green) -->
      <g stroke="#142b1a" stroke-width="1.8" stroke-linecap="round">
        <line x1="20" y1="2" x2="45" y2="28" />
        <line x1="32" y1="5" x2="62" y2="35" />
        <line x1="48" y1="12" x2="82" y2="44" />
        <line x1="68" y1="18" x2="105" y2="48" />
        <line x1="88" y1="24" x2="128" y2="42" />
        <line x1="102" y1="30" x2="148" y2="45" />

        <line x1="25" y1="18" x2="55" y2="62" />
        <line x1="42" y1="32" x2="78" y2="82" />
        <line x1="60" y1="48" x2="98" y2="92" />
        <line x1="8" y1="12" x2="30" y2="52" />
      </g>

      <!-- Mid-layer Pine Needles (Natural Pine Green) -->
      <g stroke="#1e4428" stroke-width="1.6" stroke-linecap="round">
        <line x1="18" y1="0" x2="42" y2="22" />
        <line x1="30" y1="4" x2="58" y2="28" />
        <line x1="45" y1="10" x2="78" y2="38" />
        <line x1="62" y1="15" x2="98" y2="42" />
        <line x1="82" y1="22" x2="120" y2="38" />
        <line x1="95" y1="28" x2="138" y2="40" />

        <line x1="22" y1="15" x2="50" y2="55" />
        <line x1="38" y1="28" x2="72" y2="72" />
        <line x1="55" y1="42" x2="90" y2="82" />
      </g>

      <!-- Foreground Pine Needles (Spruce Highlights) -->
      <g stroke="#2d5e38" stroke-width="1.3" stroke-linecap="round">
        <line x1="24" y1="2" x2="46" y2="20" />
        <line x1="40" y1="8" x2="68" y2="28" />
        <line x1="58" y1="14" x2="90" y2="36" />
        <line x1="78" y1="20" x2="112" y2="36" />
        <line x1="92" y1="25" x2="126" y2="38" />
      </g>

      <!-- Soft Natural Snow Dusting on Upper Needles -->
      <path
        d="M -5 0 Q 30 10 65 24 Q 95 30 135 38"
        stroke="#eef4f8"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.92"
      />
      <path
        d="M 25 10 Q 55 24 85 45"
        stroke="#eef4f8"
        stroke-width="2.2"
        stroke-linecap="round"
        opacity="0.88"
      />
      <path
        d="M 12 18 Q 35 38 60 62"
        stroke="#eef4f8"
        stroke-width="2.2"
        stroke-linecap="round"
        opacity="0.85"
      />

      <!-- Delicate Snow Caps -->
      <ellipse cx="48" cy="18" rx="8" ry="3.5" fill="#f8fafc" opacity="0.95" />
      <ellipse cx="86" cy="29" rx="10" ry="3.5" fill="#f8fafc" opacity="0.95" />
      <ellipse cx="122" cy="38" rx="7" ry="2.8" fill="#f8fafc" opacity="0.92" />
      <ellipse cx="40" cy="38" rx="7" ry="3" fill="#f8fafc" opacity="0.9" />
      <ellipse cx="68" cy="62" rx="6" ry="2.5" fill="#f8fafc" opacity="0.88" />

      <!-- Hanging Crimson Glass Bauble -->
      <!-- Gold hanging thread -->
      <line x1="72" y1="36" x2="72" y2="60" stroke="#c49a37" stroke-width="0.75" />
      <!-- Bauble cap -->
      <rect x="69" y="58" width="6" height="3" rx="1" fill="url(#gold-cap)" />
      <!-- Bauble sphere -->
      <circle cx="72" cy="73" r="12" fill="url(#ruby-bauble)" />
      <!-- Spherical glass specular reflection -->
      <ellipse cx="68" cy="68" rx="4" ry="2.5" fill="#ffffff" opacity="0.65" transform="rotate(-30 68 68)" />
      <!-- Subtle rim glow -->
      <circle cx="72" cy="73" r="11" fill="none" stroke="#ff8591" stroke-width="0.8" opacity="0.4" />
    </g>
  </svg>
</div>

<!-- Top-Right Pine Branch with Snow & Champagne Bauble -->
<div
  class="pointer-events-none fixed top-0 right-0 z-20 w-28 sm:w-44 select-none opacity-85 transition-opacity duration-300"
  aria-hidden="true"
>
  <svg
    viewBox="0 0 190 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-full h-auto overflow-visible branch-sway-alt scale-x-[-1]"
  >
    <defs>
      <!-- Champagne gold metallic gradient -->
      <radialGradient id="gold-bauble" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#fff5cc" />
        <stop offset="30%" stop-color="#e0b852" />
        <stop offset="75%" stop-color="#946a1a" />
        <stop offset="100%" stop-color="#473105" />
      </radialGradient>
    </defs>

    <g filter="url(#branch-shadow)">
      <!-- Main Wood Stems -->
      <path d="M -5 -5 Q 50 15 110 32" stroke="#2a1f18" stroke-width="3" stroke-linecap="round" />
      <path d="M 40 12 Q 75 35 125 52" stroke="#2a1f18" stroke-width="2" stroke-linecap="round" />
      <path d="M 20 8 Q 45 45 80 72" stroke="#2a1f18" stroke-width="2" stroke-linecap="round" />

      <!-- Needles -->
      <g stroke="#142b1a" stroke-width="1.8" stroke-linecap="round">
        <line x1="20" y1="2" x2="45" y2="28" />
        <line x1="32" y1="5" x2="62" y2="35" />
        <line x1="48" y1="12" x2="82" y2="44" />
        <line x1="68" y1="18" x2="105" y2="48" />
        <line x1="88" y1="24" x2="128" y2="42" />
        <line x1="102" y1="30" x2="148" y2="45" />

        <line x1="25" y1="18" x2="55" y2="62" />
        <line x1="42" y1="32" x2="78" y2="82" />
        <line x1="60" y1="48" x2="98" y2="92" />
      </g>

      <g stroke="#1e4428" stroke-width="1.6" stroke-linecap="round">
        <line x1="18" y1="0" x2="42" y2="22" />
        <line x1="30" y1="4" x2="58" y2="28" />
        <line x1="45" y1="10" x2="78" y2="38" />
        <line x1="62" y1="15" x2="98" y2="42" />
        <line x1="82" y1="22" x2="120" y2="38" />
        <line x1="95" y1="28" x2="138" y2="40" />

        <line x1="22" y1="15" x2="50" y2="55" />
        <line x1="38" y1="28" x2="72" y2="72" />
        <line x1="55" y1="42" x2="90" y2="82" />
      </g>

      <g stroke="#2d5e38" stroke-width="1.3" stroke-linecap="round">
        <line x1="24" y1="2" x2="46" y2="20" />
        <line x1="40" y1="8" x2="68" y2="28" />
        <line x1="58" y1="14" x2="90" y2="36" />
        <line x1="78" y1="20" x2="112" y2="36" />
        <line x1="92" y1="25" x2="126" y2="38" />
      </g>

      <!-- Snow Dusting -->
      <path
        d="M -5 0 Q 30 10 65 24 Q 95 30 135 38"
        stroke="#eef4f8"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.92"
      />
      <path
        d="M 25 10 Q 55 24 85 45"
        stroke="#eef4f8"
        stroke-width="2.2"
        stroke-linecap="round"
        opacity="0.88"
      />

      <!-- Snow Caps -->
      <ellipse cx="48" cy="18" rx="8" ry="3.5" fill="#f8fafc" opacity="0.95" />
      <ellipse cx="86" cy="29" rx="10" ry="3.5" fill="#f8fafc" opacity="0.95" />
      <ellipse cx="122" cy="38" rx="7" ry="2.8" fill="#f8fafc" opacity="0.92" />
      <ellipse cx="40" cy="38" rx="7" ry="3" fill="#f8fafc" opacity="0.9" />

      <!-- Hanging Champagne Glass Bauble -->
      <line x1="75" y1="38" x2="75" y2="58" stroke="#c49a37" stroke-width="0.75" />
      <rect x="72" y="56" width="6" height="3" rx="1" fill="url(#gold-cap)" />
      <circle cx="75" cy="71" r="11" fill="url(#gold-bauble)" />
      <ellipse cx="71" cy="66" rx="3.5" ry="2.2" fill="#ffffff" opacity="0.7" transform="rotate(-30 71 66)" />
      <circle cx="75" cy="71" r="10" fill="none" stroke="#fff0b3" stroke-width="0.8" opacity="0.4" />
    </g>
  </svg>
</div>

<style>
  .branch-sway {
    transform-origin: 0% 0%;
    animation: slow-sway 7.5s ease-in-out infinite alternate;
  }

  .branch-sway-alt {
    transform-origin: 100% 0%;
    animation: slow-sway 8.2s ease-in-out infinite alternate-reverse;
  }

  @keyframes slow-sway {
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
