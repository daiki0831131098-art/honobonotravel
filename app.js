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
  const isNewTrip = trip.isNew || trip.days === 0;
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
  document.getElementById('itineraryMeta').textContent = isNewTrip ? '0 DAYS · 0 PLACES' : '4 DAYS · 8 PLACES';
  document.querySelector('.plan-view').classList.toggle('empty-mode', isNewTrip);
  document.querySelector('.guide-view').classList.toggle('empty-mode', isNewTrip);
  document.querySelector('.movie-view').classList.toggle('empty-mode', isNewTrip);
  document.getElementById('planEmptyState').hidden = !isNewTrip;
  document.getElementById('guideEmptyState').hidden = !isNewTrip;
  document.getElementById('movieEmptyState').hidden = !isNewTrip;
  document.querySelectorAll('.trip-option').forEach((option) => option.classList.toggle('active', option.dataset.trip === tripId));
  if (notify) showToast(`${trip.title} に切り替えました`);
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
  localStorage.setItem('tabiTrips', JSON.stringify(tripPlans));
  addTripOption(tripId);
  closeTripModal();
  tripNameInput.value = '';
  renderTrip(tripId);
});
document.getElementById('addSpotBtn').addEventListener('click', () => showToast('新しい予定を追加できるようになりました'));
document.getElementById('emptyAddSpotBtn').addEventListener('click', () => showToast('新しい予定を追加できるようになりました'));
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
