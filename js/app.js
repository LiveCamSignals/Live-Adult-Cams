(function () {
  'use strict';

  const API_URL = 'https://bngprm.com/promo.php?c=18144&type=api&api_v=1&limit=120&api_type=json';
  const AFFILIATE_ID = '18144';
  const REFRESH_INTERVAL = 45; // seconds

  let models = [];
  let filtered = [];
  let activeTag = null;
  let countdown = REFRESH_INTERVAL;
  let refreshTimer = null;
  let countdownTimer = null;

  // DOM
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const grid = $('#modelGrid');
  const loading = $('#loading');
  const errorEl = $('#error');
  const noResults = $('#noResults');
  const pageTitle = $('#pageTitle');
  const totalLive = $('#totalLive');
  const countdownEl = $('#countdown');
  const tagCloud = $('#tagCloud');
  const searchInput = $('#searchInput');
  const genderSelect = $('#genderSelect');
  const sortSelect = $('#sortSelect');
  const filterHD = $('#filterHD');
  const filterMobile = $('#filterMobile');
  const filterNew = $('#filterNew');
  const modal = $('#modal');
  const modalBody = $('#modalBody');

  // Age gate
  const ageGate = $('#ageGate');
  if (localStorage.getItem('ageVerified') === 'true') {
    ageGate.classList.add('hidden');
  }
  $('#ageYes').addEventListener('click', () => {
    localStorage.setItem('ageVerified', 'true');
    ageGate.classList.add('hidden');
  });
  $('#ageNo').addEventListener('click', () => {
    window.location.href = 'https://www.google.com';
  });

  // Helpers
  function fixUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    return url;
  }

  function getThumb(m) {
    const imgs = m.profile_images || {};
    return fixUrl(
      imgs.thumbnail_image_big_live ||
      imgs.thumbnail_image_medium_live ||
      imgs.thumbnail_image_big ||
      imgs.thumbnail_image_medium ||
      imgs.profile_image ||
      ''
    );
  }

  function affiliateChatLink(username) {
    return `https://bngprm.com/promo.php?type=direct_link&v=2&c=${AFFILIATE_ID}&models[]=${encodeURIComponent(username)}`;
  }

  function affiliateProfileLink(m) {
    return m.profile_page_url || m.chat_url || affiliateChatLink(m.username);
  }

  function formatOnline(seconds) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // Fetch
  async function fetchModels() {
    loading.classList.remove('hidden');
    errorEl.classList.add('hidden');
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      models = Array.isArray(data) ? data : [];
      applyFilters();
      buildTagCloud();
      totalLive.textContent = models.length;
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'Failed to load live cams. Please try again later.';
      errorEl.classList.remove('hidden');
      grid.innerHTML = '';
    } finally {
      loading.classList.add('hidden');
    }
  }

  // Filters
  function applyFilters() {
    let list = [...models];

    // Gender
    const gender = genderSelect.value;
    if (gender && gender !== 'all') {
      list = list.filter(m => (m.gender || '').includes(gender) || m.gender === gender);
    }

    // Nav filters
    const activeNav = $('.nav-link.active');
    if (activeNav) {
      const f = activeNav.dataset.filter;
      if (f === 'Female') list = list.filter(m => m.gender === 'Female');
      else if (f === 'Couple') list = list.filter(m => (m.gender || '').toLowerCase().includes('couple'));
      else if (f === 'hd') list = list.filter(m => m.hd_cam);
      else if (f === 'mobile') list = list.filter(m => m.is_mobile);
    }

    // Checkboxes
    if (filterHD.checked) list = list.filter(m => m.hd_cam);
    if (filterMobile.checked) list = list.filter(m => m.is_mobile);
    if (filterNew.checked) list = list.filter(m => m.is_new);

    // Search / Tag
    const q = (searchInput.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter(m => {
        const name = (m.display_name || m.username || '').toLowerCase();
        const tags = (m.tags || []).join(' ').toLowerCase();
        const topic = (m.chat_topic || '').toLowerCase();
        return name.includes(q) || tags.includes(q) || topic.includes(q);
      });
    }
    if (activeTag) {
      list = list.filter(m => (m.tags || []).some(t => t.toLowerCase() === activeTag.toLowerCase()));
    }

    // Sort
    const sort = sortSelect.value;
    if (sort === 'viewers') {
      list.sort((a, b) => (b.members_count || 0) - (a.members_count || 0));
    } else if (sort === 'online') {
      list.sort((a, b) => (b.online_time || 0) - (a.online_time || 0));
    } else if (sort === 'name') {
      list.sort((a, b) => (a.display_name || a.username || '').localeCompare(b.display_name || b.username || ''));
    }

    filtered = list;
    render();
  }

  function render() {
    if (filtered.length === 0) {
      grid.innerHTML = '';
      noResults.classList.remove('hidden');
      return;
    }
    noResults.classList.add('hidden');

    const isList = grid.classList.contains('list-view');

    grid.innerHTML = filtered.map(m => {
      const thumb = getThumb(m);
      const name = m.display_name || m.username;
      const age = m.display_age ? `, ${m.display_age}` : '';
      const viewers = m.members_count || 0;
      const topic = m.chat_topic || m.chat_topic_ru || '';
      const tags = (m.tags || []).slice(0, 4);
      const genderShort = (m.gender || '').replace('Couple Female + Male', 'Couple').replace('Couple Female + Female', 'Lesbian Couple');

      return `
        <article class="model-card" data-username="${m.username}">
          <div class="thumb-wrap">
            <img src="${thumb}" alt="${name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/16161a/666?text=Live'">
            <span class="live-badge">LIVE</span>
            <span class="viewers-badge">👁 ${viewers}</span>
            ${m.hd_cam ? '<span class="hd-badge">HD</span>' : ''}
            ${m.is_mobile ? '<span class="mobile-badge">Mobile</span>' : ''}
          </div>
          <div class="card-body">
            <div class="card-name">${name}${age}</div>
            <div class="card-meta">
              <span>${genderShort}</span>
              <span>${formatOnline(m.online_time)}</span>
            </div>
            <div class="card-topic" title="${topic}">${topic || ' '}</div>
            <div class="card-tags">
              ${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Click handlers
    $$('.model-card').forEach(card => {
      card.addEventListener('click', () => openModal(card.dataset.username));
    });
  }

  function buildTagCloud() {
    const counts = {};
    models.forEach(m => {
      (m.tags || []).forEach(t => {
        const key = t.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24);

    tagCloud.innerHTML = sorted.map(([tag, count]) =>
      `<span class="tag ${activeTag === tag ? 'active' : ''}" data-tag="${tag}">${tag} (${count})</span>`
    ).join('');

    $$('.tag').forEach(el => {
      el.addEventListener('click', () => {
        const t = el.dataset.tag;
        if (activeTag === t) {
          activeTag = null;
          pageTitle.textContent = 'All Live Cams';
        } else {
          activeTag = t;
          pageTitle.textContent = `Tag: ${t}`;
        }
        $$('.tag').forEach(x => x.classList.toggle('active', x.dataset.tag === activeTag));
        applyFilters();
      });
    });
  }

  function openModal(username) {
    const m = models.find(x => x.username === username);
    if (!m) return;

    const thumb = getThumb(m);
    const name = m.display_name || m.username;
    const chatLink = affiliateChatLink(m.username);
    const profileLink = affiliateProfileLink(m);
    const tags = (m.tags || []).slice(0, 12).map(t => `<span class="tag">${t}</span>`).join(' ');

    modalBody.innerHTML = `
      <div class="modal-body-inner">
        <div class="modal-player">
          <img src="${thumb}" alt="${name}">
        </div>
        <div class="modal-info">
          <h2>${name}${m.display_age ? ` · ${m.display_age}` : ''}</h2>
          <div class="meta">
            ${m.gender || ''} · ${m.members_count || 0} viewers · ${formatOnline(m.online_time)} online
            ${m.hd_cam ? ' · HD' : ''} ${m.is_mobile ? ' · Mobile' : ''}
          </div>
          <div class="topic">${m.chat_topic || m.chat_topic_ru || ''}</div>
          <div class="tag-cloud" style="margin-bottom:16px">${tags}</div>
          <p style="font-size:0.85rem;color:var(--text-muted)">
            ${m.homecountry || ''} ${m.hometown ? '· ' + m.hometown : ''}<br>
            ${m.height || ''} ${m.weight ? '· ' + m.weight : ''}<br>
            Languages: ${m.primary_language || ''} ${m.secondary_language ? '/ ' + m.secondary_language : ''}
          </p>
          <div class="modal-actions">
            <a href="${chatLink}" target="_blank" rel="noopener sponsored" class="btn-chat">Watch Live Chat →</a>
            <a href="${profileLink}" target="_blank" rel="noopener sponsored" class="btn-profile">View Profile</a>
          </div>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  // Events
  $('#modalClose').addEventListener('click', () => modal.classList.add('hidden'));
  $('.modal-backdrop').addEventListener('click', () => modal.classList.add('hidden'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') modal.classList.add('hidden');
  });

  $$('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      $$('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      activeTag = null;
      pageTitle.textContent = link.textContent;
      applyFilters();
    });
  });

  [searchInput, genderSelect, sortSelect, filterHD, filterMobile, filterNew].forEach(el => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  $('#clearFilters').addEventListener('click', () => {
    searchInput.value = '';
    genderSelect.value = 'all';
    sortSelect.value = 'viewers';
    filterHD.checked = false;
    filterMobile.checked = false;
    filterNew.checked = false;
    activeTag = null;
    $$('.nav-link').forEach(l => l.classList.remove('active'));
    $('.nav-link[data-filter="all"]').classList.add('active');
    pageTitle.textContent = 'All Live Cams';
    applyFilters();
  });

  $$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      grid.classList.toggle('list-view', btn.dataset.view === 'list');
    });
  });

  $('#refreshBtn').addEventListener('click', () => {
    fetchModels();
    resetCountdown();
  });

  // Auto refresh
  function resetCountdown() {
    countdown = REFRESH_INTERVAL;
    countdownEl.textContent = countdown;
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      countdown--;
      countdownEl.textContent = countdown;
      if (countdown <= 0) {
        fetchModels();
        resetCountdown();
      }
    }, 1000);
  }

  // Init
  fetchModels();
  resetCountdown();
})();
