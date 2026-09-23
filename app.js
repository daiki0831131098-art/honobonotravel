const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const toast = document.getElementById('toast');
let toastTimer;
const tripPlans = {
  setouchi: { title: '瀬戸内、光の島へ', prefix: '瀬戸内、', accent: '光の島へ。', dates: '2024.09.20 — 09.23', shortDates: '09.20 — 09.23', days: 4, members: 3, mood: 'ゆったり、発見', progress: 72, season: '2024 AUTUMN' },
  hokkaido: { title: '北の大地をめぐる', prefix: '北の大地を', accent: 'めぐる。', dates: '2024.10.11 — 10.15', shortDates: '10.11 — 10.15', days: 5, members: 2, mood: '壮大に、のんびり', progress: 28, season: '2024 AUTUMN' }
};
const savedTripPlans = JSON.parse(localStorage.getItem('tabiTrips') || '{}');
Object.assign(tripPlans, savedTripPlans);
let activeTripId = 'setouchi';
let selectedSpot = null;
let pendingDeleteIndex = null;
let draggedSpotIndex = null;
let googleMapInstance = null;
let googleMapMarkers = [];
let googleMapsLoader = null;
const spotColors = ['#ed704e', '#eab344', '#36b7a7', '#5d8fd0', '#c779c9', '#7c83d4'];
const placeCatalog = [
  { name: '直島・宮浦港', address: '香川県香川郡直島町', lat: 34.4607, lon: 133.9954, category: '移動' },
  { name: '地中美術館', address: '香川県香川郡直島町3449-1', lat: 34.4598, lon: 133.9857, category: '観光' },
  { name: '豊島美術館', address: '香川県小豆郡土庄町豊島唐櫃607', lat: 34.4826, lon: 134.0856, category: '観光' },
  { name: '高松港', address: '香川県高松市サンポート', lat: 34.3508, lon: 134.0466, category: '移動' },
  { name: '島食DOみやんだ', address: '香川県香川郡直島町本村845', lat: 34.4566, lon: 133.9971, category: '食べる' }
];

function saveTripPlans() {
  localStorage.setItem('tabiTrips', JSON.stringify(tripPlans));
}

function renderCustomSpots(trip) {
  const list = document.getElementById('customSpotList');
  list.replaceChildren();
  const spots = trip.spots || [];
  list.hidden = spots.length === 0;
  spots.forEach((spot, index) => {
    const item = document.createElement('article');
    item.className = 'custom-spot';
    item.draggable = true;
    item.dataset.spotIndex = index;
    item.style.setProperty('--spot-color', spotColors[index % spotColors.length]);
    item.innerHTML = `<span class="custom-spot-number">${String.fromCharCode(65 + index)}</span><div><strong></strong><span></span></div><i></i><span class="drag-handle" aria-hidden="true">↕</span><button class="delete-spot" data-spot-index="${index}" aria-label="場所を削除">×</button>`;
    item.querySelector('strong').textContent = spot.name;
    item.querySelector('span:nth-child(2)').textContent = spot.address;
    item.querySelector('i').textContent = spot.category || 'SPOT';
    list.append(item);
  });
}

function renderHomeMap(trip) {
  const spots = trip.spots || [];
  const map = document.getElementById('homeMapContent');
  const pinList = document.getElementById('homePinList');
  const mapLink = document.getElementById('openGoogleMapBtn');
  pinList.replaceChildren();
  pinList.hidden = spots.length === 0;
  if (!spots.length) {
    map.innerHTML = '<div class="map-placeholder"><span>⌖</span><strong>場所を追加すると、ここにピンが表示されます</strong><small>Google Maps</small></div>';
    mapLink.href = 'https://www.google.com/maps';
    return;
  }
  const query = spots.map((spot) => `${spot.name} ${spot.address}`).join(' ');
  map.innerHTML = `<div id="googleMapCanvas" class="google-map-canvas" aria-label="${trip.title}のGoogle Maps"></div>`;
  mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  renderGoogleMap(trip, spots, query);
  spots.forEach((spot, index) => {
    const item = document.createElement('article');
    item.className = 'home-pin';
    item.innerHTML = `<span class="pin-index" style="--spot-color:${spotColors[index % spotColors.length]}">${String.fromCharCode(65 + index)}</span><div><strong></strong><small></small></div><a target="_blank" rel="noreferrer" aria-label="Google Mapsで開く">↗</a><button class="delete-spot" data-spot-index="${index}" aria-label="場所を削除">×</button>`;
    item.querySelector('strong').textContent = spot.name;
    item.querySelector('small').textContent = spot.address;
    item.querySelector('a').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name} ${spot.address}`)}`;
    pinList.append(item);
  });
}

