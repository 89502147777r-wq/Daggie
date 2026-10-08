// Version of the game files on this device. version.json on GitHub always holds the newest number.
// When they differ, a button offers a one-tap update. Always change BOTH when releasing.
const BUILD = '10.29';
// The version is also printed on the loading screen (and goes away with it), so it never ends up in a recorded video.
function showVer() {
  const l = document.getElementById('loader'); if (!l) return false; if (l.querySelector('.ver')) return true;
  const d = document.createElement('div'); d.className = 'ver'; d.textContent = 'v' + BUILD;
  d.style.cssText = 'position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);text-align:center;font:700 15px ui-monospace,Menlo,Consolas,monospace;letter-spacing:2px;color:rgba(25,35,70,.6);pointer-events:none;z-index:5';
  l.appendChild(d); return true;
}
if (!showVer()) document.addEventListener('DOMContentLoaded', showVer);
setTimeout(async () => {
  try {
    const v = await (await fetch('version.json?check=' + Date.now(), { cache: 'no-store' })).json();
    if (!v.build || v.build === BUILD) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'updbtn'; b.textContent = 'New version ' + v.build + ' available. Tap to update';
    b.onclick = async () => {
      try { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); } catch (e) {}
      try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
      location.replace(location.pathname + location.search.replace(/([?&])v=\d+&?/, '$1') + (location.search ? '&' : '?') + 'v=' + Date.now());
    };
    (document.getElementById('stage') || document.body).appendChild(b);
  } catch (e) {}
}, 2500);
