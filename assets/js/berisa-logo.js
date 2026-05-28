/**
 * BERISA — Logo System v2.0
 * Símbolo oficial: Rosa de los Vientos (Brújula 8 puntas)
 * Paleta oficial: #0A1B34 navy | #C9972B gold | #5B6472 slate | #F6F7F9 bone
 */
;(function(global){
  'use strict';

  /* ── SVG COMPASS MARK ─────────────────────────────────────
   * Dimensiones: viewBox 0 0 64 64
   * Uso: BLogo.compassSvg(size)  → string SVG completo
   */
  function compassSvg(size, theme) {
    size = size || 40;
    const dark = theme !== 'light';
    const navy  = dark ? '#0A1B34' : '#0A1B34';
    const gold  = '#C9972B';
    const white = dark ? '#F6F7F9' : '#FFFFFF';
    const ring  = dark ? 'rgba(201,151,43,.25)' : 'rgba(201,151,43,.15)';
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Berisa">
  <defs>
    <linearGradient id="bg${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${navy}"/>
      <stop offset="100%" stop-color="#0F2444"/>
    </linearGradient>
    <linearGradient id="ndl${size}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E8C060"/>
      <stop offset="100%" stop-color="${gold}"/>
    </linearGradient>
    <linearGradient id="ndl2${size}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#5B6472"/>
      <stop offset="100%" stop-color="#3A4452"/>
    </linearGradient>
    <filter id="glow${size}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Outer ring -->
  <circle cx="32" cy="32" r="30" fill="url(#bg${size})" stroke="${gold}" stroke-width="1.5"/>
  <!-- Ring tick marks -->
  <circle cx="32" cy="32" r="27" fill="none" stroke="${ring}" stroke-width="0.8"/>
  <!-- 8-point star: 4 cardinal (long) + 4 intercardinal (short) -->
  <!-- North -->
  <polygon points="32,4 29.5,28 34.5,28" fill="${white}" opacity="0.95"/>
  <!-- South -->
  <polygon points="32,60 29.5,36 34.5,36" fill="${white}" opacity="0.6"/>
  <!-- East -->
  <polygon points="60,32 36,29.5 36,34.5" fill="${white}" opacity="0.6"/>
  <!-- West -->
  <polygon points="4,32 28,29.5 28,34.5" fill="${white}" opacity="0.6"/>
  <!-- NE intercardinal -->
  <polygon points="54,10 35,29 38,31" fill="${gold}" opacity="0.45"/>
  <!-- SW intercardinal -->
  <polygon points="10,54 29,35 31,38" fill="${gold}" opacity="0.3"/>
  <!-- NW intercardinal -->
  <polygon points="10,10 29,29 31,26" fill="${gold}" opacity="0.3"/>
  <!-- SE intercardinal -->
  <polygon points="54,54 35,35 38,32" fill="${gold}" opacity="0.3"/>
  <!-- Compass needle — North (gold) -->
  <polygon points="32,10 30,32 34,32" fill="url(#ndl${size})" filter="url(#glow${size})"/>
  <!-- Compass needle — South (slate) -->
  <polygon points="32,54 30,32 34,32" fill="url(#ndl2${size})"/>
  <!-- Center hub -->
  <circle cx="32" cy="32" r="4.5" fill="${gold}" stroke="${white}" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="2"   fill="${white}" opacity="0.9"/>
  <!-- N label -->
  <text x="32" y="19.5" text-anchor="middle" font-family="'IBM Plex Sans',sans-serif" font-size="5.5" font-weight="700" fill="${gold}" letter-spacing="0.5">N</text>
</svg>`;
  }

  /* ── FULL LOGOTYPE HTML ────────────────────────────────────
   * BLogo.html(size, theme)
   * Returns complete header logo markup
   */
  function html(size, theme) {
    size = size || 36;
    const dark = theme !== 'light';
    const nameCol = dark ? '#F6F7F9' : '#0A1B34';
    const tagCol  = '#C9972B';
    const sepCol  = dark ? 'rgba(255,255,255,.15)' : 'rgba(10,27,52,.15)';
    return `<a href="dashboard.html" class="berisa-logo-wrap" aria-label="Berisa — inicio">
      ${compassSvg(size, theme)}
      <div class="berisa-vsep" style="width:1px;height:${Math.round(size*.85)}px;background:${sepCol};margin:0 2px;"></div>
      <div class="berisa-wordmark-wrap">
        <span class="berisa-wm" style="color:${nameCol}">BERI<span class="berisa-sa">S</span><span class="berisa-adot">A<span class="berisa-dot" style="background:${tagCol}"></span></span></span>
        <span class="berisa-tag" style="color:${tagCol}">INTELIGENCIA COMERCIAL</span>
      </div>
    </a>`;
  }

  global.BLogo = { compassSvg, html };
})(window);
