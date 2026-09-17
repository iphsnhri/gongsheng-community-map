const CSV_URL = './data/communities.csv';
const mapView = document.querySelector('#mapView');
const mapViewport = document.querySelector('#mapViewport');
const mapSurface = document.querySelector('#mapSurface');
const markerLayer = document.querySelector('#markerLayer');
const kinmenMarker = document.querySelector('#kinmenMarker');
const card = document.querySelector('#communityCard');
const cardScroll = card.querySelector('.card-scroll');
const backdrop = document.querySelector('#sheetBackdrop');
const listPanel = document.querySelector('#communityPanel');
const list = document.querySelector('#communityList');
const status = document.querySelector('#mapStatus');
const searchInput = document.querySelector('#searchInput');
const countyFilter = document.querySelector('#countyFilter');
const storyCount = document.querySelector('#storyCount');

let communities = [];
let selected = null;
let rotation = -7;
let tilt = 22;
let zoom = 1;
let drag = null;
let cardFrame = 0;

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift().map(value => value.replace(/^\uFEFF/, ''));
  return rows.filter(rowItem => rowItem.some(Boolean)).map(rowItem => Object.fromEntries(headers.map((header, index) => [header, rowItem[index] ?? ''])));
}

const countyAnchors = {
  臺北市: { x: 291.7, y: 46.2 },
  新北市: { x: 307.9, y: 50.2 },
  桃園市: { x: 231.9, y: 79.3 },
  新竹市: { x: 198, y: 117 },
  新竹縣: { x: 211, y: 128 },
  苗栗縣: { x: 160.4, y: 159.9 },
  臺中市: { x: 165.2, y: 213.9 },
  彰化縣: { x: 93.4, y: 276.7 },
  南投縣: { x: 164.7, y: 294.7 },
  雲林縣: { x: 69.7, y: 333.4 },
  嘉義市: { x: 97, y: 380 },
  嘉義縣: { x: 82, y: 393 },
  臺南市: { x: 63.5, y: 438.7 },
  高雄市: { x: 100.8, y: 482.3 },
  屏東縣: { x: 136.5, y: 621.5 },
  宜蘭縣: { x: 327.2, y: 121.7 },
  花蓮縣: { x: 257.5, y: 327.1 },
  臺東縣: { x: 213.3, y: 482.8 },
};

function countyCentres() {
  const totals = new Map();
  communities.forEach(community => {
    if (community.社區ID === 'C027') return;
    const county = community.縣市.replaceAll('台', '臺');
    const current = totals.get(county) || { lon: 0, lat: 0, count: 0 };
    current.lon += Number(community.經度);
    current.lat += Number(community.緯度);
    current.count++;
    totals.set(county, current);
  });
  return new Map([...totals].map(([county, value]) => [county, {
    lon: value.lon / value.count,
    lat: value.lat / value.count,
  }]));
}

function projectCommunity(community, centres) {
  const county = community.縣市.replaceAll('台', '臺');
  const anchor = countyAnchors[county];
  const centre = centres.get(county);
  const lon = Number(community.經度);
  const lat = Number(community.緯度);

  if (!anchor || !centre) {
    const x = 141.245689 * lon + 5.38768 * lat - 17012.9796;
    const y = 44.815674 * lon - 205.319895 * lat - 262.636312;
    return { left: ((x + 120) / 612.2) * 100, top: ((y + 24) / 760) * 100 };
  }

  // County anchors keep every point inside the correct county. Coordinates then
  // supply the smaller within-county offset so nearby communities stay distinct.
  const x = anchor.x + (lon - centre.lon) * 76 + (lat - centre.lat) * 12;
  const y = anchor.y + (lon - centre.lon) * 22 - (lat - centre.lat) * 108;
  return { left: ((x + 120) / 612.2) * 100, top: ((y + 24) / 760) * 100 };
}

function resolveMarkerCollisions(points) {
  const placed = [];
  return points.map((point, index) => {
    let candidate = { ...point };
    let attempts = 0;
    while (placed.some(other => Math.hypot(candidate.left - other.left, candidate.top - other.top) < 2.8) && attempts < 12) {
      const angle = (index * 137.5 + attempts * 52) * Math.PI / 180;
      const radius = 2.2 + attempts * .52;
      candidate = { ...point, left: point.left + Math.cos(angle) * radius, top: point.top + Math.sin(angle) * radius };
      attempts++;
    }
    placed.push(candidate);
    return candidate;
  });
}

function shortName(community) {
  const aliases = {
    C005: '龍恩',
    C007: '三安',
    C018: '房角石',
    C021: '林投好客廳',
    C024: '路中廟',
  };
  if (aliases[community.社區ID]) return aliases[community.社區ID];
  return community.社區名稱
    .replaceAll('台', '臺')
    .replace(/^社團法人/, '')
    .replace(/^財團法人/, '')
    .replace(community.縣市, '')
    .replace(community.鄉鎮市區, '')
    .replace(/社區發展協會|社區照顧關懷據點|辦公處|財團法人|福利基金會/g, '')
    .replace(/^[-－]/, '')
    .trim() || community.社區名稱;
}

