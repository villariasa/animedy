<script lang="ts">
  import { onMount } from "svelte";

  let canvas = $state<HTMLCanvasElement | null>(null);

  interface Flake {
    x: number;
    y: number;
    radius: number;
    speedY: number;
    windAmp: number;
    windFreq: number;
    windOffset: number;
    opacity: number;
  }

  interface CrystalFlake {
    x: number;
    y: number;
    size: number;
    speedY: number;
    windAmp: number;
    windFreq: number;
    windOffset: number;
    rotation: number;
    rotSpeed: number;
    opacity: number;
  }

  onMount(() => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let isReducedMotion = false;
    let isVisible = true;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    isReducedMotion = prefersReduced.matches;

    const onMotionChange = (e: MediaQueryListEvent) => {
      isReducedMotion = e.matches;
      if (isReducedMotion) {
        cancelAnimationFrame(animId);
        drawStatic();
      } else {
        lastTime = performance.now();
        animId = requestAnimationFrame(loop);
      }
    };
    prefersReduced.addEventListener("change", onMotionChange);

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && !isReducedMotion) {
        lastTime = performance.now();
        animId = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(animId);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const flakes: Flake[] = [];
    const crystals: CrystalFlake[] = [];

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx?.scale(dpr, dpr);
      initParticles();
      if (isReducedMotion) {
        drawStatic();
      }
    }

    function initParticles() {
      flakes.length = 0;
      crystals.length = 0;

      // Noticeable, atmospheric snowfall density
      const flakeCount = Math.floor(Math.min(95, Math.max(45, width / 18)));
      const crystalCount = Math.floor(Math.min(12, Math.max(6, width / 140)));

      for (let i = 0; i < flakeCount; i++) {
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1.6 + Math.random() * 2.4,
          speedY: 0.6 + Math.random() * 1.2,
          windAmp: 0.5 + Math.random() * 0.9,
          windFreq: 0.0012 + Math.random() * 0.002,
          windOffset: Math.random() * Math.PI * 2,
          opacity: 0.45 + Math.random() * 0.45
        });
      }

      for (let i = 0; i < crystalCount; i++) {
        crystals.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 10 + Math.random() * 8,
          speedY: 0.4 + Math.random() * 0.7,
          windAmp: 0.8 + Math.random() * 1.2,
          windFreq: 0.0009 + Math.random() * 0.0015,
          windOffset: Math.random() * Math.PI * 2,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.015,
          opacity: 0.5 + Math.random() * 0.45
        });
      }
    }

    function drawCrystal(c: CrystalFlake) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);

      // Flake arms with crisp white glow
      ctx.strokeStyle = `rgba(255, 255, 255, ${c.opacity})`;
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";

      const arm = c.size;
      const sub = arm * 0.45;
      const barb = arm * 0.28;

      for (let j = 0; j < 6; j++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -arm);

        // Branch barbs
        ctx.moveTo(0, -sub);
        ctx.lineTo(-barb, -sub - barb * 0.65);
        ctx.moveTo(0, -sub);
        ctx.lineTo(barb, -sub - barb * 0.65);

        ctx.stroke();
        ctx.rotate(Math.PI / 3);
      }

      // Bright center core
      ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawStatic() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const c of crystals) {
        drawCrystal(c);
      }
    }

    let lastTime = performance.now();

    function loop(time: number) {
      if (!ctx) return;
      const dt = Math.min((time - lastTime) / 16.67, 2.5);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // 1. Crisp white falling flakes
      for (const f of flakes) {
        f.y += f.speedY * dt;
        f.x += Math.sin(time * f.windFreq + f.windOffset) * f.windAmp * dt;

        if (f.y > height + 8) {
          f.y = -8;
          f.x = Math.random() * width;
        } else if (f.x < -12) {
          f.x = width + 6;
        } else if (f.x > width + 12) {
          f.x = -6;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Beautiful rotating crystal snowflakes
      for (const c of crystals) {
        c.y += c.speedY * dt;
        c.x += Math.sin(time * c.windFreq + c.windOffset) * c.windAmp * dt;
        c.rotation += c.rotSpeed * dt;

        if (c.y > height + 20) {
          c.y = -20;
          c.x = Math.random() * width;
        } else if (c.x < -25) {
          c.x = width + 15;
        } else if (c.x > width + 25) {
          c.x = -15;
        }

        drawCrystal(c);
      }

      if (!isReducedMotion && isVisible) {
        animId = requestAnimationFrame(loop);
      }
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();

    if (!isReducedMotion) {
      animId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      prefersReduced.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  });
</script>

<!-- z-35: Renders visibly in front of content cards & background, while pointer-events-none ensures 0 interference with clicks -->
<canvas
  bind:this={canvas}
  class="pointer-events-none fixed inset-0 z-35 h-full w-full overflow-hidden select-none"
  aria-hidden="true"
></canvas>
