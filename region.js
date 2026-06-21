(function () {
  'use strict';

  function start(onComplete) {
    const layer = document.createElement('div');
    Object.assign(layer.style, {
      // Cursor shown while selecting a region (no crosshair, no visible box).
      position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
      zIndex: 2147483646, cursor: 'grabbing', background: 'transparent'
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      // Fully transparent selection zone — no outline, fill, or highlight.
      position: 'fixed', border: 'none', background: 'transparent',
      display: 'none', zIndex: 2147483646
    });
    layer.appendChild(box);
    document.documentElement.appendChild(layer);

    let sx = 0, sy = 0, dragging = false;

    function cleanup() { layer.remove(); }

    layer.addEventListener('mousedown', (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      Object.assign(box.style, { left: sx + 'px', top: sy + 'px', width: '0px', height: '0px', display: 'block' });
      e.preventDefault();
    });
    layer.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    });
    layer.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const rect = {
        x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY),
        width: Math.abs(e.clientX - sx), height: Math.abs(e.clientY - sy)
      };
      const dpr = window.devicePixelRatio || 1;
      cleanup();
      if (rect.width < 5 || rect.height < 5) return;
      requestAnimationFrame(() => requestAnimationFrame(() => onComplete(rect, dpr)));
    });
    window.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Escape') { cleanup(); window.removeEventListener('keydown', onKey); }
    });
  }

  window.ExamRegion = { start };
})();