function loadGoogleMapsApi() {
  const apiKey = localStorage.getItem('googleMapsApiKey') || '';
  if (!apiKey) return Promise.reject(new Error('Google Maps API key is not configured.'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsLoader) return googleMapsLoader;
  googleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Google Maps API could not be loaded.'));
    document.head.append(script);
  });
  return googleMapsLoader;
}

function clearGoogleMapMarkers() {
  googleMapMarkers.forEach((marker) => marker.setMap(null));
  googleMapMarkers = [];
}

function createPinIcon(maps, letter, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path fill="${color}" stroke="white" stroke-width="3" d="M20 2C10 2 3 9 3 18c0 12 17 28 17 28s17-16 17-28C37 9 30 2 20 2z"/><text x="20" y="24" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="15" font-weight="700" fill="white">${letter}</text></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new maps.Size(40, 48), anchor: new maps.Point(20, 48) };
}

function renderGoogleMap(trip, spots, query) {
  const canvas = document.getElementById('googleMapCanvas');
  if (!canvas) return;
  loadGoogleMapsApi().then((maps) => {
    clearGoogleMapMarkers();
    const firstSpot = spots[0];
    googleMapInstance = new maps.Map(canvas, { center: { lat: firstSpot.lat, lng: firstSpot.lon }, zoom: spots.length === 1 ? 13 : 8, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: 'greedy' });
    const bounds = new maps.LatLngBounds();
    spots.forEach((spot, index) => {
      const position = { lat: spot.lat, lng: spot.lon };
      bounds.extend(position);
      const marker = new maps.Marker({ map: googleMapInstance, position, title: spot.name, label: { text: String.fromCharCode(65 + index), color: '#ffffff', fontWeight: '700' }, icon: createPinIcon(maps, String.fromCharCode(65 + index), spotColors[index % spotColors.length]) });
      googleMapMarkers.push(marker);
    });
    if (spots.length > 1) googleMapInstance.fitBounds(bounds, 55);
  }).catch(() => {
    const fallback = document.getElementById('homeMapContent');
    if (!fallback) return;
    fallback.innerHTML = `<iframe title="${trip.title}のGoogle Maps" src="https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed" loading="lazy"></iframe><div class="map-key-notice">APIキーを設定すると、A・B・Cピンが地図の移動に連動します</div>`;
  });
}

function addTripOption(tripId) {
  if (document.querySelector(`[data-trip="${tripId}"]`)) return;
  const trip = tripPlans[tripId];
  const option = document.createElement('button');
  option.className = 'trip-option';
  option.dataset.trip = tripId;
  option.innerHTML = `<span class="trip-color"></span><span><strong></strong><small>${trip.shortDates}</small></span><b>✓</b>`;
  option.querySelector('strong').textContent = trip.title;
  document.getElementById('tripOptions').append(option);
}

function filterTrips(query) {
  const normalizedQuery = query.trim().toLowerCase();
  let visibleCount = 0;
  document.querySelectorAll('.trip-option').forEach((option) => {
    const searchableText = option.textContent.toLowerCase();
    const matches = !normalizedQuery || searchableText.includes(normalizedQuery);
    option.hidden = !matches;
    if (matches) visibleCount += 1;
  });
  document.getElementById('tripSearchEmpty').hidden = visibleCount > 0;
}

