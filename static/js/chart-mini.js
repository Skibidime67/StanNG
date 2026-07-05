/* ===========================================================
   StanNG — dependency-free hourly traffic chart (canvas + HTML tooltip)
   Redesigned for more detail: dual bars (up/down) + a smooth total-traffic
   line overlay, real byte-formatted Y-axis, day-boundary markers, a legend,
   and an interactive hover/tap tooltip. Still zero external chart library.
   =========================================================== */
(function () {
  const state = new WeakMap();

  function fmtBytesShort(bytes) {
    if (!bytes || bytes <= 0) return '0';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const val = bytes / Math.pow(1024, i);
    return (i === 0 ? Math.round(val) : val.toFixed(val < 10 ? 1 : 0)) + ' ' + units[i];
  }

  function niceStep(maxVal) {
    // pick a "nice" rounded step for Y-axis gridlines (1/2/5 * 10^n)
    if (maxVal <= 0) return 1;
    const rough = maxVal / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    let step;
    if (norm < 1.5) step = 1;
    else if (norm < 3) step = 2;
    else if (norm < 7) step = 5;
    else step = 10;
    return step * mag;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h <= 0.5 || w <= 0) return;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ensureTooltip(wrap) {
    let tip = wrap.querySelector('.chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      wrap.appendChild(tip);
    }
    return tip;
  }

  function ensureLegend(wrap, lang) {
    let legend = wrap.querySelector('.chart-legend');
    if (!legend) {
      legend = document.createElement('div');
      legend.className = 'chart-legend';
      wrap.insertBefore(legend, wrap.firstChild);
    }
    const upLabel = (window.STANNG && STANNG.t('dash_upload')) || 'Upload';
    const downLabel = (window.STANNG && STANNG.t('dash_download')) || 'Download';
    const totalLabel = (window.STANNG && STANNG.t('dash_total_traffic')) || 'Total';
    legend.innerHTML = `
      <span class="chart-legend-item"><i class="dot dot-gold"></i>${upLabel}</span>
      <span class="chart-legend-item"><i class="dot dot-azure"></i>${downLabel}</span>
      <span class="chart-legend-item"><i class="dot dot-line"></i>${totalLabel}</span>
    `;
    return legend;
  }

  function computeLayout(canvas, data) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const height = canvas.getAttribute('height') ? parseInt(canvas.getAttribute('height'), 10) : 220;
    const maxTotal = Math.max(1, ...data.map(d => (d.up || 0) + (d.down || 0)));
    const step = niceStep(maxTotal);
    const niceMax = Math.max(step, Math.ceil(maxTotal / step) * step);
    const yLabelW = fmtBytesShort(niceMax).length * 6.5 + 14;
    const padding = { top: 16, right: 14, bottom: 28, left: Math.max(46, yLabelW) };
    return { width, height, padding, niceMax, step };
  }

  function drawChart(canvas, data) {
    const dpr = window.devicePixelRatio || 1;
    const { width, height, padding, niceMax } = computeLayout(canvas, data);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.documentElement);
    const goldColor = styles.getPropertyValue('--gold-500').trim() || '#c9a227';
    const goldLight = styles.getPropertyValue('--gold-300').trim() || '#e6c765';
    const azureColor = styles.getPropertyValue('--azure').trim() || '#4d9fec';
    const emeraldColor = styles.getPropertyValue('--emerald').trim() || '#2fbf85';
    const textColor = styles.getPropertyValue('--text-2').trim() || '#9d93bd';
    const textMuted = styles.getPropertyValue('--text-muted').trim() || '#746a92';
    const gridColor = styles.getPropertyValue('--border-soft').trim() || 'rgba(201,162,39,0.2)';

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const bars = [];

    if (!data.length) {
      ctx.fillStyle = textMuted;
      ctx.font = '13px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('—', width / 2, height / 2);
      return { bars: [], padding, chartW, chartH, width, height };
    }

    const n = data.length;
    const groupW = chartW / n;
    const barW = Math.min(18, groupW * 0.34);

    // ---- horizontal gridlines + Y-axis byte labels ----
    const rows = 4;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '10.5px Vazirmatn, sans-serif';
    ctx.fillStyle = textMuted;
    ctx.textAlign = 'end';
    for (let i = 0; i <= rows; i++) {
      const y = padding.top + (chartH / rows) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y + 0.5);
      ctx.lineTo(width - padding.right, y + 0.5);
      ctx.stroke();
      const val = niceMax * (1 - i / rows);
      ctx.fillText(fmtBytesShort(val), padding.left - 10, y + 3.5);
    }

    // ---- day-boundary vertical markers (midnight ticks) ----
    let lastDay = null;
    data.forEach((d, i) => {
      const dt = new Date((d.t || 0) * 1000);
      const dayKey = dt.getFullYear() + '-' + dt.getMonth() + '-' + dt.getDate();
      if (lastDay !== null && dayKey !== lastDay) {
        const x = padding.left + groupW * i;
        ctx.strokeStyle = gridColor;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      lastDay = dayKey;
    });

    // ---- bars (upload / download) ----
    data.forEach((d, i) => {
      const cx = padding.left + groupW * i + groupW / 2;
      const upH = ((d.up || 0) / niceMax) * chartH;
      const downH = ((d.down || 0) / niceMax) * chartH;

      const gradUp = ctx.createLinearGradient(0, padding.top + chartH - upH, 0, padding.top + chartH);
      gradUp.addColorStop(0, goldLight);
      gradUp.addColorStop(1, 'rgba(201,162,39,0.18)');
      ctx.fillStyle = gradUp;
      roundRect(ctx, cx - barW - 1.5, padding.top + chartH - upH, barW, upH, 2.5);
      ctx.fill();

      const gradDown = ctx.createLinearGradient(0, padding.top + chartH - downH, 0, padding.top + chartH);
      gradDown.addColorStop(0, azureColor);
      gradDown.addColorStop(1, 'rgba(77,159,236,0.18)');
      ctx.fillStyle = gradDown;
      roundRect(ctx, cx + 1.5, padding.top + chartH - downH, barW, downH, 2.5);
      ctx.fill();

      bars.push({
        cx, x0: cx - groupW / 2, x1: cx + groupW / 2,
        up: d.up || 0, down: d.down || 0, t: d.t || 0,
      });

      if (i % Math.ceil(n / 8 || 1) === 0 || i === n - 1) {
        const dt = new Date((d.t || 0) * 1000);
        const label = dt.getHours().toString().padStart(2, '0') + ':00';
        ctx.fillStyle = textColor;
        ctx.font = '10px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, height - 8);
      }
    });

    // ---- smooth total-traffic line overlay ----
    ctx.beginPath();
    data.forEach((d, i) => {
      const cx = padding.left + groupW * i + groupW / 2;
      const total = (d.up || 0) + (d.down || 0);
      const y = padding.top + chartH - (total / niceMax) * chartH;
      if (i === 0) ctx.moveTo(cx, y);
      else {
        const prevCx = padding.left + groupW * (i - 1) + groupW / 2;
        const prevTotal = (data[i - 1].up || 0) + (data[i - 1].down || 0);
        const prevY = padding.top + chartH - (prevTotal / niceMax) * chartH;
        const midX = (prevCx + cx) / 2;
        ctx.bezierCurveTo(midX, prevY, midX, y, cx, y);
      }
    });
    ctx.strokeStyle = emeraldColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(47,191,133,0.45)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // dots on the line
    data.forEach((d, i) => {
      const cx = padding.left + groupW * i + groupW / 2;
      const total = (d.up || 0) + (d.down || 0);
      const y = padding.top + chartH - (total / niceMax) * chartH;
      ctx.beginPath();
      ctx.arc(cx, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = emeraldColor;
      ctx.fill();
    });

    return { bars, padding, chartW, chartH, width, height };
  }

  function attachInteractivity(canvas, wrap, getLayout) {
    const tip = ensureTooltip(wrap);
    let raf = null;

    function showAt(clientX, clientY) {
      const layout = getLayout();
      if (!layout || !layout.bars.length) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      let nearest = layout.bars[0];
      let bestDist = Infinity;
      for (const b of layout.bars) {
        const d = Math.abs(b.cx - x);
        if (d < bestDist) { bestDist = d; nearest = b; }
      }
      const dt = new Date(nearest.t * 1000);
      const dateLabel = dt.toLocaleString(document.documentElement.lang === 'fa' ? 'fa-IR' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const upLabel = (window.STANNG && STANNG.t('dash_upload')) || 'Upload';
      const downLabel = (window.STANNG && STANNG.t('dash_download')) || 'Download';
      const totalLabel = (window.STANNG && STANNG.t('dash_total_traffic')) || 'Total';
      const fmt = (window.STANNG && STANNG.fmtBytes) || fmtBytesShort;
      tip.innerHTML = `
        <div class="chart-tooltip-time">${dateLabel}</div>
        <div class="chart-tooltip-row"><i class="dot dot-gold"></i>${upLabel}: <b>${fmt(nearest.up)}</b></div>
        <div class="chart-tooltip-row"><i class="dot dot-azure"></i>${downLabel}: <b>${fmt(nearest.down)}</b></div>
        <div class="chart-tooltip-row"><i class="dot dot-line"></i>${totalLabel}: <b>${fmt(nearest.up + nearest.down)}</b></div>
      `;
      tip.style.opacity = '1';
      const wrapRect = wrap.getBoundingClientRect();
      let left = nearest.cx + 12;
      const tipW = 170;
      if (left + tipW > wrapRect.width) left = nearest.cx - tipW - 12;
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = '8px';
    }

    function hide() { tip.style.opacity = '0'; }

    canvas.addEventListener('mousemove', (e) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => showAt(e.clientX, e.clientY));
    });
    canvas.addEventListener('mouseleave', hide);
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (t) showAt(t.clientX, t.clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) showAt(t.clientX, t.clientY);
    }, { passive: true });
    canvas.addEventListener('touchend', () => setTimeout(hide, 1500));
  }

  window.renderTrafficChart = function (canvas, hourlyData) {
    if (!canvas) return;
    let wrap = canvas.closest('.chart-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'chart-wrap';
      canvas.parentNode.insertBefore(wrap, canvas);
      wrap.appendChild(canvas);
    }
    ensureLegend(wrap);

    const data = (hourlyData || []).slice(-48);
    const layout = drawChart(canvas, data);
    state.set(canvas, layout);

    if (!canvas.dataset.interactiveBound) {
      attachInteractivity(canvas, wrap, () => state.get(canvas));
      canvas.dataset.interactiveBound = '1';
    }
  };
})();
