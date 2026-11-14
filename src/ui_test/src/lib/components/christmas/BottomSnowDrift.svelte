<script lang="ts">
</script>

<!-- Bottom Snow Scene with Snowdrift, Christmas Tree, Deer, Snowman and Children -->
<div class="pointer-events-none fixed inset-x-0 bottom-0 z-35 select-none overflow-visible" aria-hidden="true">
  <!-- Undulating Crisp Snow Drift Base -->
  <div class="relative h-5 sm:h-7 w-full overflow-hidden">
    <svg
      viewBox="0 0 1200 28"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="h-full w-full"
    >
      <defs>
        <linearGradient id="snow-drift-gradient-vibrant" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
          <stop offset="25%" stop-color="#f0f6fc" stop-opacity="0.8" />
          <stop offset="60%" stop-color="#d4e6f9" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#a8cdfc" stop-opacity="0.98" />
        </linearGradient>
        <filter id="snow-glow" x="-5%" y="-20%" width="110%" height="150%">
          <feDropShadow dx="0" dy="-1" stdDeviation="2" flood-color="#ffffff" flood-opacity="0.45" />
        </filter>
      </defs>

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

  <!-- Left Flank: Small Christmas Tree & Winter Deer (Height ~40px-48px, tasteful and not too tall) -->
  <div class="pointer-events-none absolute bottom-2 sm:bottom-3 left-2 sm:left-6 w-24 sm:w-36 select-none overflow-visible">
    <svg viewBox="0 0 90 52" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto overflow-visible">
      <!-- Shadow on snow -->
      <ellipse cx="25" cy="46" rx="16" ry="3.5" fill="#000000" opacity="0.25" />
      <ellipse cx="64" cy="46" rx="14" ry="3" fill="#000000" opacity="0.2" />

      <!-- Small Christmas Tree -->
      <!-- Trunk -->
      <rect x="22" y="38" width="5.5" height="9" rx="1" fill="#3e2723" />
      <!-- Tier 3 (Bottom) -->
      <path d="M 6 39 L 24.5 24 L 43 39 Z" fill="#1b4526" />
      <path d="M 8 39 Q 24.5 35 41 39" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" />
      <!-- Tier 2 (Middle) -->
      <path d="M 10 27 L 24.5 14 L 39 27 Z" fill="#235a32" />
      <path d="M 12 27 Q 24.5 24 37 27" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
      <!-- Tier 1 (Top) -->
      <path d="M 15 16 L 24.5 5 L 34 16 Z" fill="#2d6e3e" />
      <path d="M 16 16 Q 24.5 14 33 16" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
      <!-- Tree Star -->
      <polygon points="24.5,1.5 26,5.5 30,5.5 27,8.5 28,12.5 24.5,10 21,12.5 22,8.5 19,5.5 23,5.5" fill="#ffd54f" />
      <!-- Tiny fairy lights with soft glow -->
      <circle cx="18" cy="34" r="1.3" fill="#ff4081" />
      <circle cx="28" cy="31" r="1.3" fill="#ffd54f" />
      <circle cx="21" cy="22" r="1.3" fill="#00e5ff" />
      <circle cx="27" cy="18" r="1.3" fill="#ff5252" />
      <circle cx="20" cy="13" r="1" fill="#76ff03" />

      <!-- Peaceful Winter Deer standing in snow -->
      <!-- Back legs -->
      <path d="M 68 35 L 67 46 M 72 34 L 73 46" stroke="#5d391e" stroke-width="2" stroke-linecap="round" />
      <!-- Front legs -->
      <path d="M 55 34 L 54 46 M 59 35 L 59 46" stroke="#5d391e" stroke-width="2" stroke-linecap="round" />
      <!-- Body -->
      <ellipse cx="63" cy="31" rx="11" ry="7" fill="#8d5b38" />
      <!-- White underbelly -->
      <path d="M 55 33 Q 63 36 71 33 Q 63 34.5 55 33 Z" fill="#ffffff" opacity="0.9" />
      <!-- Tail -->
      <path d="M 73 28 Q 77 26 76 31 Z" fill="#ffffff" />
      <!-- Neck and Head -->
      <path d="M 55 30 Q 51 22 52 17 Q 56 16 57 21 Z" fill="#8d5b38" />
      <!-- Head -->
      <ellipse cx="50" cy="17" rx="4.5" ry="3.5" fill="#8d5b38" />
      <ellipse cx="47" cy="18" rx="2" ry="1.5" fill="#4a2e18" />
      <!-- Eye -->
      <circle cx="50.5" cy="16" r="0.8" fill="#1a110a" />
      <!-- Ear -->
      <path d="M 53 15 Q 57 11 56 15 Z" fill="#8d5b38" />
      <!-- Delicate Antlers -->
      <path d="M 51 14 Q 48 7 45 5 M 48 9 Q 45 9 44 7 M 51 14 Q 54 8 56 5 M 53 10 Q 56 10 58 8" stroke="#d7ccc8" stroke-width="1.2" stroke-linecap="round" />
      <circle cx="45" cy="5" r="0.8" fill="#ffffff" />
      <circle cx="56" cy="5" r="0.8" fill="#ffffff" />
    </svg>
  </div>

  <!-- Right Flank: Cute Snowman & Children (Placed well to the left of the bottom-right chat bubble) -->
  <div class="pointer-events-none absolute bottom-2 sm:bottom-3 right-16 sm:right-24 md:right-32 w-28 sm:w-40 select-none overflow-visible">
    <svg viewBox="0 0 95 52" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto overflow-visible">
      <!-- Shadow on snow -->
      <ellipse cx="38" cy="46" rx="14" ry="3.5" fill="#000000" opacity="0.25" />
      <ellipse cx="16" cy="46" rx="9" ry="2.5" fill="#000000" opacity="0.2" />
      <ellipse cx="66" cy="46" rx="10" ry="2.5" fill="#000000" opacity="0.2" />

      <!-- Snowman (Center of cluster) -->
      <!-- Bottom ball -->
      <circle cx="38" cy="35" r="10" fill="#f4f8fd" />
      <path d="M 30 39 Q 38 44 46 39" fill="none" stroke="#d5e3f3" stroke-width="2" opacity="0.7" />
      <!-- Middle ball -->
      <circle cx="38" cy="21" r="7.5" fill="#ffffff" />
      <!-- Coal buttons -->
      <circle cx="38" cy="22" r="0.9" fill="#212121" />
      <circle cx="38" cy="26" r="0.9" fill="#212121" />
      <!-- Head ball -->
      <circle cx="38" cy="10" r="5.5" fill="#ffffff" />
      <!-- Coal eyes & smile -->
      <circle cx="36.5" cy="9" r="0.7" fill="#212121" />
      <circle cx="39.5" cy="9" r="0.7" fill="#212121" />
      <path d="M 36.5 12 Q 38 13.5 39.5 12" stroke="#212121" stroke-width="0.6" stroke-linecap="round" fill="none" />
      <!-- Carrot nose -->
      <polygon points="38,10.5 34,11.2 38,11.8" fill="#ff6d00" />
      <!-- Red scarf -->
      <rect x="33" y="14.5" width="10" height="3" rx="1.5" fill="#d32f2f" />
      <path d="M 40 16 Q 43 19 42 25" stroke="#d32f2f" stroke-width="2.5" stroke-linecap="round" />
      <!-- Top Hat -->
      <rect x="33" y="5" width="10" height="1.8" rx="0.8" fill="#1e1e1e" />
      <rect x="35" y="-0.5" width="6" height="5.5" rx="1" fill="#1e1e1e" />
      <rect x="35" y="3.5" width="6" height="1" fill="#d32f2f" />
      <!-- Twig arms -->
      <path d="M 31 20 L 23 16 M 25 17 L 23 14" stroke="#5d4037" stroke-width="1.2" stroke-linecap="round" />
      <path d="M 45 20 L 52 15 M 50 16 L 53 18" stroke="#5d4037" stroke-width="1.2" stroke-linecap="round" />

      <!-- Child 1 (Red winter coat, waving) Height ~34px -->
      <!-- Legs / Boots -->
      <path d="M 14 36 L 13 46 M 18 36 L 19 46" stroke="#263238" stroke-width="2.5" stroke-linecap="round" />
      <!-- Red Coat -->
      <path d="M 10 26 Q 16 23 22 26 L 24 37 Q 16 39 8 37 Z" fill="#c62828" />
      <path d="M 8 37 Q 16 39 24 37" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
      <!-- Waving Arm with Mitten -->
      <path d="M 11 27 Q 6 22 7 17" stroke="#c62828" stroke-width="2.8" stroke-linecap="round" />
      <circle cx="7" cy="16" r="2" fill="#ffffff" />
      <path d="M 21 27 Q 25 31 26 34" stroke="#c62828" stroke-width="2.8" stroke-linecap="round" />
      <circle cx="26" cy="34" r="2" fill="#ffffff" />
      <!-- Head / Face -->
      <circle cx="16" cy="18" r="4.5" fill="#ffe0b2" />
      <circle cx="17.5" cy="17.5" r="0.6" fill="#424242" />
      <circle cx="15" cy="19.5" r="1" fill="#ffab91" opacity="0.6" />
      <!-- Winter Pom-pom Beanie -->
      <path d="M 11 16 Q 16 9 21 16 Z" fill="#1565c0" />
      <rect x="11.5" y="15" width="9" height="2" rx="1" fill="#ffffff" />
      <circle cx="16" cy="9" r="2" fill="#ffffff" />

      <!-- Child 2 (Amber winter coat, playing with snowball) Height ~28px -->
      <!-- Body -->
      <path d="M 60 30 Q 66 26 71 30 L 73 43 Q 66 45 58 43 Z" fill="#ef6c00" />
      <path d="M 59 44 L 56 46 M 72 44 L 75 46" stroke="#263238" stroke-width="2.5" stroke-linecap="round" />
      <!-- Head -->
      <circle cx="65" cy="22" r="4.2" fill="#ffe0b2" />
      <circle cx="63.5" cy="22" r="0.6" fill="#424242" />
      <!-- Earmuffs -->
      <path d="M 61 20 Q 65 17 69 20" stroke="#c2185b" stroke-width="1.8" fill="none" />
      <circle cx="61" cy="21" r="2" fill="#c2185b" />
      <circle cx="69" cy="21" r="2" fill="#c2185b" />
      <!-- Holding a snowball -->
      <circle cx="58" cy="32" r="3.2" fill="#ffffff" />
    </svg>
  </div>
</div>