function createMarkers() {
  const mainland = communities.filter(item => item.社區ID !== 'C027');
  const centres = countyCentres();
  const positions = resolveMarkerCollisions(mainland.map(community => projectCommunity(community, centres)));
  mainland.forEach((community, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-marker';
    button.dataset.id = community.社區ID;
    button.style.left = `${positions[index].left}%`;
    button.style.top = `${positions[index].top}%`;
    button.setAttribute('aria-label', `${community.社區名稱}，${community.縣市}${community.鄉鎮市區}`);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span class="marker-tooltip">${shortName(community)}</span>`;
    button.addEventListener('click', event => { event.stopPropagation(); openCommunity(community.社區ID); });
    markerLayer.append(button);
  });
  kinmenMarker.dataset.id = 'C027';
  kinmenMarker.setAttribute('aria-pressed', 'false');
  kinmenMarker.addEventListener('click', event => { event.stopPropagation(); openCommunity('C027'); });
}

function createList() {
  communities.forEach((community, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'community-list-button';
    button.dataset.id = community.社區ID;
    button.setAttribute('aria-current', 'false');
    button.innerHTML = `<span class="list-index">${String(index + 1).padStart(2, '0')}</span><span class="list-name">${shortName(community)}<small class="list-county">${community.縣市}・${community.鄉鎮市區}</small></span>`;
    button.addEventListener('click', () => openCommunity(community.社區ID));
    list.append(button);
  });
}

function normalizeText(value) {
  return String(value || '').replaceAll('台', '臺').toLocaleLowerCase('zh-Hant');
}

function applyFilters() {
  const query = normalizeText(searchInput.value.trim());
  const county = countyFilter.value;
  let visibleCount = 0;
  communities.forEach(community => {
    const searchable = normalizeText(`${community.社區名稱} ${community.縣市} ${community.鄉鎮市區}`);
    const matches = (!query || searchable.includes(query)) && (!county || community.縣市 === county);
    document.querySelectorAll(`[data-id="${community.社區ID}"]`).forEach(element => {
      element.classList.toggle('is-filtered-out', !matches);
    });
    if (matches) visibleCount++;
  });
  storyCount.textContent = `${visibleCount} 個社區・${visibleCount} 段故事`;
  document.querySelector('#communityCount').textContent = visibleCount;
}

function youtubeId(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1);
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2];
    if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2];
    return parsed.searchParams.get('v') || '';
  } catch { return ''; }
}

function renderMedia(community) {
  const videoId = youtubeId(community.YouTube影片網址);
  const photo = community.社區照片網址.trim();
  if (videoId) {
    return `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0" title="${community.社區名稱}成果影片" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }
  if (photo) {
    return `<img src="${photo}" alt="${community.照片替代文字 || community.社區名稱 + '活動照片'}">`;
  }
  return `<div class="media-placeholder"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="30" rx="6"/><path d="m18 19 13 5-13 5Z"/><path d="M13 35h22"/></svg><strong>影片準備中</strong><span>社區成果影片上線後將在此播放</span></div>`;
}

function openCommunity(id, { updateUrl = true } = {}) {
  const community = communities.find(item => item.社區ID === id);
  if (!community) return;
  selected = community;
  document.querySelector('#cardLocation').textContent = `${community.縣市}・${community.鄉鎮市區}`;
  document.querySelector('#cardTitle').textContent = community.社區名稱;
  document.querySelector('#cardAddress').textContent = community.完整地址;
  document.querySelector('#cardIntro').textContent = community.社區簡介;
  document.querySelector('#mediaFrame').innerHTML = renderMedia(community);
  const highlightList = document.querySelector('#cardHighlights');
  highlightList.replaceChildren(...community.計畫成果重點.split('；').filter(Boolean).map(text => {
    const item = document.createElement('li'); item.textContent = text.replace(/[。；]+$/, ''); return item;
  }));
  document.querySelectorAll('[data-id]').forEach(element => {
    if (element.classList.contains('community-list-button')) element.setAttribute('aria-current', String(element.dataset.id === id));
    else element.setAttribute('aria-pressed', String(element.dataset.id === id));
  });
  card.hidden = false;
  cardScroll.scrollTop = 0;
  backdrop.hidden = !isMobile();
  listPanel.classList.remove('is-open');
  document.querySelector('#listToggle').setAttribute('aria-expanded', 'false');
  scheduleCardPosition();
  if (updateUrl) {
    const url = new URL(location.href); url.searchParams.set('community', id); history.replaceState({}, '', url);
  }
}

function closeCommunity({ updateUrl = true } = {}) {
  selected = null;
  card.hidden = true;
  backdrop.hidden = true;
  document.querySelector('#mediaFrame').replaceChildren();
  document.querySelectorAll('[data-id]').forEach(element => {
    if (element.classList.contains('community-list-button')) element.setAttribute('aria-current', 'false');
    else element.setAttribute('aria-pressed', 'false');
  });
  if (updateUrl) {
    const url = new URL(location.href); url.searchParams.delete('community'); history.replaceState({}, '', url);
  }
}

function isMobile() { return matchMedia('(max-width: 760px)').matches; }

function scheduleCardPosition() {
  cancelAnimationFrame(cardFrame);
  cardFrame = requestAnimationFrame(positionCard);
}

function positionCard() {
  if (!selected || card.hidden || isMobile()) return;
  const marker = document.querySelector(`[data-id="${selected.社區ID}"]:not(.community-list-button)`);
  if (!marker) return;
  const viewRect = mapView.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;
  const markerCenterX = markerRect.left + markerRect.width / 2 - viewRect.left;
  const markerCenterY = markerRect.top + markerRect.height / 2 - viewRect.top;
  const gap = 26;
  const margin = 16;
  let left = markerCenterX + gap;
  let side = 'right';
  if (left + cardWidth > viewRect.width - margin) { left = markerCenterX - cardWidth - gap; side = 'left'; }
  left = Math.max(margin, Math.min(left, viewRect.width - cardWidth - margin));
  let top = Math.max(margin, Math.min(markerCenterY - 54, viewRect.height - cardHeight - margin));
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.setProperty('--pointer-y', `${Math.max(24, Math.min(markerCenterY - top - 8, cardHeight - 36))}px`);
  card.classList.toggle('card-left', side === 'left');
}

function updateMapTransform() {
  mapSurface.style.setProperty('--turn', `${rotation}deg`);
  mapSurface.style.setProperty('--tilt', `${tilt}deg`);
  mapSurface.style.setProperty('--zoom', zoom);
  scheduleCardPosition();
}

function openPanel() {
  listPanel.classList.add('is-open');
  backdrop.hidden = false;
  document.querySelector('#listToggle').setAttribute('aria-expanded', 'true');
}
function closePanel() {
  listPanel.classList.remove('is-open');
  backdrop.hidden = !selected || !isMobile();
  document.querySelector('#listToggle').setAttribute('aria-expanded', 'false');
}

mapViewport.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return;
  drag = { x: event.clientX, y: event.clientY, rotation, tilt };
  mapViewport.setPointerCapture(event.pointerId);
  mapViewport.classList.add('is-dragging');
});
mapViewport.addEventListener('pointermove', event => {
  if (!drag) return;
  rotation = Math.max(-24, Math.min(24, drag.rotation + (event.clientX - drag.x) * .08));
  tilt = Math.max(8, Math.min(34, drag.tilt - (event.clientY - drag.y) * .05));
  updateMapTransform();
});
mapViewport.addEventListener('pointerup', () => { drag = null; mapViewport.classList.remove('is-dragging'); });
mapViewport.addEventListener('pointercancel', () => { drag = null; mapViewport.classList.remove('is-dragging'); });
mapViewport.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = Math.max(.82, Math.min(1.34, zoom + (event.deltaY < 0 ? .06 : -.06)));
  updateMapTransform();
}, { passive: false });

