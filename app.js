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
    item.innerHTML = `<span class="custom-spot-number">${String(index + 1).padStart(2, '0')}</span><div><strong></strong><span></span></div><i></i><button class="delete-spot" data-spot-index="${index}" aria-label="場所を削除">×</button>`;
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
  if (!spots.length) {
    map.innerHTML = '<div class="map-placeholder"><span>⌖</span><strong>場所を追加すると、ここにピンが表示されます</strong><small>Google Maps</small></div>';
    mapLink.href = 'https://www.google.com/maps';
    return;
  }
  const query = spots.map((spot) => `${spot.name} ${spot.address}`).join(' ');
  map.innerHTML = `<iframe title="${trip.title}のGoogle Maps" src="https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed" loading="lazy"></iframe>`;
  mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  spots.forEach((spot, index) => {
    const item = document.createElement('article');
    item.className = 'home-pin';
    item.innerHTML = `<span class="pin-index">${index + 1}</span><div><strong></strong><small></small></div><a target="_blank" rel="noreferrer" aria-label="Google Mapsで開く">↗</a><button class="delete-spot" data-spot-index="${index}" aria-label="場所を削除">×</button>`;
    item.querySelector('strong').textContent = spot.name;
    item.querySelector('small').textContent = spot.address;
    item.querySelector('a').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name} ${spot.address}`)}`;
    pinList.append(item);
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function switchView(viewName) {
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
  views.forEach((view) => {
    const isActive = view.dataset.panel === viewName;
    view.hidden = !isActive;
    view.classList.toggle('active-view', isActive);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-view]').forEach((item) => item.addEventListener('click', () => switchView(item.dataset.view)));
document.getElementById('tripOptions').addEventListener('click', (event) => {
  const option = event.target.closest('.trip-option');
  if (option) renderTrip(option.dataset.trip);
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
  renderTrip(tripId);
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
document.getElementById('editTripBtn').addEventListener('click', () => showToast('旅の基本情報を編集できます'));
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

Object.keys(savedTripPlans).forEach(addTripOption);
renderTrip('setouchi', false);
