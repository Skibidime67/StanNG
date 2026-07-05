/* ===========================================================
   StanNG — dashboard controller
   =========================================================== */
(() => {
  let currentInbounds = [];
  let currentAddresses = [];
  let lastHourly = [];

  // ---------------- guard: must be logged in ----------------
  STANNG.api('/api/me').then(me => {
    if (!me.logged_in) { window.location.href = '/login'; return; }
    document.getElementById('appVersion').textContent = me.app_version || '';
    document.getElementById('otaCurrent').textContent = (me.settings && me.settings.app_version) || me.app_version;
    if (me.settings) {
      document.getElementById('settingPublicDomain').value = me.settings.public_domain || '';
      document.getElementById('settingOtaRepo').value = me.settings.ota_repo || '';
      document.getElementById('settingKeepAlive').checked = me.settings.keep_alive !== false;
      document.getElementById('settingFingerprint').value = me.settings.default_fingerprint || 'chrome';
      document.getElementById('settingAlpn').value = me.settings.default_alpn || 'http/1.1';
      document.getElementById('settingSniOverride').value = me.settings.sni_override || '';
      document.getElementById('settingFragmentEnabled').checked = me.settings.fragment_enabled !== false;
      document.getElementById('settingFragmentPackets').value = me.settings.fragment_packets || 'tlshello';
      document.getElementById('settingFragmentLength').value = me.settings.fragment_length || '10-30';
      document.getElementById('settingFragmentInterval').value = me.settings.fragment_interval || '10-20';
    }
  }).catch(() => { window.location.href = '/login'; });

  document.getElementById('settingSound').checked = STANNG.isSoundEnabled();

  // ---------------- nav / view switching ----------------
  const views = document.querySelectorAll('.view');
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  const viewTitle = document.getElementById('viewTitle');
  const titleKeys = { dashboard: 'nav_dashboard', inbounds: 'nav_inbounds', traffic: 'nav_traffic', cleanip: 'nav_cleanip', security: 'nav_security', settings: 'nav_settings' };

  function showView(name) {
    views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    navItems.forEach(n => n.classList.toggle('active', n.dataset.view === name));
    viewTitle.setAttribute('data-i18n', titleKeys[name]);
    viewTitle.textContent = STANNG.t(titleKeys[name]);
    if (name === 'inbounds') loadInbounds();
    if (name === 'traffic') loadInbounds();
    if (name === 'cleanip') loadAddresses();
    closeSidebarMobile();
    STANNG.playSfx('open', 0.3);
  }
  navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));

  // ---------------- mobile sidebar ----------------
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  document.getElementById('menuToggle').addEventListener('click', () => {
    const opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', opening);
    backdrop.classList.toggle('open', opening);
    document.body.classList.toggle('sidebar-locked', opening);
  });
  backdrop.addEventListener('click', closeSidebarMobile);
  function closeSidebarMobile() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.classList.remove('sidebar-locked');
  }

  // ---------------- lang / theme ----------------
  document.querySelectorAll('.lang-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      STANNG.setLang(btn.dataset.lang);
      viewTitle.textContent = STANNG.t(viewTitle.getAttribute('data-i18n'));
      STANNG.playSfx('toggle', 0.3);
    });
  });
  document.getElementById('themeToggle').addEventListener('click', () => {
    STANNG.setTheme(STANNG.getTheme() === 'dark' ? 'light' : 'dark');
    STANNG.playSfx('toggle', 0.3);
    renderTrafficChart(document.getElementById('trafficChart'), lastHourly);
  });
  document.getElementById('soundToggle').addEventListener('click', () => {
    const next = !STANNG.isSoundEnabled();
    STANNG.setSoundEnabled(next);
    document.getElementById('settingSound').checked = next;
    if (next) STANNG.playSfx('click');
  });

  // ---------------- logout ----------------
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await STANNG.api('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  // ---------------- modal helpers ----------------
  function openModal(id) {
    document.getElementById(id).classList.add('open');
    STANNG.playSfx('open', 0.4);
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    STANNG.playSfx('close', 0.4);
  }
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov.id); });
  });

  // ---------------- dashboard stats polling ----------------
  async function refreshStats() {
    try {
      const s = await STANNG.api('/stats');
      document.getElementById('statCpu').textContent = s.cpu_percent.toFixed(1) + '%';
      document.getElementById('barCpu').style.width = Math.min(100, s.cpu_percent) + '%';
      document.getElementById('statMem').textContent = s.mem_percent.toFixed(1) + '%';
      document.getElementById('barMem').style.width = Math.min(100, s.mem_percent) + '%';
      document.getElementById('statUptime').textContent = STANNG.fmtDuration(s.uptime_seconds);
      const loc = s.location || {};
      document.getElementById('statLocation').textContent = `${loc.flag || ''} ${loc.city || '?'}`;
      document.getElementById('statTotalTraffic').textContent = STANNG.fmtBytes((s.total_up || 0) + (s.total_down || 0));
      document.getElementById('statUp').textContent = STANNG.fmtBytes(s.total_up || 0);
      document.getElementById('statDown').textContent = STANNG.fmtBytes(s.total_down || 0);
      document.getElementById('statActiveConn').textContent = s.active_connections || 0;
      document.getElementById('statInboundCount').textContent = s.inbounds_count || 0;
      document.getElementById('navInboundCount').textContent = s.inbounds_count || 0;
      document.getElementById('trafficUp').textContent = STANNG.fmtBytes(s.total_up || 0);
      document.getElementById('trafficDown').textContent = STANNG.fmtBytes(s.total_down || 0);
      lastHourly = s.hourly || [];
      renderTrafficChart(document.getElementById('trafficChart'), lastHourly);
    } catch (e) { /* ignore transient errors */ }
  }
  refreshStats();
  setInterval(refreshStats, 8000);
  window.addEventListener('resize', () => renderTrafficChart(document.getElementById('trafficChart'), lastHourly));

  // ---------------- OTA ----------------
  let otaLatestKnown = null;

  document.getElementById('otaCheckBtn').addEventListener('click', async () => {
    const btn = document.getElementById('otaCheckBtn');
    const updateBtn = document.getElementById('otaUpdateBtn');
    const hint = document.getElementById('otaUpdateHint');
    STANNG.setLoading(btn, true);
    try {
      const r = await STANNG.api('/api/ota/check');
      const el = document.getElementById('otaResult');
      if (r.update_available) {
        el.innerHTML = `<span style="color:var(--gold-300)">${STANNG.t('dash_ota_available')} <b>${r.latest}</b></span> — <a href="${r.url}" target="_blank" style="color:var(--azure); text-decoration:underline;">GitHub</a>`;
        STANNG.toast(STANNG.t('dash_ota_available') + ' ' + r.latest, 'info');
        otaLatestKnown = r.latest;
        updateBtn.style.display = '';
        hint.style.display = '';
      } else {
        el.innerHTML = `<span style="color:var(--emerald)">${STANNG.t('dash_ota_uptodate')}</span>`;
        STANNG.toast(STANNG.t('dash_ota_uptodate'), 'success');
        otaLatestKnown = null;
        updateBtn.style.display = 'none';
        hint.style.display = 'none';
      }
    } catch (e) {
      STANNG.toast(e.detail || 'error', 'error');
    } finally {
      STANNG.setLoading(btn, false);
    }
  });

  document.getElementById('otaUpdateBtn').addEventListener('click', async () => {
    const msg = STANNG.t('dash_ota_update_confirm').replace('{version}', otaLatestKnown || '');
    if (!confirm(msg)) return;

    const updateBtn = document.getElementById('otaUpdateBtn');
    const checkBtn = document.getElementById('otaCheckBtn');
    const el = document.getElementById('otaResult');
    STANNG.setLoading(updateBtn, true);
    checkBtn.disabled = true;

    try {
      const r = await STANNG.api('/api/ota/update', { method: 'POST' });
      if (r.ok) {
        el.innerHTML = `<span style="color:var(--gold-300)">${STANNG.t('dash_ota_updating')}</span>`;
        STANNG.toast(STANNG.t('dash_ota_updating'), 'info', 8000);
        waitForRestartThenReload();
      } else {
        el.innerHTML = `<span style="color:var(--emerald)">${STANNG.t('dash_ota_uptodate')}</span>`;
        STANNG.toast(STANNG.t('dash_ota_uptodate'), 'success');
        STANNG.setLoading(updateBtn, false);
        checkBtn.disabled = false;
      }
    } catch (e) {
      STANNG.toast(e.detail || 'error', 'error');
      STANNG.setLoading(updateBtn, false);
      checkBtn.disabled = false;
    }
  });

  // After triggering an update, the server process exits so the hosting
  // platform (Railway/Render) restarts it on the new code. We poll /health
  // until it responds again, then reload the dashboard automatically.
  function waitForRestartThenReload() {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/health', { cache: 'no-store' });
        if (res.ok) {
          clearInterval(poll);
          STANNG.toast(STANNG.t('dash_ota_done'), 'success', 3000);
          setTimeout(() => window.location.reload(), 1200);
        }
      } catch (e) {
        // still down / restarting — keep polling
      }
      if (attempts > 60) { // ~3 minutes safety cutoff
        clearInterval(poll);
        STANNG.toast(STANNG.t('dash_ota_timeout'), 'error', 8000);
      }
    }, 3000);
  }

  document.getElementById('quickAddBtn').addEventListener('click', () => { showView('inbounds'); openInboundModal(); });

  // ---------------- inbounds ----------------
  const fpKeyMap = { chrome: 'fp_chrome', ios: 'fp_ios', firefox: 'fp_firefox', edge: 'fp_edge', random: 'fp_random' };

  async function loadInbounds() {
    try {
      const r = await STANNG.api('/api/inbounds');
      currentInbounds = r.inbounds || [];
      renderInboundsTable();
      renderTrafficTable();
      document.getElementById('navInboundCount').textContent = currentInbounds.length;
    } catch (e) { STANNG.toast(e.detail || 'error', 'error'); }
  }

  function renderInboundsTable(filter = '') {
    const tbody = document.getElementById('inboundsTableBody');
    const empty = document.getElementById('inboundsEmpty');
    const rows = currentInbounds.filter(ib => !filter || ib.name.toLowerCase().includes(filter.toLowerCase()));
    tbody.innerHTML = '';
    empty.style.display = rows.length ? 'none' : 'block';

    rows.forEach(ib => {
      const st = ib.status;
      const tr = document.createElement('tr');
      const statusPill = st.live_enabled
        ? `<span class="pill pill-on"><span class="pill-dot"></span>${STANNG.t('active')}</span>`
        : `<span class="pill pill-off"><span class="pill-dot"></span>${st.expired ? STANNG.t('expired') : STANNG.t('inactive')}</span>`;
      const quotaTxt = ib.quota_gb > 0
        ? `${STANNG.fmtBytes(st.used)} ${STANNG.t('inb_used_of')} ${ib.quota_gb} GB`
        : `${STANNG.fmtBytes(st.used)} / ${STANNG.t('unlimited')}`;
      const pct = ib.quota_gb > 0 ? Math.min(100, (st.used / st.quota_bytes) * 100) : (st.used > 0 ? 8 : 0);
      const expireTxt = ib.expire_at
        ? `${st.days_left} ${STANNG.t('inb_days_left')}`
        : STANNG.t('inb_no_expire');
      tr.innerHTML = `
        <td data-label="${STANNG.t('inb_name')}"><b>${escapeHtml(ib.name)}</b><div class="small muted">${ib.note ? escapeHtml(ib.note) : ''}</div></td>
        <td data-label="${STANNG.t('inb_status')}">${statusPill}</td>
        <td data-label="${STANNG.t('inb_usage')}" style="min-width:160px;">
          <div class="small">${quotaTxt}</div>
          <div class="bar progress-gold" style="margin-top:4px;"><span style="width:${pct}%"></span></div>
        </td>
        <td data-label="${STANNG.t('inb_expire')}">${expireTxt}</td>
        <td data-label="${STANNG.t('inb_max_conn')}">${st.active_connections}${ib.max_connections ? ' / ' + ib.max_connections : ''} <span class="small muted">${STANNG.t('inb_active_devices')}</span></td>
        <td data-label="${STANNG.t('inb_actions')}">
          <div class="row-actions">
            <button class="icon-btn btn-sm" data-action="links" data-uid="${ib.uid}" title="${STANNG.t('inb_links')}"><svg width="15" height="15"><use href="#icon-qr"/></svg></button>
            <button class="icon-btn btn-sm" data-action="edit" data-uid="${ib.uid}" title="${STANNG.t('edit')}"><svg width="15" height="15"><use href="#icon-edit"/></svg></button>
            <button class="icon-btn btn-sm" data-action="reset" data-uid="${ib.uid}" title="${STANNG.t('inb_reset_usage')}"><svg width="15" height="15"><use href="#icon-refresh"/></svg></button>
            <button class="icon-btn btn-sm" data-action="regen" data-uid="${ib.uid}" title="${STANNG.t('inb_regenerate')}"><svg width="15" height="15"><use href="#icon-key"/></svg></button>
            <button class="icon-btn btn-sm" data-action="delete" data-uid="${ib.uid}" title="${STANNG.t('delete')}" style="color:var(--crimson)"><svg width="15" height="15"><use href="#icon-trash"/></svg></button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleInboundAction(btn.dataset.action, btn.dataset.uid));
    });
  }

  function renderTrafficTable() {
    const tbody = document.getElementById('trafficTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    currentInbounds.forEach(ib => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="${STANNG.t('inb_name')}"><b>${escapeHtml(ib.name)}</b></td>
        <td data-label="${STANNG.t('dash_upload')}">${STANNG.fmtBytes(ib.used_up || 0)}</td>
        <td data-label="${STANNG.t('dash_download')}">${STANNG.fmtBytes(ib.used_down || 0)}</td>
        <td data-label="${STANNG.t('inb_usage')}">${STANNG.fmtBytes((ib.used_up || 0) + (ib.used_down || 0))}</td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('inboundSearch').addEventListener('input', (e) => renderInboundsTable(e.target.value));

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function openInboundModal(ib = null) {
    document.getElementById('inboundModalTitle').textContent = ib ? STANNG.t('edit') : STANNG.t('inb_add');
    document.getElementById('inboundUid').value = ib ? ib.uid : '';
    document.getElementById('fName').value = ib ? ib.name : '';
    document.getElementById('fQuota').value = ib ? (ib.quota_gb || '') : '';
    document.getElementById('fExpire').value = ib ? (ib.expire_days || '') : '';
    document.getElementById('fMaxConn').value = ib ? (ib.max_connections || '') : '';
    document.getElementById('fMaxReq').value = ib ? (ib.max_requests || '') : '';
    document.getElementById('fFingerprint').value = ib ? (ib.fp || 'chrome') : 'chrome';
    document.getElementById('fStrictIp').checked = ib ? !!ib.strict_single_ip : false;
    document.getElementById('fNote').value = ib ? (ib.note || '') : '';
    openModal('inboundModal');
  }

  document.getElementById('addInboundBtn').addEventListener('click', () => openInboundModal());

  document.getElementById('inboundSaveBtn').addEventListener('click', async () => {
    const uid = document.getElementById('inboundUid').value;
    const payload = {
      name: document.getElementById('fName').value.trim() || 'User',
      quota_gb: parseFloat(document.getElementById('fQuota').value || 0),
      expire_days: parseInt(document.getElementById('fExpire').value || 0),
      max_connections: parseInt(document.getElementById('fMaxConn').value || 0),
      max_requests: parseInt(document.getElementById('fMaxReq').value || 0),
      fp: document.getElementById('fFingerprint').value,
      strict_single_ip: document.getElementById('fStrictIp').checked,
      note: document.getElementById('fNote').value.trim(),
    };
    const btn = document.getElementById('inboundSaveBtn');
    STANNG.setLoading(btn, true);
    try {
      if (uid) {
        await STANNG.api(`/api/inbounds/${uid}`, { method: 'PATCH', body: payload });
        STANNG.toast(STANNG.t('inb_updated'), 'success');
      } else {
        await STANNG.api('/api/inbounds', { method: 'POST', body: payload });
        STANNG.toast(STANNG.t('inb_created'), 'success');
      }
      closeModal('inboundModal');
      loadInbounds();
    } catch (e) {
      STANNG.toast(e.detail || 'error', 'error');
    } finally {
      STANNG.setLoading(btn, false);
    }
  });

  async function handleInboundAction(action, uid) {
    const ib = currentInbounds.find(x => x.uid === uid);
    if (!ib) return;
    if (action === 'edit') return openInboundModal(ib);
    if (action === 'links') return showLinksModal(uid);
    if (action === 'reset') {
      try {
        await STANNG.api(`/api/inbounds/${uid}/reset-usage`, { method: 'POST' });
        STANNG.toast(STANNG.t('inb_reset_done'), 'success');
        loadInbounds();
      } catch (e) { STANNG.toast(e.detail || 'error', 'error'); }
      return;
    }
    if (action === 'regen') {
      if (!confirm(STANNG.t('inb_regenerate_confirm'))) return;
      try {
        await STANNG.api(`/api/inbounds/${uid}/regenerate`, { method: 'POST' });
        STANNG.toast(STANNG.t('inb_regenerated'), 'success');
        loadInbounds();
      } catch (e) { STANNG.toast(e.detail || 'error', 'error'); }
      return;
    }
    if (action === 'delete') {
      if (!confirm(STANNG.t('inb_delete_confirm'))) return;
      try {
        await STANNG.api(`/api/inbounds/${uid}`, { method: 'DELETE' });
        STANNG.toast(STANNG.t('inb_deleted'), 'success');
        loadInbounds();
      } catch (e) { STANNG.toast(e.detail || 'error', 'error'); }
      return;
    }
  }

  async function showLinksModal(uid) {
    try {
      const r = await STANNG.api(`/api/inbounds/${uid}/links`);
      document.getElementById('linkTls').textContent = r.links.tls;
      document.getElementById('linkNontls').textContent = r.links.nontls;
      document.getElementById('linkSub').textContent = r.sub_url;
      document.getElementById('linkStatus').textContent = r.status_url;
      document.getElementById('qrImg').src = `/api/inbounds/${uid}/qr?t=${Date.now()}`;
      const wrap = document.getElementById('addressLinksWrap');
      const list = document.getElementById('addressLinksList');
      list.innerHTML = '';
      if (r.links.addresses && r.links.addresses.length) {
        wrap.style.display = 'block';
        r.links.addresses.forEach((a, i) => {
          const div = document.createElement('div');
          div.className = 'link-row';
          div.innerHTML = `<code id="addrLink${i}">${a.link}</code><button class="icon-btn btn-sm" data-copy-text="${encodeURIComponent(a.link)}"><svg width="15" height="15"><use href="#icon-link"/></svg></button>`;
          list.appendChild(div);
        });
        list.querySelectorAll('[data-copy-text]').forEach(btn => {
          btn.addEventListener('click', () => copyText(decodeURIComponent(btn.dataset.copyText)));
        });
      } else {
        wrap.style.display = 'none';
      }
      openModal('linksModal');
    } catch (e) { STANNG.toast(e.detail || 'error', 'error'); }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
      STANNG.toast(STANNG.t('copied'), 'success', 1600);
      STANNG.playSfx('click', 0.4);
    }).catch(() => STANNG.toast('error', 'error'));
  }

  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copyText(document.getElementById(btn.dataset.copy).textContent));
  });

  // ---------------- clean ip addresses ----------------
  async function loadAddresses() {
    try {
      const r = await STANNG.api('/api/addresses');
      currentAddresses = r.addresses || [];
      renderAddressesTable();
    } catch (e) { STANNG.toast(e.detail || 'error', 'error'); }
  }

  function renderAddressesTable() {
    const tbody = document.getElementById('addressesTableBody');
    const empty = document.getElementById('addressesEmpty');
    tbody.innerHTML = '';
    empty.style.display = currentAddresses.length ? 'none' : 'block';
    currentAddresses.forEach((a, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="${STANNG.t('cleanip_address')}"><code style="direction:ltr; unicode-bidi:isolate;">${escapeHtml(a.address)}</code></td>
        <td data-label="${STANNG.t('cleanip_remark')}">${escapeHtml(a.remark || '')}</td>
        <td data-label="${STANNG.t('inb_actions')}"><button class="icon-btn btn-sm" data-del-idx="${i}" style="color:var(--crimson)"><svg width="15" height="15"><use href="#icon-trash"/></svg></button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-del-idx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await STANNG.api(`/api/addresses/${btn.dataset.delIdx}`, { method: 'DELETE' });
          STANNG.toast(STANNG.t('cleanip_deleted'), 'success');
          loadAddresses();
        } catch (e) { STANNG.toast(e.detail || 'error', 'error'); }
      });
    });
  }

  document.getElementById('addAddressBtn').addEventListener('click', () => {
    document.getElementById('fAddress').value = '';
    document.getElementById('fAddressRemark').value = '';
    openModal('addressModal');
  });

  document.getElementById('addressSaveBtn').addEventListener('click', async () => {
    const address = document.getElementById('fAddress').value.trim();
    const remark = document.getElementById('fAddressRemark').value.trim();
    if (!address) { STANNG.toast('required', 'error'); return; }
    const btn = document.getElementById('addressSaveBtn');
    STANNG.setLoading(btn, true);
    try {
      await STANNG.api('/api/addresses', { method: 'POST', body: { address, remark } });
      STANNG.toast(STANNG.t('cleanip_added'), 'success');
      closeModal('addressModal');
      loadAddresses();
    } catch (e) {
      STANNG.toast(e.detail || 'error', 'error');
    } finally {
      STANNG.setLoading(btn, false);
    }
  });

  document.getElementById('fetchCleanIpBtn').addEventListener('click', async () => {
    const btn = document.getElementById('fetchCleanIpBtn');
    STANNG.setLoading(btn, true);
    try {
      const r = await STANNG.api('/api/addresses/fetch-clean', { method: 'POST' });
      STANNG.toast(`${STANNG.t('cleanip_fetch_done')} (${r.added})`, 'success');
      loadAddresses();
    } catch (e) {
      STANNG.toast(e.detail || 'error', 'error');
    } finally {
      STANNG.setLoading(btn, false);
    }
  });

  // ---------------- security ----------------
  document.getElementById('securityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const old_password = document.getElementById('oldPassword').value;
    const new_username = document.getElementById('newUsername').value.trim();
    const new_password = document.getElementById('newPassword').value;
    const new_password2 = document.getElementById('newPassword2').value;
    if (new_password && new_password !== new_password2) {
      STANNG.toast(STANNG.t('setup_mismatch'), 'error');
      STANNG.shake(document.getElementById('securityForm'));
      return;
    }
    const btn = document.getElementById('securityBtn');
    STANNG.setLoading(btn, true);
    try {
      await STANNG.api('/api/change-password', { method: 'POST', body: { old_password, new_username, new_password } });
      STANNG.toast(STANNG.t('sec_updated'), 'success');
      document.getElementById('securityForm').reset();
    } catch (e) {
      let msg = e.detail;
      if (msg === 'wrong-old-password') msg = STANNG.t('sec_wrong_old');
      STANNG.toast(msg || 'error', 'error');
      STANNG.shake(document.getElementById('securityForm'));
    } finally {
      STANNG.setLoading(btn, false);
    }
  });

  // ---------------- settings ----------------
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const payload = {
      public_domain: document.getElementById('settingPublicDomain').value.trim(),
      ota_repo: document.getElementById('settingOtaRepo').value.trim(),
      keep_alive: document.getElementById('settingKeepAlive').checked,
    };
    STANNG.setSoundEnabled(document.getElementById('settingSound').checked);
    const btn = document.getElementById('saveSettingsBtn');
    STANNG.setLoading(btn, true);
    try {
      await STANNG.api('/api/settings', { method: 'POST', body: payload });
      STANNG.toast(STANNG.t('settings_saved'), 'success');
    } catch (e) {
      STANNG.toast(e.detail || 'error', 'error');
    } finally {
      STANNG.setLoading(btn, false);
    }
  });

  // ---------------- advanced config settings ----------------
  document.getElementById('saveAdvancedBtn').addEventListener('click', async () => {
    const payload = {
      default_fingerprint: document.getElementById('settingFingerprint').value,
      default_alpn: document.getElementById('settingAlpn').value,
      sni_override: document.getElementById('settingSniOverride').value.trim(),
      fragment_enabled: document.getElementById('settingFragmentEnabled').checked,
      fragment_packets: document.getElementById('settingFragmentPackets').value.trim() || 'tlshello',
      fragment_length: document.getElementById('settingFragmentLength').value.trim() || '10-30',
      fragment_interval: document.getElementById('settingFragmentInterval').value.trim() || '10-20',
    };
    const btn = document.getElementById('saveAdvancedBtn');
    STANNG.setLoading(btn, true);
    try {
      await STANNG.api('/api/settings', { method: 'POST', body: payload });
      STANNG.toast(STANNG.t('settings_saved'), 'success');
    } catch (e) {
      STANNG.toast(e.detail || 'error', 'error');
    } finally {
      STANNG.setLoading(btn, false);
    }
  });

  document.getElementById('settingFragmentEnabled').addEventListener('change', (e) => {
    document.getElementById('fragmentFields').style.opacity = e.target.checked ? '1' : '.45';
    document.getElementById('fragmentFields').style.pointerEvents = e.target.checked ? 'auto' : 'none';
  });

  // initial load
  loadInbounds();
})();