document.querySelector('#zoomIn').addEventListener('click', () => { zoom = Math.min(1.34, zoom + .1); updateMapTransform(); });
document.querySelector('#zoomOut').addEventListener('click', () => { zoom = Math.max(.82, zoom - .1); updateMapTransform(); });
document.querySelector('#resetMap').addEventListener('click', () => { rotation = -7; tilt = 22; zoom = 1; updateMapTransform(); });
document.querySelector('#cardClose').addEventListener('click', () => closeCommunity());
document.querySelector('#listToggle').addEventListener('click', openPanel);
document.querySelector('#panelClose').addEventListener('click', closePanel);
backdrop.addEventListener('click', () => { if (listPanel.classList.contains('is-open')) closePanel(); else closeCommunity(); });
addEventListener('resize', scheduleCardPosition);
addEventListener('keydown', event => { if (event.key === 'Escape') { if (listPanel.classList.contains('is-open')) closePanel(); else if (selected) closeCommunity(); } });

async function init() {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    communities = parseCsv(await response.text())
      .filter(item => item.是否發布 === '是')
      .sort((a, b) => Number(a.顯示順序) - Number(b.顯示順序));
    document.querySelector('#communityCount').textContent = communities.length;
    [...new Set(communities.map(item => item.縣市))].sort((a, b) => a.localeCompare(b, 'zh-Hant')).forEach(county => {
      const option = document.createElement('option');
      option.value = county;
      option.textContent = county;
      countyFilter.append(option);
    });
    createMarkers();
    createList();
    applyFilters();
    status.hidden = true;
    const requested = new URL(location.href).searchParams.get('community');
    if (requested) openCommunity(requested.toUpperCase(), { updateUrl: false });
  } catch (error) {
    console.error(error);
    status.textContent = '社區資料載入失敗，請重新整理頁面。';
  }
}

searchInput.addEventListener('input', applyFilters);
countyFilter.addEventListener('change', applyFilters);

init();
