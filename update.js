// Version of the game files on this device. version.json on GitHub always holds the newest number.
// When they differ, a button offers a one-tap update. Always change BOTH when releasing.
const BUILD = '4.8';
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