function renderTrip(tripId, notify = true) {
  const trip = tripPlans[tripId];
  if (!trip) return;
  activeTripId = tripId;
  const hasSpots = Boolean(trip.spots && trip.spots.length);
  const isTemplateTrip = tripId === 'setouchi';
  const isBlankTrip = !isTemplateTrip;
  document.getElementById('currentTripTitle').textContent = trip.title;
  document.getElementById('currentTripDates').textContent = trip.dates;
  document.getElementById('currentTripProgress').textContent = `${trip.progress}%`;
  document.querySelector('.mini-progress span').style.width = `${trip.progress}%`;
  document.getElementById('breadcrumbTrip').textContent = trip.title;
  document.getElementById('tripTitlePrefix').textContent = trip.prefix;
  document.getElementById('tripTitleAccent').textContent = trip.accent;
  document.getElementById('tripSeason').textContent = trip.season;
  document.getElementById('summaryDate').textContent = trip.shortDates;
  document.getElementById('summaryDays').textContent = trip.days;
  document.getElementById('summaryMembers').textContent = trip.members;
  document.getElementById('summaryMood').textContent = trip.mood;
  const tripOption = document.querySelector(`.trip-option[data-trip="${tripId}"]`);
  if (tripOption) tripOption.querySelector('small').textContent = trip.shortDates;
  document.getElementById('itineraryMeta').textContent = isTemplateTrip ? `4 DAYS · ${8 + spotsCount(trip)} PLACES` : `${spotsCount(trip)} PLACES`;
  document.querySelector('.plan-view').classList.toggle('blank-mode', isBlankTrip);
  document.querySelector('.plan-view').classList.toggle('empty-mode', isBlankTrip && !hasSpots);
  document.querySelector('.guide-view').classList.toggle('empty-mode', !isTemplateTrip);
  document.querySelector('.movie-view').classList.toggle('empty-mode', !isTemplateTrip);
  document.getElementById('planEmptyState').hidden = isTemplateTrip || hasSpots;
  document.getElementById('guideEmptyState').hidden = isTemplateTrip;
  document.getElementById('movieEmptyState').hidden = isTemplateTrip;
  renderCustomSpots(trip);
  renderHomeMap(trip);
  document.querySelectorAll('.trip-option').forEach((option) => option.classList.toggle('active', option.dataset.trip === tripId));
  if (notify) showToast(`${trip.title} に切り替えました`);
}

function spotsCount(trip) {
  return trip.spots ? trip.spots.length : 0;
}

function splitTripTitle(title) {
  const separator = title.indexOf('、');
  if (separator < 0) return { prefix: '', accent: `${title.replace(/[。]+$/, '')}。` };
  return { prefix: title.slice(0, separator + 1), accent: `${title.slice(separator + 1).replace(/[。]+$/, '')}。` };
}

function parseTripDates(trip) {
  const match = trip.dates?.match(/(\d{4})\.(\d{2})\.(\d{2})\s*—\s*(?:(\d{4})\.)?(\d{2})\.(\d{2})/);
  if (!match) return { start: '', end: '' };
  return { start: `${match[1]}-${match[2]}-${match[3]}`, end: `${match[4] || match[1]}-${match[5]}-${match[6]}` };
}

function displayDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${year}.${month}.${day}`;
}

function shortDateRange(start, end) {
  if (!start || !end) return '未設定';
  return `${start.slice(5).replace('-', '.')} — ${end.slice(5).replace('-', '.')}`;
}

function openTripEditModal() {
  const trip = tripPlans[activeTripId];
  if (!trip) return;
  const dates = parseTripDates(trip);
  document.getElementById('editTripName').value = trip.title;
  document.getElementById('editTripStart').value = dates.start;
  document.getElementById('editTripEnd').value = dates.end;
  document.getElementById('editTripMembers').value = trip.members || 1;
  document.getElementById('editTripMood').value = trip.mood || '';
  document.getElementById('tripEditModal').hidden = false;
  document.getElementById('editTripName').focus();
}

function closeTripEditModal() {
  document.getElementById('tripEditModal').hidden = true;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function switchView(viewName) {
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
  views.forEach((view) => {
    view.hidden = false;
    view.classList.toggle('active-view', view.dataset.panel === viewName);
  });
  const target = document.querySelector(`[data-panel="${viewName}"]`);
  if (target) {
    target.id = viewName;
    window.location.hash = viewName;
    setTimeout(() => window.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + window.scrollY - 24)), 0);
  }
}

document.querySelectorAll('[data-view]').forEach((item) => item.addEventListener('click', () => switchView(item.dataset.view)));
document.getElementById('tripOptions').addEventListener('click', (event) => {
  const option = event.target.closest('.trip-option');
  if (option) renderTrip(option.dataset.trip);
});
document.getElementById('customSpotList').addEventListener('dragstart', (event) => {
  const spot = event.target.closest('.custom-spot');
  if (!spot) return;
  draggedSpotIndex = Number(spot.dataset.spotIndex);
  spot.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(draggedSpotIndex));
});
document.getElementById('customSpotList').addEventListener('dragover', (event) => {
  const spot = event.target.closest('.custom-spot');
  if (!spot) return;
  event.preventDefault();
  document.querySelectorAll('.custom-spot').forEach((item) => item.classList.toggle('drag-over', item === spot));
});
document.getElementById('customSpotList').addEventListener('drop', (event) => {
  const target = event.target.closest('.custom-spot');
  if (!target || draggedSpotIndex === null) return;
  event.preventDefault();
  const targetIndex = Number(target.dataset.spotIndex);
  const trip = tripPlans[activeTripId];
  if (trip?.spots && draggedSpotIndex !== targetIndex) {
    const [movedSpot] = trip.spots.splice(draggedSpotIndex, 1);
    trip.spots.splice(targetIndex, 0, movedSpot);
    saveTripPlans();
    renderTrip(activeTripId, false);
    showToast(`${movedSpot.name} の順番を変更しました`);
  }
  draggedSpotIndex = null;
});
document.getElementById('customSpotList').addEventListener('dragend', () => {
  draggedSpotIndex = null;
  document.querySelectorAll('.custom-spot').forEach((item) => item.classList.remove('dragging', 'drag-over'));
});
const tripModal = document.getElementById('tripModal');
const tripNameInput = document.getElementById('tripNameInput');

function closeTripModal() {
  tripModal.hidden = true;
}

document.getElementById('newTripBtn').addEventListener('click', () => {
  tripModal.hidden = false;
  tripNameInput.focus();
});
document.getElementById('closeTripModal').addEventListener('click', closeTripModal);
tripModal.addEventListener('click', (event) => {
  if (event.target === tripModal) closeTripModal();
});
document.getElementById('tripForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = tripNameInput.value.trim();
  if (!name) return;
  const tripId = `trip-${Date.now()}`;
  tripPlans[tripId] = { title: name.trim(), prefix: '', accent: `${name.trim()}。`, dates: '日程未設定', shortDates: '未設定', days: 0, members: 1, mood: 'これから決める', progress: 0, season: 'NEW TRIP', isNew: true };
  saveTripPlans();
  addTripOption(tripId);
  closeTripModal();
  tripNameInput.value = '';
  filterTrips(document.getElementById('tripSearchInput').value);
  renderTrip(tripId);
});
document.getElementById('tripSearchInput').addEventListener('input', (event) => filterTrips(event.target.value));
document.getElementById('clearTripSearch').addEventListener('click', () => {
  const input = document.getElementById('tripSearchInput');
  input.value = '';
  filterTrips('');
  input.focus();
});
function openSpotModal() {
  document.getElementById('spotModal').hidden = false;
  document.getElementById('spotSearchInput').focus();
  renderSpotResults(placeCatalog, 'おすすめの場所');
}

function closeSpotModal() {
  document.getElementById('spotModal').hidden = true;
  selectedSpot = null;
  document.getElementById('spotSelected').hidden = true;
  document.getElementById('spotMap').innerHTML = '<div class="map-placeholder"><span>⌖</span><strong>場所を選ぶと地図が表示されます</strong><small>Google Maps</small></div>';
}

function renderSpotResults(results, heading) {
  const container = document.getElementById('spotResults');
  container.replaceChildren();
  const label = document.createElement('span');
  label.className = 'section-label';
  label.textContent = heading;
  container.append(label);
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'spot-no-results';
    empty.textContent = '場所が見つかりませんでした。別のキーワードで検索してください。';
    container.append(empty);
    return;
  }
  results.forEach((spot, index) => {
    const button = document.createElement('button');
    button.className = 'spot-result';
    button.dataset.index = index;
    button.innerHTML = '<span class="spot-pin">⌖</span><span><strong></strong><small></small></span><b>＋</b>';
    button.querySelector('strong').textContent = spot.name;
    button.querySelector('small').textContent = spot.address;
    button.addEventListener('click', () => selectSpot(spot));
    container.append(button);
  });
}

function selectSpot(spot) {
  selectedSpot = spot;
  document.getElementById('spotSelected').hidden = false;
  document.getElementById('selectedSpotName').textContent = spot.name;
  document.getElementById('selectedSpotAddress').textContent = spot.address;
  document.getElementById('addSelectedSpotBtn').disabled = false;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${spot.name} ${spot.address}`)}&output=embed`;
  document.getElementById('spotMap').innerHTML = `<iframe title="${spot.name}の地図" src="${mapUrl}" loading="lazy"></iframe>`;
}

async function searchSpots(query) {
  const localResults = placeCatalog.filter((spot) => `${spot.name}${spot.address}`.includes(query));
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ja&limit=6&q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search request failed');
    const remoteResults = await response.json();
    const normalized = remoteResults.map((spot) => ({ name: spot.name || spot.display_name.split(',')[0], address: spot.display_name, lat: Number(spot.lat), lon: Number(spot.lon), category: '検索結果' }));
    const related = localResults.filter((localSpot) => !normalized.some((spot) => spot.name === localSpot.name));
    renderSpotResults([...normalized, ...related], normalized.length ? '検索結果・類似候補' : '類似候補');
  } catch (error) {
    renderSpotResults(localResults, '類似候補');
  }
}

document.getElementById('addSpotBtn').addEventListener('click', openSpotModal);
document.getElementById('emptyAddSpotBtn').addEventListener('click', openSpotModal);
document.getElementById('closeSpotModal').addEventListener('click', closeSpotModal);
document.getElementById('spotModal').addEventListener('click', (event) => {
  if (event.target.id === 'spotModal') closeSpotModal();
});
document.getElementById('spotSearchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = document.getElementById('spotSearchInput').value.trim();
  if (query) searchSpots(query);
});
document.getElementById('addSelectedSpotBtn').addEventListener('click', () => {
  if (!selectedSpot) return;
  const selectedSpotName = selectedSpot.name;
  const trip = tripPlans[activeTripId];
  trip.spots = trip.spots || [];
  if (!trip.spots.some((spot) => spot.name === selectedSpot.name)) trip.spots.push(selectedSpot);
  trip.isNew = activeTripId !== 'setouchi';
  saveTripPlans();
  closeSpotModal();
  renderTrip(activeTripId);
  showToast(`${selectedSpotName} を旅程に追加しました`);
});
function openDeleteModal(index) {
  const spot = tripPlans[activeTripId]?.spots?.[index];
  if (!spot) return;
  pendingDeleteIndex = index;
  document.getElementById('deleteModalCopy').textContent = `「${spot.name}」を旅のプランから削除します。操作は取り消せません。`;
  document.getElementById('deleteModal').hidden = false;
}

function closeDeleteModal() {
  pendingDeleteIndex = null;
  document.getElementById('deleteModal').hidden = true;
}

document.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.delete-spot');
  if (deleteButton) openDeleteModal(Number(deleteButton.dataset.spotIndex));
});
document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
document.getElementById('deleteModal').addEventListener('click', (event) => {
  if (event.target.id === 'deleteModal') closeDeleteModal();
});
document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  const trip = tripPlans[activeTripId];
  if (!trip?.spots || pendingDeleteIndex === null) return;
  const deletedSpot = trip.spots.splice(pendingDeleteIndex, 1)[0];
  saveTripPlans();
  closeDeleteModal();
  renderTrip(activeTripId);
  showToast(`${deletedSpot.name} を削除しました`);
});
document.getElementById('editTripBtn').addEventListener('click', openTripEditModal);
document.getElementById('tripTitleButton').addEventListener('click', openTripEditModal);
document.getElementById('tripTitleButton').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openTripEditModal();
  }
});
document.getElementById('closeTripEditModal').addEventListener('click', closeTripEditModal);
document.getElementById('tripEditModal').addEventListener('click', (event) => {
  if (event.target.id === 'tripEditModal') closeTripEditModal();
});
document.getElementById('tripEditForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const trip = tripPlans[activeTripId];
  const title = document.getElementById('editTripName').value.trim();
  const start = document.getElementById('editTripStart').value;
  const end = document.getElementById('editTripEnd').value;
  if (!trip || !title) return;
  if ((start && !end) || (!start && end) || (start && end && end < start)) {
    showToast('開始日と終了日を正しく入力してください');
    return;
  }
  const titleParts = splitTripTitle(title);
  trip.title = title;
  trip.prefix = titleParts.prefix;
  trip.accent = titleParts.accent;
  trip.members = Math.max(1, Number(document.getElementById('editTripMembers').value) || 1);
  trip.mood = document.getElementById('editTripMood').value.trim() || 'これから決める';
  trip.dates = start && end ? `${displayDate(start)} — ${displayDate(end)}` : '日程未設定';
  trip.shortDates = shortDateRange(start, end);
  trip.days = start && end ? Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1 : 0;
  saveTripPlans();
  closeTripEditModal();
  renderTrip(activeTripId);
  showToast('旅の情報を更新しました');
});
document.getElementById('printGuideBtn').addEventListener('click', () => showToast('しおりの印刷画面を準備しています'));
document.getElementById('createMovieBtn').addEventListener('click', () => showToast('旅ムービーを生成しています…'));
document.getElementById('folderBtn').addEventListener('click', () => showToast('写真フォルダの選択画面を開きます'));
document.getElementById('playBtn').addEventListener('click', (event) => {
  event.currentTarget.textContent = event.currentTarget.textContent === '▶' ? 'Ⅱ' : '▶';
  showToast(event.currentTarget.textContent === 'Ⅱ' ? 'プレビューを再生中' : 'プレビューを一時停止');
});

document.querySelectorAll('.style-choice').forEach((choice) => choice.addEventListener('click', () => {
  document.querySelectorAll('.style-choice').forEach((item) => item.classList.remove('selected'));
  choice.classList.add('selected');
  showToast(`${choice.querySelector('b').textContent} スタイルを選択しました`);
}));

document.querySelectorAll('.thumb').forEach((thumb) => thumb.addEventListener('click', () => {
  if (thumb.classList.contains('add-photo')) {
    showToast('写真を追加できるようになりました');
    return;
  }
  thumb.classList.toggle('selected');
  const mark = thumb.querySelector('span');
  if (mark) mark.textContent = thumb.classList.contains('selected') ? '✓' : '';
}));

document.querySelectorAll('.packing input').forEach((input) => input.addEventListener('change', () => {
  const checked = document.querySelectorAll('.packing input:checked').length;
  document.querySelector('.packing h2 small').textContent = `${checked} / 6`;
}));

views.forEach((view) => { view.hidden = false; });
const sectionObserver = new IntersectionObserver((entries) => {
  const visibleSections = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
  const currentSection = visibleSections[0]?.target.dataset.panel;
  if (currentSection) navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === currentSection));
}, { rootMargin: '-16% 0px -62% 0px', threshold: [0, 0.25, 0.5] });
views.forEach((view) => sectionObserver.observe(view));
Object.keys(savedTripPlans).forEach(addTripOption);
filterTrips('');
renderTrip('setouchi', false);
