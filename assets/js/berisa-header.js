/**
 * BERISA Header Renderer v2.0
 * Inyecta el logo oficial (brújula) + nav en cada página
 * Uso: BHeader.render(config)
 */
;(function(g){
'use strict';

function compassSvg(sz){
sz=sz||40;
return `<svg width="${sz}" height="${sz}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Berisa">
<defs>
<linearGradient id="cbg${sz}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0A1B34"/><stop offset="100%" stop-color="#0F2444"/></linearGradient>
<linearGradient id="cgld${sz}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#E8C060"/><stop offset="100%" stop-color="#C9972B"/></linearGradient>
<linearGradient id="cslt${sz}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#5B6472"/><stop offset="100%" stop-color="#3A4452"/></linearGradient>
<filter id="cgw${sz}"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<circle cx="32" cy="32" r="30" fill="url(#cbg${sz})" stroke="#C9972B" stroke-width="1.5"/>
<circle cx="32" cy="32" r="27" fill="none" stroke="rgba(201,151,43,.2)" stroke-width="0.8"/>
<polygon points="32,4 29.5,28 34.5,28" fill="#F6F7F9" opacity="0.95"/>
<polygon points="32,60 29.5,36 34.5,36" fill="#F6F7F9" opacity="0.55"/>
<polygon points="60,32 36,29.5 36,34.5" fill="#F6F7F9" opacity="0.55"/>
<polygon points="4,32 28,29.5 28,34.5" fill="#F6F7F9" opacity="0.55"/>
<polygon points="52,12 35,29 38,31.5" fill="#C9972B" opacity="0.52"/>
<polygon points="12,52 29,35 31.5,38" fill="#C9972B" opacity="0.36"/>
<polygon points="12,12 29,29 31.5,26" fill="#C9972B" opacity="0.36"/>
<polygon points="52,52 35,35 38,32" fill="#C9972B" opacity="0.36"/>
<polygon points="32,10 30,32 34,32" fill="url(#cgld${sz})" filter="url(#cgw${sz})"/>
<polygon points="32,54 30,32 34,32" fill="url(#cslt${sz})"/>
<circle cx="32" cy="32" r="4.5" fill="#C9972B" stroke="#F6F7F9" stroke-width="1.2"/>
<circle cx="32" cy="32" r="2" fill="#F6F7F9" opacity="0.9"/>
<text x="32" y="20" text-anchor="middle" font-family="IBM Plex Sans,sans-serif" font-size="5.5" font-weight="700" fill="#C9972B">N</text>
</svg>`;
}

function logoHtml(href){
return `<a href="${href||'dashboard.html'}" class="berisa-logo-wrap" aria-label="Berisa inicio">
  ${compassSvg(40)}
  <div class="berisa-vsep" style="height:32px"></div>
  <div class="berisa-wordmark-wrap">
    <span class="berisa-wm">BERI<span style="position:relative;display:inline-block">S</span><span style="position:relative;display:inline-block">A<span style="position:absolute;top:-4px;right:-4px;width:5px;height:5px;border-radius:50%;background:#C9972B;display:block"></span></span></span>
    <span class="berisa-tag">Inteligencia Comercial</span>
  </div>
</a>`;
}

/* render(config)
   config = { active:'dashboard'|'pipeline'|'alerts'|'pricing'|'users', showUsers:bool }
*/
function render(cfg){
  cfg=cfg||{};
  const pages=[
    {id:'dashboard',   label:'📊 Dashboard',    href:'dashboard.html'},
    {id:'pipeline',    label:'🎯 Pipeline',     href:'pipeline.html'},
    {id:'alerts',      label:'🔔 Alertas',      href:'alerts.html'},
    {id:'supplier',    label:'🏭 Proveedores',  href:'supplier-directory.html'},
    {id:'procurement', label:'🛒 Comprador',    href:'buyer-portal.html'},
    {id:'hse',         label:'🛡️ HSE',          href:'hse-dashboard.html'},
    {id:'env',         label:'🌿 Ambiental',    href:'hse-environmental.html'},
    {id:'pricing',     label:'💳 Planes',       href:'pricing.html'},
  ];
  if(cfg.showUsers){pages.push({id:'users',label:'👥 Usuarios',href:'users.html'});}

  const navHtml=pages.map(p=>`<button class="pb${cfg.active===p.id?' on':''}" onclick="location.href='${p.href}'">${p.label}</button>`).join('');

  const hdr=document.querySelector('.hdr');
  if(!hdr)return;

  const user=JSON.parse(sessionStorage.getItem('berisa_user')||'{}');
  const firstName=(user.name||'').split(' ')[0];

  hdr.innerHTML=`
  <div class="hl">
    ${logoHtml()}
    <div class="hsep"></div>
    <span id="dDate" style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--t3);letter-spacing:.5px"></span>
    <div class="sec-ind" title="Sesión activa"><div class="dot"></div><span style="font-size:10px;color:var(--t3)">${firstName}</span></div>
  </div>
  <div class="hr">
    <div class="pg">${navHtml}</div>
    <div class="pg" id="lgG">
      <button class="pb on" onclick="setLang&&setLang('es')">ES</button>
      <button class="pb" onclick="setLang&&setLang('en')">EN</button>
    </div>
    <div class="ccg">
      <button class="ccb on" id="ccU" onclick="setCcy&&setCcy('USD')">USD</button>
      <button class="ccb" id="ccE" onclick="setCcy&&setCcy('EUR')">EUR</button>
    </div>
    <button class="pb" id="thB" onclick="toggleTheme&&toggleTheme()" style="font-size:15px">🌙</button>
    <button class="pb" onclick="doLogout&&doLogout()" style="color:#F87171;border:1px solid rgba(217,64,64,.25);border-radius:3px;padding:4px 9px" title="Cerrar sesión">⏻</button>
  </div>`;

  document.getElementById('dDate').textContent=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});
}

g.BHeader={compassSvg,logoHtml,render};
})(window);
